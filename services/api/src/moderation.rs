use actix_web::{HttpRequest, HttpResponse, ResponseError, http::StatusCode, post, web};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

const REASONS: [&str; 6] = [
    "SAFETY",
    "SPAM",
    "HARASSMENT",
    "MISLEADING",
    "INAPPROPRIATE",
    "OTHER",
];

#[derive(Debug, Deserialize)]
pub struct CreateReport {
    subject_type: String,
    target_id: Uuid,
    reason: String,
    details: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ContentReport {
    id: Uuid,
    subject_type: String,
    quest_id: Option<Uuid>,
    user_id: Option<Uuid>,
    reason: String,
    details: Option<String>,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Error)]
pub enum ReportError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("report details are invalid")]
    Invalid,
    #[error("the reported content was not found")]
    NotFound,
    #[error("you cannot report your own content")]
    OwnContent,
    #[error("you already have an active report for this content")]
    Duplicate,
    #[error("reporting is temporarily unavailable")]
    Database,
}

impl ResponseError for ReportError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::Invalid => StatusCode::UNPROCESSABLE_ENTITY,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::OwnContent => StatusCode::FORBIDDEN,
            Self::Duplicate => StatusCode::CONFLICT,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::Invalid => "invalid_report",
                Self::NotFound => "report_target_not_found",
                Self::OwnContent => "cannot_report_own_content",
                Self::Duplicate => "duplicate_report",
                Self::Database => "report_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

impl CreateReport {
    fn validate(&self) -> Result<(), ReportError> {
        let valid_details = self.details.as_deref().is_none_or(|details| {
            let length = details.trim().chars().count();
            (3..=500).contains(&length)
        });
        if !matches!(self.subject_type.as_str(), "QUEST" | "USER")
            || !REASONS.contains(&self.reason.as_str())
            || !valid_details
        {
            return Err(ReportError::Invalid);
        }
        Ok(())
    }
}

#[post("/reports")]
pub async fn create_report(
    request: HttpRequest,
    state: web::Data<AppState>,
    report: web::Json<CreateReport>,
) -> Result<(web::Json<ContentReport>, StatusCode), ReportError> {
    report.validate()?;
    let reporter = state.auth.authenticate(&request).await?;
    let (quest_id, user_id) = match report.subject_type.as_str() {
        "QUEST" => {
            let creator_id =
                sqlx::query_scalar::<_, Uuid>("select creator_id from public.quests where id = $1")
                    .bind(report.target_id)
                    .fetch_optional(&state.database)
                    .await
                    .map_err(|_| ReportError::Database)?
                    .ok_or(ReportError::NotFound)?;
            if creator_id == reporter.id {
                return Err(ReportError::OwnContent);
            }
            (Some(report.target_id), None)
        }
        "USER" => {
            if report.target_id == reporter.id {
                return Err(ReportError::OwnContent);
            }
            let exists = sqlx::query_scalar::<_, bool>(
                "select exists(select 1 from public.users where id = $1)",
            )
            .bind(report.target_id)
            .fetch_one(&state.database)
            .await
            .map_err(|_| ReportError::Database)?;
            if !exists {
                return Err(ReportError::NotFound);
            }
            (None, Some(report.target_id))
        }
        _ => unreachable!(),
    };

    let created = sqlx::query_as::<_, ContentReport>(
        r#"
        insert into public.content_reports (
          reporter_id, subject_type, quest_id, user_id, reason, details
        )
        values ($1, $2::report_subject_type, $3, $4, $5::report_reason, $6)
        returning id, subject_type::text, quest_id, user_id, reason::text,
                  details, status::text, created_at
        "#,
    )
    .bind(reporter.id)
    .bind(&report.subject_type)
    .bind(quest_id)
    .bind(user_id)
    .bind(&report.reason)
    .bind(report.details.as_deref().map(str::trim))
    .fetch_one(&state.database)
    .await
    .map_err(|error| {
        if error
            .as_database_error()
            .and_then(|database| database.code())
            .as_deref()
            == Some("23505")
        {
            ReportError::Duplicate
        } else {
            ReportError::Database
        }
    })?;
    Ok((web::Json(created), StatusCode::CREATED))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_report_reason_and_optional_details() {
        let mut report = CreateReport {
            subject_type: "QUEST".to_string(),
            target_id: Uuid::new_v4(),
            reason: "SPAM".to_string(),
            details: None,
        };
        assert!(report.validate().is_ok());
        report.reason = "BORED".to_string();
        assert!(matches!(report.validate(), Err(ReportError::Invalid)));
        report.reason = "OTHER".to_string();
        report.details = Some("x".repeat(501));
        assert!(matches!(report.validate(), Err(ReportError::Invalid)));
    }
}
