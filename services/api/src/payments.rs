use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, post, web};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentStatus {
    Created,
    Pending,
    Confirmed,
    Failed,
    Expired,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PayoutStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PaymentStateError {
    #[error("payment status transition is not permitted")]
    InvalidTransition,
    #[error("quest funding is not verified")]
    FundingNotVerified,
    #[error("a payout with this idempotency key already exists")]
    DuplicatePayout,
}

#[derive(Debug, Error)]
pub enum FundingError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("quest was not found")]
    NotFound,
    #[error("only the quest creator can fund this quest")]
    NotCreator,
    #[error("quest is not awaiting reward funding")]
    NotAwaitingFunding,
    #[error("quest reward metadata is invalid")]
    InvalidReward,
    #[error("Nimiq testnet funding is not configured")]
    NotConfigured,
    #[error("funding intent was not found")]
    IntentNotFound,
    #[error("funding service is temporarily unavailable")]
    Database,
}

impl ResponseError for FundingError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound | Self::IntentNotFound => StatusCode::NOT_FOUND,
            Self::NotCreator => StatusCode::FORBIDDEN,
            Self::NotAwaitingFunding | Self::InvalidReward => StatusCode::CONFLICT,
            Self::NotConfigured | Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }

        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "quest_not_found",
                Self::NotCreator => "not_quest_creator",
                Self::NotAwaitingFunding => "quest_not_awaiting_funding",
                Self::InvalidReward => "invalid_reward",
                Self::NotConfigured => "funding_not_configured",
                Self::IntentNotFound => "funding_intent_not_found",
                Self::Database => "funding_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[derive(Debug, FromRow)]
struct FundingQuest {
    creator_id: Uuid,
    status: String,
    reward_enabled: bool,
    reward_amount_minor: Option<i64>,
    reward_currency: Option<String>,
    settlement_asset: Option<String>,
    winner_count: i16,
}

#[derive(Debug, FromRow)]
struct StoredFundingIntent {
    id: Uuid,
    quest_id: Uuid,
    amount_luna: i64,
    status: String,
    network: String,
    treasury_address: String,
    payment_reference: String,
    expires_at: DateTime<Utc>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FundingIntent {
    id: Uuid,
    quest_id: Uuid,
    amount_luna: i64,
    amount_nim: String,
    status: String,
    network: String,
    treasury_address: String,
    payment_reference: String,
    minimum_confirmations: i32,
    expires_at: DateTime<Utc>,
    created_at: DateTime<Utc>,
}

impl StoredFundingIntent {
    fn into_response(self, minimum_confirmations: i32) -> FundingIntent {
        FundingIntent {
            id: self.id,
            quest_id: self.quest_id,
            amount_luna: self.amount_luna,
            amount_nim: format_luna(self.amount_luna),
            status: self.status,
            network: self.network,
            treasury_address: self.treasury_address,
            payment_reference: self.payment_reference,
            minimum_confirmations,
            expires_at: self.expires_at,
            created_at: self.created_at,
        }
    }
}

#[post("/quests/{quest_id}/funding-intents")]
pub async fn create_funding_intent(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<(web::Json<FundingIntent>, StatusCode), FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let config = state.payments.as_ref().ok_or(FundingError::NotConfigured)?;
    let quest_id = quest_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| FundingError::Database)?;

    let quest = sqlx::query_as::<_, FundingQuest>(
        r#"
        select creator_id,
               status::text as status,
               reward_enabled,
               reward_amount_minor,
               reward_currency::text as reward_currency,
               settlement_asset,
               winner_count
        from public.quests
        where id = $1
        for update
        "#,
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::NotFound)?;

    if quest.creator_id != user.id {
        return Err(FundingError::NotCreator);
    }
    if quest.status != "AWAITING_FUNDING" {
        return Err(FundingError::NotAwaitingFunding);
    }
    if !quest.reward_enabled
        || quest.reward_currency.as_deref() != Some("NIM")
        || quest.settlement_asset.as_deref() != Some("NIM")
    {
        return Err(FundingError::InvalidReward);
    }

