use actix_web::{
    HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, patch, post, web,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Serialize, FromRow)]
pub struct Organization {
    id: Uuid,
    owner_id: Uuid,
    owner_username: String,
    slug: String,
    display_name: String,
    description: Option<String>,
    website_url: Option<String>,
    logo_url: Option<String>,
    verification_status: String,
    verified_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct OrganizationInput {
    slug: String,
    display_name: String,
    description: Option<String>,
    website_url: Option<String>,
    logo_url: Option<String>,
}

impl OrganizationInput {
    fn validate(&self) -> Result<(), OrganizationError> {
        let slug = self.slug.trim();
        let valid_slug = (3..=40).contains(&slug.len())
            && slug.chars().enumerate().all(|(index, character)| {
                character.is_ascii_lowercase()
                    || character.is_ascii_digit()
                    || (character == '-' && index > 0)
            })
            && !slug.ends_with('-');
        let valid_https = |value: &Option<String>| {
            value.as_deref().is_none_or(|url| {
                let url = url.trim();
                url.is_empty() || (url.starts_with("https://") && url.chars().count() <= 2048)
            })
        };
        if !valid_slug
            || !(2..=100).contains(&self.display_name.trim().chars().count())
            || self
                .description
                .as_deref()
                .is_some_and(|value| !(3..=500).contains(&value.trim().chars().count()))
            || !valid_https(&self.website_url)
            || !valid_https(&self.logo_url)
        {
            return Err(OrganizationError::InvalidOrganization);
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, FromRow)]
pub struct OrganizationAnalytics {
    active_quests: i64,
    entries_received: i64,
    valid_submissions: i64,
    winners_selected: i64,
    rewards_paid_minor: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct OrganizationQuest {
    id: Uuid,
    title: String,
    quest_type: String,
    status: String,
    cover_media_url: Option<String>,
    deadline: DateTime<Utc>,
    reward_enabled: bool,
    reward_amount_minor: Option<i64>,
    entries_received: i64,
}

#[derive(Debug, Error)]
pub enum OrganizationError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("business profile was not found")]
    NotFound,
    #[error("business profile details are invalid")]
    InvalidOrganization,
    #[error("a business profile or slug already exists")]
    Conflict,
    #[error("only the business owner can perform this action")]
    NotOwner,
    #[error("business profile service is temporarily unavailable")]
    Database,
}

impl ResponseError for OrganizationError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::InvalidOrganization => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Conflict => StatusCode::CONFLICT,
            Self::NotOwner => StatusCode::FORBIDDEN,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "organization_not_found",
                Self::InvalidOrganization => "invalid_organization",
                Self::Conflict => "organization_conflict",
                Self::NotOwner => "not_organization_owner",
                Self::Database => "organization_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

fn normalize_optional(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

async fn find_organization(
    state: &AppState,
    slug: &str,
    viewer_id: Option<Uuid>,
) -> Result<Organization, OrganizationError> {
    sqlx::query_as::<_, Organization>(
        r#"
        select organization.id, organization.owner_id, owner.username as owner_username,
               organization.slug, organization.display_name, organization.description,
               organization.website_url, organization.logo_url,
               organization.verification_status, organization.verified_at,
               organization.created_at
        from public.organizations organization
        join public.users owner on owner.id = organization.owner_id
        where organization.slug = $1
          and (organization.verification_status = 'VERIFIED' or organization.owner_id = $2)
        "#,
    )
    .bind(slug)
    .bind(viewer_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| OrganizationError::Database)?
    .ok_or(OrganizationError::NotFound)
}

#[post("/organizations")]
pub async fn create_organization(
    request: HttpRequest,
    state: web::Data<AppState>,
    input: web::Json<OrganizationInput>,
) -> Result<(web::Json<Organization>, StatusCode), OrganizationError> {
    input.validate()?;
    let user = state.auth.authenticate(&request).await?;
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| OrganizationError::Database)?;
    let id = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.organizations
          (owner_id, slug, display_name, description, website_url, logo_url)
        values ($1, $2, $3, $4, $5, $6)
        returning id
        "#,
    )
    .bind(user.id)
    .bind(input.slug.trim())
    .bind(input.display_name.trim())
    .bind(normalize_optional(input.description.as_deref()))
    .bind(normalize_optional(input.website_url.as_deref()))
    .bind(normalize_optional(input.logo_url.as_deref()))
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| {
        if error
            .as_database_error()
            .and_then(|value| value.code())
            .as_deref()
            == Some("23505")
        {
            OrganizationError::Conflict
        } else {
            OrganizationError::Database
        }
    })?;
    sqlx::query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'OWNER')")
        .bind(id)
        .bind(user.id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| OrganizationError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| OrganizationError::Database)?;
    let organization = find_organization(&state, input.slug.trim(), Some(user.id)).await?;
    Ok((web::Json(organization), StatusCode::CREATED))
}

#[get("/users/me/organization")]
pub async fn get_my_organization(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Organization>, OrganizationError> {
    let user = state.auth.authenticate(&request).await?;
    let slug = sqlx::query_scalar::<_, String>(
        "select slug from public.organizations where owner_id = $1",
    )
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| OrganizationError::Database)?
    .ok_or(OrganizationError::NotFound)?;
    Ok(web::Json(
        find_organization(&state, &slug, Some(user.id)).await?,
    ))
}

