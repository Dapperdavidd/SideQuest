use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, patch, web};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

const REPORT_STATUSES: [&str; 4] = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"];
const REVIEWABLE_REPORT_STATUSES: [&str; 3] = ["REVIEWING", "RESOLVED", "DISMISSED"];
const ORGANIZATION_STATUSES: [&str; 3] = ["PENDING", "VERIFIED", "REJECTED"];

#[derive(Debug, Error)]
pub enum AdminError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("administrator access is required")]
    Forbidden,
    #[error("the requested moderation record was not found")]
    NotFound,
    #[error("the moderation decision is invalid")]
    Invalid,
    #[error("moderation operations are temporarily unavailable")]
    Database,
}

impl ResponseError for AdminError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Invalid => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::Forbidden => "admin_access_required",
                Self::NotFound => "moderation_record_not_found",
                Self::Invalid => "invalid_moderation_decision",
                Self::Database => "moderation_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminListQuery {
    status: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AdminReport {
    id: Uuid,
    reporter_username: String,
    reporter_display_name: String,
    subject_type: String,
    quest_id: Option<Uuid>,
    quest_title: Option<String>,
    user_id: Option<Uuid>,
    user_username: Option<String>,
    user_display_name: Option<String>,
    reason: String,
    details: Option<String>,
    status: String,
    resolution_note: Option<String>,
    created_at: DateTime<Utc>,
    reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ReportDecision {
    status: String,
    note: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AdminOrganization {
    id: Uuid,
    owner_id: Uuid,
    owner_username: String,
    owner_display_name: String,
    slug: String,
    display_name: String,
    description: Option<String>,
    website_url: Option<String>,
    logo_url: Option<String>,
    verification_status: String,
    verification_reason: Option<String>,
    created_at: DateTime<Utc>,
    verified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct OrganizationDecision {
    status: String,
    reason: Option<String>,
}

async fn authenticate_admin(request: &HttpRequest, state: &AppState) -> Result<Uuid, AdminError> {
    let user = state.auth.authenticate(request).await?;
    if !state.admin_user_ids.contains(&user.id) {
        return Err(AdminError::Forbidden);
    }
    Ok(user.id)
}

fn normalized_note(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn valid_note(value: Option<&str>) -> bool {
    value.is_none_or(|value| (3..=500).contains(&value.chars().count()))
}

#[get("/admin/reports")]
pub async fn list_reports(
    request: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<AdminListQuery>,
) -> Result<web::Json<Vec<AdminReport>>, AdminError> {
    authenticate_admin(&request, &state).await?;
    let status = query.status.as_deref().unwrap_or("OPEN");
    if !REPORT_STATUSES.contains(&status) {
        return Err(AdminError::Invalid);
    }
    let reports = sqlx::query_as::<_, AdminReport>(
        r#"
        select report.id,
               reporter.username as reporter_username,
               reporter.display_name as reporter_display_name,
               report.subject_type::text as subject_type,
               report.quest_id,
               quest.title as quest_title,
               report.user_id,
               subject.username as user_username,
               subject.display_name as user_display_name,
               report.reason::text as reason,
               report.details,
               report.status::text as status,
               report.resolution_note,
               report.created_at,
               report.reviewed_at
        from public.content_reports report
        join public.users reporter on reporter.id = report.reporter_id
        left join public.quests quest on quest.id = report.quest_id
        left join public.users subject on subject.id = report.user_id
        where report.status = $1::report_status
        order by report.created_at, report.id
        limit $2
        "#,
    )
    .bind(status)
    .bind(query.limit.unwrap_or(100).clamp(1, 100))
    .fetch_all(&state.database)
    .await
    .map_err(|_| AdminError::Database)?;
    Ok(web::Json(reports))
}

#[patch("/admin/reports/{report_id}")]
pub async fn update_report(
    request: HttpRequest,
    state: web::Data<AppState>,
    report_id: web::Path<Uuid>,
    decision: web::Json<ReportDecision>,
) -> Result<HttpResponse, AdminError> {
    let moderator_id = authenticate_admin(&request, &state).await?;
    let note = normalized_note(decision.note.as_deref());
    let terminal = matches!(decision.status.as_str(), "RESOLVED" | "DISMISSED");
    if !REVIEWABLE_REPORT_STATUSES.contains(&decision.status.as_str())
        || !valid_note(note)
        || (terminal && note.is_none())
    {
        return Err(AdminError::Invalid);
    }
    let report_id = report_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| AdminError::Database)?;
    let exists = sqlx::query_scalar::<_, Uuid>(
        "select id from public.content_reports where id = $1 for update",
    )
    .bind(report_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    if exists.is_none() {
        return Err(AdminError::NotFound);
    }
    sqlx::query(
        r#"
        update public.content_reports
        set status = $2::report_status,
            reviewed_by = $3,
            reviewed_at = case when $4 then now() else null end,
            resolution_note = $5,
            updated_at = now()
        where id = $1
        "#,
    )
    .bind(report_id)
    .bind(&decision.status)
    .bind(moderator_id)
    .bind(terminal)
    .bind(note)
    .execute(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    sqlx::query(
        "insert into public.moderation_actions (moderator_id, target_type, target_id, action, note) values ($1, 'REPORT', $2, $3, $4)",
    )
    .bind(moderator_id)
    .bind(report_id)
    .bind(format!("REPORT_{}", decision.status))
    .bind(note)
    .execute(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| AdminError::Database)?;
    Ok(HttpResponse::NoContent().finish())
}

#[get("/admin/organizations")]
pub async fn list_pending_organizations(
    request: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<AdminListQuery>,
) -> Result<web::Json<Vec<AdminOrganization>>, AdminError> {
    authenticate_admin(&request, &state).await?;
    let status = query.status.as_deref().unwrap_or("PENDING");
    if !ORGANIZATION_STATUSES.contains(&status) {
        return Err(AdminError::Invalid);
    }
    let organizations = sqlx::query_as::<_, AdminOrganization>(
        r#"
        select organization.id,
               organization.owner_id,
               owner.username as owner_username,
               owner.display_name as owner_display_name,
               organization.slug,
               organization.display_name,
               organization.description,
               organization.website_url,
               organization.logo_url,
               organization.verification_status,
               organization.verification_reason,
               organization.created_at,
               organization.verified_at
        from public.organizations organization
        join public.users owner on owner.id = organization.owner_id
        where organization.verification_status = $1
        order by organization.created_at, organization.id
        limit $2
        "#,
    )
    .bind(status)
    .bind(query.limit.unwrap_or(100).clamp(1, 100))
    .fetch_all(&state.database)
    .await
    .map_err(|_| AdminError::Database)?;
    Ok(web::Json(organizations))
}

#[patch("/admin/organizations/{organization_id}/verification")]
pub async fn update_organization_verification(
    request: HttpRequest,
    state: web::Data<AppState>,
    organization_id: web::Path<Uuid>,
    decision: web::Json<OrganizationDecision>,
) -> Result<HttpResponse, AdminError> {
    let moderator_id = authenticate_admin(&request, &state).await?;
    let reason = normalized_note(decision.reason.as_deref());
    if !matches!(decision.status.as_str(), "VERIFIED" | "REJECTED")
        || !valid_note(reason)
        || (decision.status == "REJECTED" && reason.is_none())
    {
        return Err(AdminError::Invalid);
    }
    let organization_id = organization_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| AdminError::Database)?;
    let organization = sqlx::query(
        "select owner_id, display_name from public.organizations where id = $1 for update",
    )
    .bind(organization_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?
    .ok_or(AdminError::NotFound)?;
    let owner_id: Uuid = organization
        .try_get("owner_id")
        .map_err(|_| AdminError::Database)?;
    let display_name: String = organization
        .try_get("display_name")
        .map_err(|_| AdminError::Database)?;
    sqlx::query(
        r#"
        update public.organizations
        set verification_status = $2,
            verified_at = case when $2 = 'VERIFIED' then now() else null end,
            reviewed_by = $3,
            verification_reason = $4,
            updated_at = now()
        where id = $1
        "#,
    )
    .bind(organization_id)
    .bind(&decision.status)
    .bind(moderator_id)
    .bind(reason)
    .execute(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    sqlx::query(
        "insert into public.moderation_actions (moderator_id, target_type, target_id, action, note) values ($1, 'ORGANIZATION', $2, $3, $4)",
    )
    .bind(moderator_id)
    .bind(organization_id)
    .bind(format!("ORGANIZATION_{}", decision.status))
    .bind(reason)
    .execute(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    let (kind, title, body) = if decision.status == "VERIFIED" {
        (
            "BUSINESS_VERIFIED",
            "Business profile verified",
            format!("{display_name} can now publish verified sponsored quests."),
        )
    } else {
        (
            "BUSINESS_REJECTED",
            "Business verification needs attention",
            format!("{display_name} was not verified. Review the decision in your profile."),
        )
    };
    sqlx::query(
        "insert into public.notifications (user_id, actor_id, kind, title, body, href) values ($1, $2, $3::notification_kind, $4, $5, '/profile')",
    )
    .bind(owner_id)
    .bind(moderator_id)
    .bind(kind)
    .bind(title)
    .bind(body)
    .execute(&mut *transaction)
    .await
    .map_err(|_| AdminError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| AdminError::Database)?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moderation_notes_are_bounded() {
        assert!(valid_note(None));
        assert!(valid_note(Some("Reviewed against the published policy.")));
        assert!(!valid_note(Some("no")));
        assert!(!valid_note(Some(&"x".repeat(501))));
    }
}
