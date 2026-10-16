use actix_web::{
    HttpRequest, HttpResponse, ResponseError, delete, get, http::StatusCode, post, web,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Deserialize)]
pub struct CreateInvitation {
    max_uses: u8,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct QuestInvitation {
    id: Uuid,
    quest_id: Uuid,
    token: Uuid,
    max_uses: i16,
    use_count: i16,
    expires_at: DateTime<Utc>,
    revoked_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AcceptInvitationResult {
    quest_id: Uuid,
    joined: bool,
}

fn valid_capacity(max_uses: u8) -> bool {
    (1..=10).contains(&max_uses)
}

#[derive(Debug, Error)]
pub enum InvitationError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("quest or invitation was not found")]
    NotFound,
    #[error("only the quest creator can manage invitations")]
    NotCreator,
    #[error("invitations are available only for private or invite-only quests")]
    PublicQuest,
    #[error("the invitation settings are invalid")]
    InvalidInvitation,
    #[error("this invitation is no longer available")]
    Unavailable,
    #[error("the quest creator cannot accept their own invitation")]
    CreatorCannotAccept,
    #[error("invitation service is temporarily unavailable")]
    Database,
}

impl ResponseError for InvitationError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::NotCreator | Self::PublicQuest => StatusCode::FORBIDDEN,
            Self::InvalidInvitation => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Unavailable | Self::CreatorCannotAccept => StatusCode::CONFLICT,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "invitation_not_found",
                Self::NotCreator => "not_quest_creator",
                Self::PublicQuest => "public_quest_invitation_not_allowed",
                Self::InvalidInvitation => "invalid_invitation",
                Self::Unavailable => "invitation_unavailable",
                Self::CreatorCannotAccept => "creator_cannot_accept_invitation",
                Self::Database => "invitation_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[post("/quests/{quest_id}/invitations")]
pub async fn create_invitation(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
    input: web::Json<CreateInvitation>,
) -> Result<(web::Json<QuestInvitation>, StatusCode), InvitationError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    if !valid_capacity(input.max_uses) {
        return Err(InvitationError::InvalidInvitation);
    }

    let quest = sqlx::query_as::<_, (Uuid, String, String, DateTime<Utc>)>(
        "select creator_id, visibility::text, status::text, deadline from public.quests where id = $1",
    )
    .bind(quest_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| InvitationError::Database)?
    .ok_or(InvitationError::NotFound)?;
    if quest.0 != user.id {
        return Err(InvitationError::NotCreator);
    }
    if quest.1 == "PUBLIC" {
        return Err(InvitationError::PublicQuest);
    }
    if quest.2 != "OPEN" || quest.3 <= Utc::now() {
        return Err(InvitationError::Unavailable);
    }

    let maximum_expiry = Utc::now() + Duration::days(7);
    let expires_at = input
        .expires_at
        .unwrap_or_else(|| quest.3.min(maximum_expiry));
    if expires_at <= Utc::now() || expires_at > quest.3 {
        return Err(InvitationError::InvalidInvitation);
    }

    let invitation = sqlx::query_as::<_, QuestInvitation>(
        r#"
        insert into public.quest_invitations (quest_id, creator_id, max_uses, expires_at)
        values ($1, $2, $3, $4)
        returning id, quest_id, token, max_uses, use_count, expires_at, revoked_at, created_at
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .bind(i16::from(input.max_uses))
    .bind(expires_at)
    .fetch_one(&state.database)
    .await
    .map_err(|_| InvitationError::Database)?;

    Ok((web::Json(invitation), StatusCode::CREATED))
}

#[get("/quests/{quest_id}/invitations")]
pub async fn list_invitations(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Vec<QuestInvitation>>, InvitationError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let creator_id =
        sqlx::query_scalar::<_, Uuid>("select creator_id from public.quests where id = $1")
            .bind(quest_id)
            .fetch_optional(&state.database)
            .await
            .map_err(|_| InvitationError::Database)?
            .ok_or(InvitationError::NotFound)?;
    if creator_id != user.id {
        return Err(InvitationError::NotCreator);
    }

    let invitations = sqlx::query_as::<_, QuestInvitation>(
        r#"
        select id, quest_id, token, max_uses, use_count, expires_at, revoked_at, created_at
        from public.quest_invitations
        where quest_id = $1 and creator_id = $2
        order by created_at desc
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| InvitationError::Database)?;
    Ok(web::Json(invitations))
}

#[delete("/quests/{quest_id}/invitations/{invitation_id}")]
pub async fn revoke_invitation(
    request: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(Uuid, Uuid)>,
) -> Result<HttpResponse, InvitationError> {
    let user = state.auth.authenticate(&request).await?;
    let (quest_id, invitation_id) = path.into_inner();
    let updated = sqlx::query_scalar::<_, Uuid>(
        r#"
        update public.quest_invitations
        set revoked_at = coalesce(revoked_at, now())
        where id = $1 and quest_id = $2 and creator_id = $3
        returning id
        "#,
    )
    .bind(invitation_id)
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| InvitationError::Database)?;
    if updated.is_none() {
        return Err(InvitationError::NotFound);
    }
    Ok(HttpResponse::NoContent().finish())
}

#[post("/invitations/{token}/accept")]
pub async fn accept_invitation(
    request: HttpRequest,
    state: web::Data<AppState>,
    token: web::Path<Uuid>,
) -> Result<web::Json<AcceptInvitationResult>, InvitationError> {
    let user = state.auth.authenticate(&request).await?;
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| InvitationError::Database)?;
    let invitation = sqlx::query_as::<_, (Uuid, Uuid, i16, i16, DateTime<Utc>, Option<DateTime<Utc>>, Uuid, String, DateTime<Utc>)>(
        r#"
        select invitation.id, invitation.quest_id, invitation.max_uses, invitation.use_count,
               invitation.expires_at, invitation.revoked_at, q.creator_id, q.status::text, q.deadline
        from public.quest_invitations invitation
        join public.quests q on q.id = invitation.quest_id
        where invitation.token = $1
        for update of invitation, q
        "#,
    )
    .bind(token.into_inner())
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| InvitationError::Database)?
    .ok_or(InvitationError::NotFound)?;

    if invitation.6 == user.id {
        return Err(InvitationError::CreatorCannotAccept);
    }
    if invitation.5.is_some()
        || invitation.4 <= Utc::now()
        || invitation.3 >= invitation.2
        || invitation.7 != "OPEN"
        || invitation.8 <= Utc::now()
    {
        return Err(InvitationError::Unavailable);
    }

    let joined = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.quest_participants (quest_id, user_id)
        values ($1, $2)
        on conflict (quest_id, user_id) do nothing
        returning user_id
        "#,
    )
    .bind(invitation.1)
    .bind(user.id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| InvitationError::Database)?
    .is_some();

    if joined {
        sqlx::query("update public.quest_invitations set use_count = use_count + 1 where id = $1")
            .bind(invitation.0)
            .execute(&mut *transaction)
            .await
            .map_err(|_| InvitationError::Database)?;
    }
    transaction
        .commit()
        .await
        .map_err(|_| InvitationError::Database)?;

    Ok(web::Json(AcceptInvitationResult {
        quest_id: invitation.1,
        joined,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_capacity_between_one_and_ten() {
        assert!(valid_capacity(1));
        assert!(valid_capacity(10));
        assert!(!valid_capacity(0));
        assert!(!valid_capacity(11));
    }
}
