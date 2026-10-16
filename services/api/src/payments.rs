use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, post, put, web};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::time::Duration as StdDuration;
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
    #[error("funding intent has expired")]
    IntentExpired,
    #[error("Nimiq transaction hash is invalid")]
    InvalidTransaction,
    #[error("transaction does not match this funding intent")]
    TransactionMismatch,
    #[error("transaction is already assigned to another funding intent")]
    TransactionAlreadyUsed,
    #[error("Nimiq verification is temporarily unavailable")]
    VerifierUnavailable,
    #[error("funding service is temporarily unavailable")]
    Database,
    #[error("Nimiq payout address is invalid")]
    InvalidPayoutAddress,
    #[error("payout destination was not found")]
    PayoutDestinationNotFound,
}

impl ResponseError for FundingError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound | Self::IntentNotFound => StatusCode::NOT_FOUND,
            Self::PayoutDestinationNotFound => StatusCode::NOT_FOUND,
            Self::NotCreator => StatusCode::FORBIDDEN,
            Self::IntentExpired => StatusCode::GONE,
            Self::InvalidTransaction | Self::TransactionMismatch | Self::InvalidPayoutAddress => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            Self::NotAwaitingFunding | Self::InvalidReward | Self::TransactionAlreadyUsed => {
                StatusCode::CONFLICT
            }
            Self::NotConfigured | Self::VerifierUnavailable | Self::Database => {
                StatusCode::SERVICE_UNAVAILABLE
            }
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
                Self::IntentExpired => "funding_intent_expired",
                Self::InvalidTransaction => "invalid_nimiq_transaction",
                Self::TransactionMismatch => "funding_transaction_mismatch",
                Self::TransactionAlreadyUsed => "funding_transaction_already_used",
                Self::VerifierUnavailable => "nimiq_verifier_unavailable",
                Self::Database => "funding_service_unavailable",
                Self::InvalidPayoutAddress => "invalid_payout_address",
                Self::PayoutDestinationNotFound => "payout_destination_not_found",
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

