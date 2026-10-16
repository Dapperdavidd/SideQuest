use actix_web::{
    HttpRequest, HttpResponse, ResponseError, delete, get, http::StatusCode, patch, post, web,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Profile {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub followers_count: i64,
    pub following_count: i64,
    pub created_quests_count: i64,
    pub completed_quests_count: i64,
    pub wins_count: i64,
}

#[derive(Debug, Serialize)]
pub struct FollowState {
    user_id: Uuid,
    following: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfile {
    username: Option<String>,
    display_name: Option<String>,
    bio: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Error)]
pub enum ProfileError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("profile was not found")]
    NotFound,
    #[error("username must contain 3 to 30 lowercase letters, numbers, or underscores")]
    InvalidUsername,
    #[error("display name must contain 1 to 80 characters")]
    InvalidDisplayName,
    #[error("bio cannot exceed 240 characters")]
    InvalidBio,
    #[error("username is already taken")]
    UsernameTaken,
    #[error("users cannot follow themselves")]
    CannotFollowSelf,
    #[error("profile service is temporarily unavailable")]
    Database,
}

impl ResponseError for ProfileError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::InvalidUsername | Self::InvalidDisplayName | Self::InvalidBio => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            Self::UsernameTaken => StatusCode::CONFLICT,
            Self::CannotFollowSelf => StatusCode::CONFLICT,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }

        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "profile_not_found",
                Self::InvalidUsername | Self::InvalidDisplayName | Self::InvalidBio => "invalid_profile",
                Self::UsernameTaken => "username_taken",
                Self::CannotFollowSelf => "cannot_follow_self",
                Self::Database => "profile_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

