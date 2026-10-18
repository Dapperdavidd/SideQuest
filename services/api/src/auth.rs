use std::sync::Arc;

use actix_web::{HttpRequest, HttpResponse, ResponseError, http::StatusCode};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AuthenticatedUser {
    pub id: Uuid,
}

#[derive(Debug, Deserialize, Serialize)]
struct Claims {
    sub: String,
    exp: usize,
    aud: String,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("authorization header is required")]
    MissingAuthorization,
    #[error("authorization header must contain a bearer token")]
    InvalidAuthorization,
    #[error("access token is invalid or expired")]
    InvalidToken,
    #[error("authentication service is temporarily unavailable")]
    ProviderUnavailable,
    #[error("this SideQuest account is suspended")]
    AccountSuspended,
}

impl ResponseError for AuthError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::MissingAuthorization | Self::InvalidAuthorization | Self::InvalidToken => {
                StatusCode::UNAUTHORIZED
            }
            Self::ProviderUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            Self::AccountSuspended => StatusCode::FORBIDDEN,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::ProviderUnavailable => "auth_provider_unavailable",
                Self::AccountSuspended => "account_suspended",
                _ => "unauthorized",
            },
            "message": self.to_string(),
        }))
    }
}

#[derive(Clone)]
pub struct AuthVerifier {
    client: reqwest::Client,
    jwks_url: Arc<str>,
    keys: Arc<RwLock<Option<JwkSet>>>,
    database: PgPool,
}

impl AuthVerifier {
    pub fn new(jwks_url: impl Into<Arc<str>>, database: PgPool) -> Self {
        Self {
            client: reqwest::Client::new(),
            jwks_url: jwks_url.into(),
            keys: Arc::new(RwLock::new(None)),
            database,
        }
    }

    pub async fn authenticate(
        &self,
        request: &HttpRequest,
    ) -> Result<AuthenticatedUser, AuthError> {
        let token = bearer_token(request)?;
        let header = decode_header(token).map_err(|_| AuthError::InvalidToken)?;

        if !matches!(header.alg, Algorithm::ES256 | Algorithm::RS256) {
            return Err(AuthError::InvalidToken);
        }

        let key_id = header.kid.ok_or(AuthError::InvalidToken)?;
        let mut key = self.find_key(&key_id).await;
        if key.is_none() {
            self.refresh_keys().await?;
            key = self.find_key(&key_id).await;
        }

        let key = key.ok_or(AuthError::InvalidToken)?;
        let decoding_key = DecodingKey::from_jwk(&key).map_err(|_| AuthError::InvalidToken)?;
        let mut validation = Validation::new(header.alg);
        validation.set_audience(&["authenticated"]);

        let claims = decode::<Claims>(token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?
            .claims;
        let id = Uuid::parse_str(&claims.sub).map_err(|_| AuthError::InvalidToken)?;

        let account_status = sqlx::query_scalar::<_, String>(
            "select account_status from public.users where id = $1",
        )
        .bind(id)
        .fetch_optional(&self.database)
        .await
        .map_err(|_| AuthError::ProviderUnavailable)?
        .ok_or(AuthError::InvalidToken)?;
        if account_status == "SUSPENDED" {
            return Err(AuthError::AccountSuspended);
        }

        Ok(AuthenticatedUser { id })
    }

    pub async fn authenticate_optional(
        &self,
        request: &HttpRequest,
    ) -> Result<Option<AuthenticatedUser>, AuthError> {
        if request.headers().get("authorization").is_none() {
            return Ok(None);
        }
        self.authenticate(request).await.map(Some)
    }

    async fn find_key(&self, key_id: &str) -> Option<jsonwebtoken::jwk::Jwk> {
        self.keys.read().await.as_ref()?.find(key_id).cloned()
    }

    async fn refresh_keys(&self) -> Result<(), AuthError> {
        let keys = self
            .client
            .get(self.jwks_url.as_ref())
            .send()
            .await
            .map_err(|_| AuthError::ProviderUnavailable)?
            .error_for_status()
            .map_err(|_| AuthError::ProviderUnavailable)?
            .json::<JwkSet>()
            .await
            .map_err(|_| AuthError::ProviderUnavailable)?;

        *self.keys.write().await = Some(keys);
        Ok(())
    }
}

fn bearer_token(request: &HttpRequest) -> Result<&str, AuthError> {
    let value = request
        .headers()
        .get("authorization")
        .ok_or(AuthError::MissingAuthorization)?
        .to_str()
        .map_err(|_| AuthError::InvalidAuthorization)?;
    value
        .strip_prefix("Bearer ")
        .filter(|token| !token.is_empty())
        .ok_or(AuthError::InvalidAuthorization)
}

#[cfg(test)]
mod tests {
    use actix_web::test as actix_test;

    use super::*;

    #[test]
    fn accepts_a_bearer_token() {
        let request = actix_test::TestRequest::default()
            .insert_header(("authorization", "Bearer token"))
            .to_http_request();
        assert_eq!(bearer_token(&request).expect("bearer token"), "token");
    }

    #[test]
    fn rejects_missing_authorization() {
        let request = actix_test::TestRequest::default().to_http_request();
        assert!(matches!(
            bearer_token(&request),
            Err(AuthError::MissingAuthorization)
        ));
    }

    #[test]
    fn rejects_non_bearer_authorization() {
        let request = actix_test::TestRequest::default()
            .insert_header(("authorization", "Basic token"))
            .to_http_request();
        assert!(matches!(
            bearer_token(&request),
            Err(AuthError::InvalidAuthorization)
        ));
    }
}