#[get("/organizations/{slug}")]
pub async fn get_organization(
    request: HttpRequest,
    state: web::Data<AppState>,
    slug: web::Path<String>,
) -> Result<web::Json<Organization>, OrganizationError> {
    let viewer = state.auth.authenticate_optional(&request).await?;
    Ok(web::Json(
        find_organization(&state, &slug, viewer.map(|user| user.id)).await?,
    ))
}

#[get("/organizations/{slug}/quests")]
pub async fn list_organization_quests(
    state: web::Data<AppState>,
    slug: web::Path<String>,
) -> Result<web::Json<Vec<OrganizationQuest>>, OrganizationError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "select exists(select 1 from public.organizations where slug = $1 and verification_status = 'VERIFIED')",
    )
    .bind(slug.as_str())
    .fetch_one(&state.database)
    .await
    .map_err(|_| OrganizationError::Database)?;
    if !exists {
        return Err(OrganizationError::NotFound);
    }
    let quests = sqlx::query_as::<_, OrganizationQuest>(
        r#"
        select q.id, q.title, q.quest_type::text as quest_type,
               q.status::text as status, q.cover_media_url, q.deadline,
               q.reward_enabled, q.reward_amount_minor,
               (select count(*) from public.quest_entries entry where entry.quest_id = q.id) as entries_received
        from public.quests q
        join public.organizations organization on organization.id = q.organization_id
        where organization.slug = $1
          and q.visibility = 'PUBLIC'
          and q.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED')
        order by q.published_at desc nulls last
        limit 50
        "#,
    )
    .bind(slug.as_str())
    .fetch_all(&state.database)
    .await
    .map_err(|_| OrganizationError::Database)?;
    Ok(web::Json(quests))
}

#[patch("/organizations/{id}")]
pub async fn update_organization(
    request: HttpRequest,
    state: web::Data<AppState>,
    id: web::Path<Uuid>,
    input: web::Json<OrganizationInput>,
) -> Result<web::Json<Organization>, OrganizationError> {
    input.validate()?;
    let user = state.auth.authenticate(&request).await?;
    let updated = sqlx::query_scalar::<_, String>(
        r#"
        update public.organizations
        set slug = $3, display_name = $4, description = $5,
            website_url = $6, logo_url = $7, updated_at = now()
        where id = $1 and owner_id = $2
        returning slug
        "#,
    )
    .bind(id.into_inner())
    .bind(user.id)
    .bind(input.slug.trim())
    .bind(input.display_name.trim())
    .bind(normalize_optional(input.description.as_deref()))
    .bind(normalize_optional(input.website_url.as_deref()))
    .bind(normalize_optional(input.logo_url.as_deref()))
    .fetch_optional(&state.database)
    .await
    .map_err(|error| {
        if error
            .as_database_error()
            .and_then(|value| value.code())
            .as_deref()
            == Some("23505")
        {
            OrganizationError::Conflict
        } else {
            OrganizationError::Database
        }
    })?
    .ok_or(OrganizationError::NotOwner)?;
    Ok(web::Json(
        find_organization(&state, &updated, Some(user.id)).await?,
    ))
}

#[get("/organizations/{id}/analytics")]
pub async fn get_organization_analytics(
    request: HttpRequest,
    state: web::Data<AppState>,
    id: web::Path<Uuid>,
) -> Result<web::Json<OrganizationAnalytics>, OrganizationError> {
    let user = state.auth.authenticate(&request).await?;
    let analytics = sqlx::query_as::<_, OrganizationAnalytics>(
        r#"
        select count(*) filter (where q.status in ('OPEN', 'AWAITING_FUNDING')) as active_quests,
               coalesce(sum((select count(*) from public.quest_entries entry where entry.quest_id = q.id)), 0)::bigint as entries_received,
               coalesce(sum((select count(*) from public.entry_reviews review join public.quest_entries entry on entry.id = review.entry_id where entry.quest_id = q.id and review.is_valid)), 0)::bigint as valid_submissions,
               coalesce(sum((select count(*) from public.quest_winners winner where winner.quest_id = q.id)), 0)::bigint as winners_selected,
               coalesce(sum((select coalesce(sum(payout.amount_minor), 0) from public.payouts payout join public.reward_allocations allocation on allocation.id = payout.reward_allocation_id join public.reward_pools pool on pool.id = allocation.reward_pool_id where pool.quest_id = q.id and payout.status = 'CONFIRMED')), 0)::bigint as rewards_paid_minor
        from public.organizations organization
        left join public.quests q on q.organization_id = organization.id
        where organization.id = $1 and organization.owner_id = $2
        group by organization.id
        "#,
    )
    .bind(id.into_inner())
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| OrganizationError::Database)?
    .ok_or(OrganizationError::NotOwner)?;
    Ok(web::Json(analytics))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_business_identity_and_https_links() {
        let valid = OrganizationInput {
            slug: "brew-and-co".to_string(),
            display_name: "Brew & Co.".to_string(),
            description: Some("A neighborhood coffee community.".to_string()),
            website_url: Some("https://example.com".to_string()),
            logo_url: None,
        };
        assert!(valid.validate().is_ok());

        let invalid = OrganizationInput {
            slug: "Brew & Co".to_string(),
            ..valid
        };
        assert!(matches!(
            invalid.validate(),
            Err(OrganizationError::InvalidOrganization)
        ));
    }
}
