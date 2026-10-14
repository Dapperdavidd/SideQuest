use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, patch, web};
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
    let result = sqlx::query_as::<_, Profile>(
        r#"
        update public.users
        set username = coalesce($2, username),
            display_name = coalesce($3, display_name),
            bio = coalesce($4, bio),
            avatar_url = coalesce($5, avatar_url),
            updated_at = now()
        where id = $1
        returning id, username, display_name, bio, avatar_url, created_at, updated_at
        "#,
    )
    .bind(user.id)
    .bind(changes.username.as_deref())
    .bind(changes.display_name.as_deref().map(str::trim))
    .bind(changes.bio.as_deref().map(str::trim))
    .bind(changes.avatar_url.as_deref())
    .fetch_optional(&state.database)
    .await;

    match result {
        Ok(Some(profile)) => Ok(web::Json(profile)),
        Ok(None) => Err(ProfileError::NotFound),
        Err(error) if is_unique_violation(&error) => Err(ProfileError::UsernameTaken),
        Err(_) => Err(ProfileError::Database),
    }
}

#[get("/users/{username}")]
pub async fn get_profile(
    state: web::Data<AppState>,
    username: web::Path<String>,
) -> Result<web::Json<Profile>, ProfileError> {
    let profile = sqlx::query_as::<_, Profile>(
        r#"
        select id, username, display_name, bio, avatar_url, created_at, updated_at
        from public.users
        where username = $1
        "#,
    )
    .bind(username.into_inner())
    .fetch_optional(&state.database)
    .await
    .map_err(|_| ProfileError::Database)?
    .ok_or(ProfileError::NotFound)?;

    Ok(web::Json(profile))
}

async fn find_by_id(state: &AppState, id: Uuid) -> Result<Profile, ProfileError> {
    sqlx::query_as::<_, Profile>(
        r#"
        select id, username, display_name, bio, avatar_url, created_at, updated_at
        from public.users
        where id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| ProfileError::Database)?
    .ok_or(ProfileError::NotFound)
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