impl UpdateProfile {
    fn validate(&self) -> Result<(), ProfileError> {
        if let Some(username) = &self.username
            && (username.len() < 3
                || username.len() > 30
                || !username
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'))
        {
            return Err(ProfileError::InvalidUsername);
        }
        if let Some(display_name) = &self.display_name
            && (display_name.trim().is_empty() || display_name.chars().count() > 80)
        {
            return Err(ProfileError::InvalidDisplayName);
        }
        if let Some(bio) = &self.bio
            && bio.chars().count() > 240
        {
            return Err(ProfileError::InvalidBio);
        }
        Ok(())
    }
}

#[get("/users/me")]
pub async fn get_me(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Profile>, ProfileError> {
    let user = state.auth.authenticate(&request).await?;
    let profile = find_by_id(&state, user.id).await?;
    Ok(web::Json(profile))
}

#[patch("/users/me")]
pub async fn update_me(
    request: HttpRequest,
    state: web::Data<AppState>,
    changes: web::Json<UpdateProfile>,
) -> Result<web::Json<Profile>, ProfileError> {
    changes.validate()?;
    let user = state.auth.authenticate(&request).await?;
    let result = sqlx::query(
        r#"
        update public.users
        set username = coalesce($2, username),
            display_name = coalesce($3, display_name),
            bio = coalesce($4, bio),
            avatar_url = coalesce($5, avatar_url),
            updated_at = now()
        where id = $1
        "#,
    )
    .bind(user.id)
    .bind(changes.username.as_deref())
    .bind(changes.display_name.as_deref().map(str::trim))
    .bind(changes.bio.as_deref().map(str::trim))
    .bind(changes.avatar_url.as_deref())
    .execute(&state.database)
    .await;

    match result {
        Ok(result) if result.rows_affected() == 1 => {
            Ok(web::Json(find_by_id(&state, user.id).await?))
        }
        Ok(_) => Err(ProfileError::NotFound),
        Err(error) if is_unique_violation(&error) => Err(ProfileError::UsernameTaken),
        Err(_) => Err(ProfileError::Database),
    }
}

#[get("/users/{username}")]
pub async fn get_profile(
    state: web::Data<AppState>,
    username: web::Path<String>,
) -> Result<web::Json<Profile>, ProfileError> {
    let profile = find_by_username(&state, &username.into_inner()).await?;
    Ok(web::Json(profile))
}

#[get("/users/{user_id}/follow-state")]
pub async fn get_follow_state(
    request: HttpRequest,
    state: web::Data<AppState>,
    user_id: web::Path<Uuid>,
) -> Result<web::Json<FollowState>, ProfileError> {
    let viewer = state.auth.authenticate(&request).await?;
    let user_id = user_id.into_inner();
    let following = sqlx::query_scalar::<_, bool>(
        "select exists(select 1 from public.user_follows where follower_id = $1 and followed_id = $2)",
    )
    .bind(viewer.id)
    .bind(user_id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| ProfileError::Database)?;
    Ok(web::Json(FollowState { user_id, following }))
}

#[post("/users/{user_id}/follow")]
pub async fn follow_user(
    request: HttpRequest,
    state: web::Data<AppState>,
    user_id: web::Path<Uuid>,
) -> Result<web::Json<FollowState>, ProfileError> {
    let viewer = state.auth.authenticate(&request).await?;
    let user_id = user_id.into_inner();
    if viewer.id == user_id {
        return Err(ProfileError::CannotFollowSelf);
    }
    let target_exists =
        sqlx::query_scalar::<_, bool>("select exists(select 1 from public.users where id = $1)")
            .bind(user_id)
            .fetch_one(&state.database)
            .await
            .map_err(|_| ProfileError::Database)?;
    if !target_exists {
        return Err(ProfileError::NotFound);
    }
    sqlx::query(
        "insert into public.user_follows (follower_id, followed_id) values ($1, $2) on conflict do nothing",
    )
    .bind(viewer.id)
    .bind(user_id)
    .execute(&state.database)
    .await
    .map_err(|_| ProfileError::Database)?;
    Ok(web::Json(FollowState {
        user_id,
        following: true,
    }))
}

#[delete("/users/{user_id}/follow")]
pub async fn unfollow_user(
    request: HttpRequest,
    state: web::Data<AppState>,
    user_id: web::Path<Uuid>,
) -> Result<web::Json<FollowState>, ProfileError> {
    let viewer = state.auth.authenticate(&request).await?;
    let user_id = user_id.into_inner();
    sqlx::query("delete from public.user_follows where follower_id = $1 and followed_id = $2")
        .bind(viewer.id)
        .bind(user_id)
        .execute(&state.database)
        .await
        .map_err(|_| ProfileError::Database)?;
    Ok(web::Json(FollowState {
        user_id,
        following: false,
    }))
}

#[get("/users/{user_id}/followers")]
pub async fn list_followers(
    state: web::Data<AppState>,
    user_id: web::Path<Uuid>,
) -> Result<web::Json<Vec<Profile>>, ProfileError> {
    let profiles = list_relationship_profiles(&state, user_id.into_inner(), true).await?;
    Ok(web::Json(profiles))
}

#[get("/users/{user_id}/following")]
pub async fn list_following(
    state: web::Data<AppState>,
    user_id: web::Path<Uuid>,
) -> Result<web::Json<Vec<Profile>>, ProfileError> {
    let profiles = list_relationship_profiles(&state, user_id.into_inner(), false).await?;
    Ok(web::Json(profiles))
}

async fn find_by_id(state: &AppState, id: Uuid) -> Result<Profile, ProfileError> {
    find_profile(state, "u.id = $1::uuid", id.to_string()).await
}

async fn find_by_username(state: &AppState, username: &str) -> Result<Profile, ProfileError> {
    find_profile(state, "u.username = $1", username.to_string()).await
}

async fn find_profile(
    state: &AppState,
    predicate: &str,
    value: String,
) -> Result<Profile, ProfileError> {
    let query = format!(
        r#"
        select u.id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at, u.updated_at,
               (select count(*) from public.user_follows f where f.followed_id = u.id) as followers_count,
               (select count(*) from public.user_follows f where f.follower_id = u.id) as following_count,
               (select count(*) from public.quests q where q.creator_id = u.id) as created_quests_count,
               (select count(distinct e.quest_id) from public.quest_entries e join public.quests q on q.id = e.quest_id where e.participant_id = u.id and q.status = 'FINALIZED') as completed_quests_count,
               (select count(*) from public.quest_winners w join public.quest_entries e on e.id = w.entry_id where e.participant_id = u.id) as wins_count
        from public.users u
        where {predicate}
        "#,
    );
    sqlx::query_as::<_, Profile>(&query)
        .bind(value)
        .fetch_optional(&state.database)
        .await
        .map_err(|_| ProfileError::Database)?
        .ok_or(ProfileError::NotFound)
}

async fn list_relationship_profiles(
    state: &AppState,
    user_id: Uuid,
    followers: bool,
) -> Result<Vec<Profile>, ProfileError> {
    let join_condition = if followers {
        "f.follower_id = u.id and f.followed_id = $1"
    } else {
        "f.followed_id = u.id and f.follower_id = $1"
    };
    let query = format!(
        r#"
        select u.id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at, u.updated_at,
               (select count(*) from public.user_follows x where x.followed_id = u.id) as followers_count,
               (select count(*) from public.user_follows x where x.follower_id = u.id) as following_count,
               (select count(*) from public.quests q where q.creator_id = u.id) as created_quests_count,
               (select count(distinct e.quest_id) from public.quest_entries e join public.quests q on q.id = e.quest_id where e.participant_id = u.id and q.status = 'FINALIZED') as completed_quests_count,
               (select count(*) from public.quest_winners w join public.quest_entries e on e.id = w.entry_id where e.participant_id = u.id) as wins_count
        from public.users u
        join public.user_follows f on {join_condition}
        order by f.created_at desc
        limit 100
        "#,
    );
    sqlx::query_as::<_, Profile>(&query)
        .bind(user_id)
        .fetch_all(&state.database)
        .await
        .map_err(|_| ProfileError::Database)
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.code().as_deref() == Some("23505"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn changes(username: &str) -> UpdateProfile {
        UpdateProfile {
            username: Some(username.to_string()),
            display_name: None,
            bio: None,
            avatar_url: None,
        }
    }

    #[test]
    fn accepts_a_portable_username() {
        assert!(changes("hannah_24").validate().is_ok());
    }

    #[test]
    fn rejects_spaces_and_uppercase_in_usernames() {
        assert!(matches!(
            changes("Hannah Smith").validate(),
            Err(ProfileError::InvalidUsername)
        ));
    }

    #[test]
    fn rejects_an_overlong_bio() {
        let update = UpdateProfile {
            username: None,
            display_name: None,
            bio: Some("x".repeat(241)),
            avatar_url: None,
        };
        assert!(matches!(update.validate(), Err(ProfileError::InvalidBio)));
    }
}