    let amount_luna = quest
        .reward_amount_minor
        .and_then(|amount| amount.checked_mul(i64::from(quest.winner_count)))
        .filter(|amount| *amount > 0)
        .ok_or(FundingError::InvalidReward)?;

    let reward_pool_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.reward_pools (quest_id, amount_minor, currency, settlement_asset)
        values ($1, $2, 'NIM', 'NIM')
        on conflict (quest_id) do update
          set amount_minor = excluded.amount_minor,
              currency = excluded.currency,
              settlement_asset = excluded.settlement_asset
          where public.reward_pools.funded_at is null
        returning id
        "#,
    )
    .bind(quest_id)
    .bind(amount_luna)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::InvalidReward)?;

    sqlx::query(
        r#"
        update public.payment_intents
        set status = 'EXPIRED', updated_at = now()
        where reward_pool_id = $1
          and status in ('CREATED', 'PENDING')
          and expires_at <= now()
        "#,
    )
    .bind(reward_pool_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| FundingError::Database)?;

    let existing = find_active_intent(&mut transaction, reward_pool_id).await?;
    let (intent, created) = if let Some(intent) = existing {
        (intent, false)
    } else {
        let intent_id = Uuid::new_v4();
        let payment_reference = funding_reference(intent_id);
        let expires_at = Utc::now() + Duration::minutes(30);
        let intent = sqlx::query_as::<_, StoredFundingIntent>(
            r#"
            insert into public.payment_intents (
              id, reward_pool_id, creator_id, amount_minor, currency,
              settlement_asset, network, status, idempotency_key, expires_at,
              recipient_address, payment_reference
            )
            values ($1, $2, $3, $4, 'NIM', 'NIM', $5, 'CREATED', $6, $7, $8, $9)
            returning id,
                      $10::uuid as quest_id,
                      amount_minor as amount_luna,
                      status::text as status,
                      network,
                      recipient_address as treasury_address,
                      payment_reference,
                      expires_at,
                      created_at
            "#,
        )
        .bind(intent_id)
        .bind(reward_pool_id)
        .bind(user.id)
        .bind(amount_luna)
        .bind(&config.network)
        .bind(format!("funding:{quest_id}:{intent_id}"))
        .bind(expires_at)
        .bind(&config.treasury_address)
        .bind(payment_reference)
        .bind(quest_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
        (intent, true)
    };

    transaction
        .commit()
        .await
        .map_err(|_| FundingError::Database)?;
    Ok((
        web::Json(intent.into_response(config.min_confirmations)),
        if created {
            StatusCode::CREATED
        } else {
            StatusCode::OK
        },
    ))
}

#[get("/funding-intents/{intent_id}")]
pub async fn get_funding_intent(
    request: HttpRequest,
    state: web::Data<AppState>,
    intent_id: web::Path<Uuid>,
) -> Result<web::Json<FundingIntent>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let config = state.payments.as_ref().ok_or(FundingError::NotConfigured)?;
    let intent = sqlx::query_as::<_, StoredFundingIntent>(
        r#"
        select pi.id,
               rp.quest_id,
               pi.amount_minor as amount_luna,
               pi.status::text as status,
               pi.network,
               pi.recipient_address as treasury_address,
               pi.payment_reference,
               pi.expires_at,
               pi.created_at
        from public.payment_intents pi
        join public.reward_pools rp on rp.id = pi.reward_pool_id
        where pi.id = $1 and pi.creator_id = $2
        "#,
    )
    .bind(intent_id.into_inner())
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::IntentNotFound)?;

    Ok(web::Json(intent.into_response(config.min_confirmations)))
}