#[derive(Debug, FromRow)]
struct FundingVerificationContext {
    id: Uuid,
    reward_pool_id: Uuid,
    quest_id: Uuid,
    amount_luna: i64,
    status: String,
    network: String,
    treasury_address: String,
    payment_reference: String,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitFundingTransaction {
    transaction_hash: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VerifiedTransaction {
    transaction_hash: String,
    state: String,
    sender: String,
    recipient: String,
    value_luna: i64,
    reference: String,
    network: String,
    confirmations: i32,
    block_height: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct FundingVerificationResult {
    intent: FundingIntent,
    transaction: VerifiedTransaction,
    quest_opened: bool,
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

#[derive(Debug, Deserialize)]
pub struct SetPayoutDestination {
    address: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PayoutDestination {
    network: String,
    address: String,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PayoutSummary {
    id: Uuid,
    quest_id: Uuid,
    quest_title: String,
    amount_luna: i64,
    amount_nim: String,
    status: String,
    network: String,
    destination_address: String,
    transaction_hash: Option<String>,
    submitted_at: Option<DateTime<Utc>>,
    confirmed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct StoredPayoutSummary {
    id: Uuid,
    quest_id: Uuid,
    quest_title: String,
    amount_luna: i64,
    status: String,
    network: String,
    destination_address: String,
    transaction_hash: Option<String>,
    submitted_at: Option<DateTime<Utc>>,
    confirmed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    created_at: DateTime<Utc>,
}

impl StoredPayoutSummary {
    fn into_response(self) -> PayoutSummary {
        PayoutSummary {
            id: self.id,
            quest_id: self.quest_id,
            quest_title: self.quest_title,
            amount_luna: self.amount_luna,
            amount_nim: format_luna(self.amount_luna),
            status: self.status,
            network: self.network,
            destination_address: self.destination_address,
            transaction_hash: self.transaction_hash,
            submitted_at: self.submitted_at,
            confirmed_at: self.confirmed_at,
            failure_reason: self.failure_reason,
            created_at: self.created_at,
        }
    }
}

#[get("/users/me/payout-destination")]
pub async fn get_payout_destination(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<PayoutDestination>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let destination = sqlx::query_as::<_, PayoutDestination>(
        r#"
        select network, address, updated_at
        from public.user_payout_destinations
        where user_id = $1 and network = 'testnet'
        "#,
    )
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::PayoutDestinationNotFound)?;
    Ok(web::Json(destination))
}

#[put("/users/me/payout-destination")]
pub async fn set_payout_destination(
    request: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<SetPayoutDestination>,
) -> Result<web::Json<PayoutDestination>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let address = format_nimiq_address(&body.address).ok_or(FundingError::InvalidPayoutAddress)?;
    let destination = sqlx::query_as::<_, PayoutDestination>(
        r#"
        insert into public.user_payout_destinations (user_id, network, address)
        values ($1, 'testnet', $2)
        on conflict (user_id) do update
          set network = excluded.network,
              address = excluded.address,
              updated_at = now()
        returning network, address, updated_at
        "#,
    )
    .bind(user.id)
    .bind(address)
    .fetch_one(&state.database)
    .await
    .map_err(|_| FundingError::Database)?;
    Ok(web::Json(destination))
}

#[get("/users/me/payouts")]
pub async fn list_my_payouts(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<PayoutSummary>>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let payouts = sqlx::query_as::<_, StoredPayoutSummary>(
        r#"
        select p.id,
               q.id as quest_id,
               q.title as quest_title,
               p.amount_minor as amount_luna,
               p.status::text as status,
               p.network,
               p.destination_address,
               p.transaction_hash,
               p.submitted_at,
               p.confirmed_at,
               p.failure_reason,
               p.created_at
        from public.payouts p
        join public.reward_allocations ra on ra.id = p.reward_allocation_id
        join public.quest_winners qw on qw.id = ra.winner_id
        join public.quests q on q.id = qw.quest_id
        where p.recipient_id = $1
        order by p.created_at desc, p.id desc
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| FundingError::Database)?;
    Ok(web::Json(
        payouts
            .into_iter()
            .map(StoredPayoutSummary::into_response)
            .collect(),
    ))
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

#[post("/funding-intents/{intent_id}/transactions")]
pub async fn submit_funding_transaction(
    request: HttpRequest,
    state: web::Data<AppState>,
    intent_id: web::Path<Uuid>,
    body: web::Json<SubmitFundingTransaction>,
) -> Result<web::Json<FundingVerificationResult>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let config = state.payments.as_ref().ok_or(FundingError::NotConfigured)?;
    let transaction_hash = body.transaction_hash.trim();
    if transaction_hash.is_empty()
        || transaction_hash.len() > 128
        || !transaction_hash
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(FundingError::InvalidTransaction);
    }

    let context = load_verification_context(&state, intent_id.into_inner(), user.id).await?;
    ensure_verifiable(&context)?;
    let receipt = verifier_submit(config, transaction_hash, &context).await?;
    verify_receipt(&receipt, &context)?;
    let quest_opened = persist_receipt(&state, config, &context, &receipt).await?;
    let intent = load_stored_intent(&state, context.id, user.id).await?;

    Ok(web::Json(FundingVerificationResult {
        intent: intent.into_response(config.min_confirmations),
        transaction: receipt,
        quest_opened,
    }))
}

#[post("/funding-intents/{intent_id}/refresh")]
pub async fn refresh_funding_transaction(
    request: HttpRequest,
    state: web::Data<AppState>,
    intent_id: web::Path<Uuid>,
) -> Result<web::Json<FundingVerificationResult>, FundingError> {
    let user = state.auth.authenticate(&request).await?;
    let config = state.payments.as_ref().ok_or(FundingError::NotConfigured)?;
    let context = load_verification_context(&state, intent_id.into_inner(), user.id).await?;
    if context.status == "CONFIRMED" {
        let receipt = load_latest_receipt(&state, context.id).await?;
        let intent = load_stored_intent(&state, context.id, user.id).await?;
        return Ok(web::Json(FundingVerificationResult {
            intent: intent.into_response(config.min_confirmations),
            transaction: receipt,
            quest_opened: true,
        }));
    }
    ensure_verifiable(&context)?;
    let prior = load_latest_receipt(&state, context.id).await?;
    let receipt = verifier_lookup(config, &prior.transaction_hash).await?;
    verify_receipt(&receipt, &context)?;
    let quest_opened = persist_receipt(&state, config, &context, &receipt).await?;
    let intent = load_stored_intent(&state, context.id, user.id).await?;

    Ok(web::Json(FundingVerificationResult {
        intent: intent.into_response(config.min_confirmations),
        transaction: receipt,
        quest_opened,
    }))
}

async fn load_stored_intent(
    state: &AppState,
    intent_id: Uuid,
    creator_id: Uuid,
) -> Result<StoredFundingIntent, FundingError> {
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
        where pi.id = $1 and pi.creator_id = $2
        "#,
    )
    .bind(intent_id)
    .bind(creator_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::IntentNotFound)
}

async fn load_verification_context(
    state: &AppState,
    intent_id: Uuid,
    creator_id: Uuid,
) -> Result<FundingVerificationContext, FundingError> {
    sqlx::query_as::<_, FundingVerificationContext>(
        r#"
        select pi.id,
               pi.reward_pool_id,
               rp.quest_id,
               pi.amount_minor as amount_luna,
               pi.status::text as status,
               pi.network,
               pi.recipient_address as treasury_address,
               pi.payment_reference,
               pi.expires_at
        from public.payment_intents pi
        join public.reward_pools rp on rp.id = pi.reward_pool_id
        where pi.id = $1 and pi.creator_id = $2
        "#,
    )
    .bind(intent_id)
    .bind(creator_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::IntentNotFound)
}

fn ensure_verifiable(context: &FundingVerificationContext) -> Result<(), FundingError> {
    if context.expires_at <= Utc::now() {
        return Err(FundingError::IntentExpired);
    }
    if !matches!(context.status.as_str(), "CREATED" | "PENDING") {
        return Err(FundingError::NotAwaitingFunding);
    }
    Ok(())
}

async fn verifier_submit(
    config: &crate::PaymentConfig,
    transaction_hash: &str,
    context: &FundingVerificationContext,
) -> Result<VerifiedTransaction, FundingError> {
    let request = verifier_client()?
        .post(format!("{}/transactions", config.verifier_url))
        .json(&serde_json::json!({
            "transaction_hash": transaction_hash,
            "recipient": context.treasury_address,
            "value_luna": context.amount_luna,
            "reference": context.payment_reference,
        }));
    send_verifier_request(request, config.verifier_token.as_deref()).await
}

async fn verifier_lookup(
    config: &crate::PaymentConfig,
    transaction_hash: &str,
) -> Result<VerifiedTransaction, FundingError> {
    if transaction_hash.is_empty()
        || transaction_hash.len() > 128
        || !transaction_hash
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(FundingError::InvalidTransaction);
    }
    let request = verifier_client()?.get(format!(
        "{}/transactions/{transaction_hash}",
        config.verifier_url
    ));
    send_verifier_request(request, config.verifier_token.as_deref()).await
}

fn verifier_client() -> Result<reqwest::Client, FundingError> {
    reqwest::Client::builder()
        .timeout(StdDuration::from_secs(15))
        .build()
        .map_err(|_| FundingError::VerifierUnavailable)
}

async fn send_verifier_request(
    mut request: reqwest::RequestBuilder,
    token: Option<&str>,
) -> Result<VerifiedTransaction, FundingError> {
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .await
        .map_err(|_| FundingError::VerifierUnavailable)?;
    if response.status().is_server_error() {
        return Err(FundingError::VerifierUnavailable);
    }
    if !response.status().is_success() {
        return Err(FundingError::InvalidTransaction);
    }
    response
        .json::<VerifiedTransaction>()
        .await
        .map_err(|_| FundingError::VerifierUnavailable)
}

fn verify_receipt(
    receipt: &VerifiedTransaction,
    context: &FundingVerificationContext,
) -> Result<(), FundingError> {
    let recipient = receipt.recipient.split_whitespace().collect::<String>();
    let treasury = context
        .treasury_address
        .split_whitespace()
        .collect::<String>();
    if receipt.network != "TestAlbatross"
        || context.network != "testnet"
        || recipient != treasury
        || receipt.value_luna != context.amount_luna
        || receipt.reference != context.payment_reference
        || receipt.transaction_hash.is_empty()
    {
        return Err(FundingError::TransactionMismatch);
    }
    Ok(())
}

async fn persist_receipt(
    state: &AppState,
    config: &crate::PaymentConfig,
    context: &FundingVerificationContext,
    receipt: &VerifiedTransaction,
) -> Result<bool, FundingError> {
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| FundingError::Database)?;
    let current_status = sqlx::query_scalar::<_, String>(
        "select status::text from public.payment_intents where id = $1 for update",
    )
    .bind(context.id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::IntentNotFound)?;

    if current_status == "CONFIRMED" {
        transaction
            .commit()
            .await
            .map_err(|_| FundingError::Database)?;
        return Ok(true);
    }

    let recorded = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.payment_transactions (
          payment_intent_id, provider_reference, transaction_hash, amount_minor,
          settlement_asset, network, confirmations, verified_at, raw_receipt
        )
        values ($1, $2, $2, $3, 'NIM', 'testnet', $4, $5, $6)
        on conflict (provider_reference) do update
          set confirmations = excluded.confirmations,
              verified_at = excluded.verified_at,
              raw_receipt = excluded.raw_receipt
          where public.payment_transactions.payment_intent_id = excluded.payment_intent_id
        returning id
        "#,
    )
    .bind(context.id)
    .bind(&receipt.transaction_hash)
    .bind(context.amount_luna)
    .bind(receipt.confirmations.max(0))
    .bind(if receipt.state == "confirmed" {
        Some(Utc::now())
    } else {
        None
    })
    .bind(serde_json::to_value(receipt).map_err(|_| FundingError::Database)?)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| FundingError::Database)?;
    if recorded.is_none() {
        return Err(FundingError::TransactionAlreadyUsed);
    }

    let confirmed =
        receipt.state == "confirmed" && receipt.confirmations >= config.min_confirmations;
    if confirmed {
        sqlx::query(
            "update public.payment_intents set status = 'CONFIRMED', updated_at = now() where id = $1",
        )
        .bind(context.id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
        sqlx::query(
            "update public.reward_pools set funded_at = coalesce(funded_at, now()) where id = $1",
        )
        .bind(context.reward_pool_id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
        sqlx::query(
            r#"
            update public.quests
            set status = 'OPEN', published_at = coalesce(published_at, now()), updated_at = now()
            where id = $1 and status = 'AWAITING_FUNDING'
            "#,
        )
        .bind(context.quest_id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
    } else if matches!(receipt.state.as_str(), "invalidated" | "expired") {
        sqlx::query(
            "update public.payment_intents set status = 'FAILED', updated_at = now() where id = $1",
        )
        .bind(context.id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
    } else {
        sqlx::query(
            "update public.payment_intents set status = 'PENDING', updated_at = now() where id = $1 and status = 'CREATED'",
        )
        .bind(context.id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| FundingError::Database)?;
    }

    transaction
        .commit()
        .await
        .map_err(|_| FundingError::Database)?;
    Ok(confirmed)
}

async fn load_latest_receipt(
    state: &AppState,
    intent_id: Uuid,
) -> Result<VerifiedTransaction, FundingError> {
    let receipt = sqlx::query_scalar::<_, serde_json::Value>(
        r#"
        select raw_receipt
        from public.payment_transactions
        where payment_intent_id = $1
        order by created_at desc
        limit 1
        "#,
    )
    .bind(intent_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| FundingError::Database)?
    .ok_or(FundingError::InvalidTransaction)?;
    serde_json::from_value(receipt).map_err(|_| FundingError::Database)
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

pub(crate) fn format_luna(amount_luna: i64) -> String {
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
        .map(|character| character.to_ascii_uppercase())
        .collect();
    if compact.len() != 36
        || !compact.starts_with("NQ")
        || !compact.chars().all(|character| {
            character.is_ascii_digit() || "ABCDEFGHJKLMNPQRSTUVXY".contains(character)
        })
    {
        return false;
    }

    let rearranged = format!("{}{}", &compact[4..], &compact[..4]);
    let mut remainder = 0_u32;
    for character in rearranged.chars() {
        let value = if character.is_ascii_digit() {
            character.to_digit(10).expect("digit checked").to_string()
        } else {
            (character as u32 - 'A' as u32 + 10).to_string()
        };
        for digit in value.bytes() {
            remainder = (remainder * 10 + u32::from(digit - b'0')) % 97;
        }
    }
    remainder == 1
}

pub fn format_nimiq_address(address: &str) -> Option<String> {
    let compact: String = address
        .chars()
        .filter(|character| !character.is_whitespace())
        .map(|character| character.to_ascii_uppercase())
        .collect();
    if !is_valid_nimiq_address(&compact) {
        return None;
    }
    Some(
        compact
            .as_bytes()
            .chunks(4)
            .map(|chunk| std::str::from_utf8(chunk).expect("ASCII address"))
            .collect::<Vec<_>>()
            .join(" "),
    )
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
    fn normalizes_a_valid_compact_payout_address() {
        assert_eq!(
            format_nimiq_address("nq24vu9v76nvsrfaqvgjje50139q3u38dun0").as_deref(),
            Some("NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0")
        );
    }

    #[test]
    fn rejects_placeholder_or_malformed_addresses() {
        assert!(!is_valid_nimiq_address("NQ00_REPLACE_ME"));
        assert!(!is_valid_nimiq_address("0x1234"));
        assert!(!is_valid_nimiq_address(
            "NQ25 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0"
        ));
    }

    fn verification_context() -> FundingVerificationContext {
        FundingVerificationContext {
            id: Uuid::new_v4(),
            reward_pool_id: Uuid::new_v4(),
            quest_id: Uuid::new_v4(),
            amount_luna: 1_000_000,
            status: "PENDING".to_string(),
            network: "testnet".to_string(),
            treasury_address: "NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0".to_string(),
            payment_reference: "SQF:0123456789abcdef".to_string(),
            expires_at: Utc::now() + Duration::minutes(10),
        }
    }

    fn verified_receipt() -> VerifiedTransaction {
        VerifiedTransaction {
            transaction_hash: "abcdef123456".to_string(),
            state: "included".to_string(),
            sender: "NQ00 0000 0000 0000 0000 0000 0000 0000 0000".to_string(),
            recipient: "NQ24VU9V76NVSRFAQVGJJE50139Q3U38DUN0".to_string(),
            value_luna: 1_000_000,
            reference: "SQF:0123456789abcdef".to_string(),
            network: "TestAlbatross".to_string(),
            confirmations: 1,
            block_height: Some(42),
        }
    }

    #[test]
    fn accepts_a_receipt_that_exactly_matches_the_intent() {
        assert!(verify_receipt(&verified_receipt(), &verification_context()).is_ok());
    }

    #[test]
    fn rejects_a_receipt_with_a_different_amount() {
        let mut receipt = verified_receipt();
        receipt.value_luna -= 1;
        assert!(matches!(
            verify_receipt(&receipt, &verification_context()),
            Err(FundingError::TransactionMismatch)
        ));
    }
}
