use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, post, web};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Serialize, FromRow)]
pub struct Notification {
    id: Uuid,
    actor_id: Option<Uuid>,
    quest_id: Option<Uuid>,
    kind: String,
    title: String,
    body: String,
    href: String,
    read_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct NotificationQuery {
    limit: Option<i64>,
    unread_only: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct UnreadCount {
    unread_count: i64,
}

#[derive(Debug, Serialize)]
pub struct MarkReadResult {
    updated_count: u64,
}

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("notification was not found")]
    NotFound,
    #[error("notification service is temporarily unavailable")]
    Database,
}

impl ResponseError for NotificationError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "notification_not_found",
                Self::Database => "notification_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[get("/users/me/notifications")]
pub async fn list_notifications(
    request: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<NotificationQuery>,
) -> Result<web::Json<Vec<Notification>>, NotificationError> {
    let user = state.auth.authenticate(&request).await?;
    let limit = query.limit.unwrap_or(40).clamp(1, 100);
    let notifications = sqlx::query_as::<_, Notification>(
        r#"
        select id, actor_id, quest_id, kind::text, title, body, href, read_at, created_at
        from public.notifications
        where user_id = $1 and (not $2 or read_at is null)
        order by created_at desc
        limit $3
        "#,
    )
    .bind(user.id)
    .bind(query.unread_only.unwrap_or(false))
    .bind(limit)
    .fetch_all(&state.database)
    .await
    .map_err(|_| NotificationError::Database)?;
    Ok(web::Json(notifications))
}

#[get("/users/me/notifications/unread-count")]
pub async fn unread_count(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<UnreadCount>, NotificationError> {
    let user = state.auth.authenticate(&request).await?;
    let unread_count = sqlx::query_scalar::<_, i64>(
        "select count(*) from public.notifications where user_id = $1 and read_at is null",
    )
    .bind(user.id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| NotificationError::Database)?;
    Ok(web::Json(UnreadCount { unread_count }))
}

#[post("/users/me/notifications/{notification_id}/read")]
pub async fn mark_notification_read(
    request: HttpRequest,
    state: web::Data<AppState>,
    notification_id: web::Path<Uuid>,
) -> Result<HttpResponse, NotificationError> {
    let user = state.auth.authenticate(&request).await?;
    let result = sqlx::query(
        "update public.notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2",
    )
    .bind(notification_id.into_inner())
    .bind(user.id)
    .execute(&state.database)
    .await
    .map_err(|_| NotificationError::Database)?;
    if result.rows_affected() == 0 {
        return Err(NotificationError::NotFound);
    }
    Ok(HttpResponse::NoContent().finish())
}

#[post("/users/me/notifications/read-all")]
pub async fn mark_all_notifications_read(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<MarkReadResult>, NotificationError> {
    let user = state.auth.authenticate(&request).await?;
    let result = sqlx::query(
        "update public.notifications set read_at = now() where user_id = $1 and read_at is null",
    )
    .bind(user.id)
    .execute(&state.database)
    .await
    .map_err(|_| NotificationError::Database)?;
    Ok(web::Json(MarkReadResult {
        updated_count: result.rows_affected(),
    }))
}