async fn find_active_intent(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    reward_pool_id: Uuid,
) -> Result<Option<StoredFundingIntent>, FundingError> {
    sqlx::query_as::<_, StoredFundingIntent>(
        r#"
        select pi.id,
               rp.quest_id,
               pi.amount_minor as amount_luna,
               pi.status::text as status,
               pi.network,
               pi.recipient_address as treasury_address,
               pi.payment_reference,
               pi.expires_at,
               pi.created_at
        from public.payment_intents pi
        join public.reward_pools rp on rp.id = pi.reward_pool_id
        where pi.reward_pool_id = $1
          and pi.status in ('CREATED', 'PENDING')
          and pi.expires_at > now()
        order by pi.created_at desc
        limit 1
        "#,
    )
    .bind(reward_pool_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|_| FundingError::Database)
}

fn funding_reference(intent_id: Uuid) -> String {
    format!("SQF:{}", intent_id.simple())
}

fn format_luna(amount_luna: i64) -> String {
    let nim = amount_luna / 100_000;
    let luna = amount_luna % 100_000;
    if luna == 0 {
        return nim.to_string();
    }
    format!("{nim}.{luna:05}").trim_end_matches('0').to_string()
}

pub fn is_valid_nimiq_address(address: &str) -> bool {
    let compact: String = address
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    compact.len() == 36
        && compact.starts_with("NQ")
        && compact
            .chars()
            .all(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
}

pub fn transition_payment(
    current: PaymentStatus,
    next: PaymentStatus,
) -> Result<PaymentStatus, PaymentStateError> {
    let allowed = matches!(
        (current, next),
        (PaymentStatus::Created, PaymentStatus::Pending)
            | (PaymentStatus::Created, PaymentStatus::Expired)
            | (PaymentStatus::Pending, PaymentStatus::Confirmed)
            | (PaymentStatus::Pending, PaymentStatus::Failed)
            | (PaymentStatus::Pending, PaymentStatus::Expired)
    );

    if allowed {
        Ok(next)
    } else {
        Err(PaymentStateError::InvalidTransition)
    }
}

pub fn funding_allows_quest_open(status: PaymentStatus) -> Result<(), PaymentStateError> {
    if status == PaymentStatus::Confirmed {
        Ok(())
    } else {
        Err(PaymentStateError::FundingNotVerified)
    }
}

pub fn authorize_payout(existing_idempotency_key: bool) -> Result<(), PaymentStateError> {
    if existing_idempotency_key {
        Err(PaymentStateError::DuplicatePayout)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirmed_funding_allows_a_quest_to_open() {
        assert_eq!(funding_allows_quest_open(PaymentStatus::Confirmed), Ok(()));
    }

    #[test]
    fn failed_funding_cannot_open_a_quest() {
        assert_eq!(
            funding_allows_quest_open(PaymentStatus::Failed),
            Err(PaymentStateError::FundingNotVerified)
        );
    }

    #[test]
    fn a_confirmed_payment_cannot_move_back_to_pending() {
        assert_eq!(
            transition_payment(PaymentStatus::Confirmed, PaymentStatus::Pending),
            Err(PaymentStateError::InvalidTransition)
        );
    }

    #[test]
    fn a_pending_payment_can_be_confirmed_after_provider_verification() {
        assert_eq!(
            transition_payment(PaymentStatus::Pending, PaymentStatus::Confirmed),
            Ok(PaymentStatus::Confirmed)
        );
    }

    #[test]
    fn duplicate_payout_requests_are_rejected() {
        assert_eq!(
            authorize_payout(true),
            Err(PaymentStateError::DuplicatePayout)
        );
    }

    #[test]
    fn formats_luna_without_floating_point_rounding() {
        assert_eq!(format_luna(1_000_000), "10");
        assert_eq!(format_luna(1), "0.00001");
        assert_eq!(format_luna(1_234_500), "12.345");
    }

    #[test]
    fn accepts_the_configured_friendly_testnet_address() {
        assert!(is_valid_nimiq_address(
            "NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0"
        ));
    }

    #[test]
    fn rejects_placeholder_or_malformed_addresses() {
        assert!(!is_valid_nimiq_address("NQ00_REPLACE_ME"));
        assert!(!is_valid_nimiq_address("0x1234"));
    }
}
