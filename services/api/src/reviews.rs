use std::collections::HashSet;

use actix_web::{HttpRequest, HttpResponse, ResponseError, get, http::StatusCode, post, web};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError, payments::format_luna};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewedEntry {
    pub entry_id: Uuid,
    pub submitted_at: DateTime<Utc>,
    pub is_valid: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum FinalizationError {
    #[error("winner count must be between 1 and 3")]
    InvalidWinnerCount,
    #[error("a selected winner is not a valid entry")]
    InvalidWinnerSelection,
    #[error("the same entry cannot occupy multiple winning positions")]
    DuplicateWinner,
    #[error("the number of selected winners does not match the published rules")]
    WrongWinnerCount,
}

/// Calculates First Valid winners from trusted submission order.
///
/// `entry_id` is the deterministic tie-breaker if database timestamps are equal.
/// Creators can decide validity but cannot pass a preferred order into this function.
pub fn first_valid_winners(
    entries: &[ReviewedEntry],
    winner_count: u8,
) -> Result<Vec<Uuid>, FinalizationError> {
    validate_winner_count(winner_count)?;
    let mut qualifying: Vec<&ReviewedEntry> =
        entries.iter().filter(|entry| entry.is_valid).collect();
    qualifying.sort_by_key(|entry| (entry.submitted_at, entry.entry_id));

    Ok(qualifying
        .into_iter()
        .take(usize::from(winner_count))
        .map(|entry| entry.entry_id)
        .collect())
}

/// Validates creator-selected Best Submission winners against reviewed validity.
pub fn validate_best_submission_winners(
    entries: &[ReviewedEntry],
    selected_entry_ids: &[Uuid],
    winner_count: u8,
) -> Result<Vec<Uuid>, FinalizationError> {
    validate_winner_count(winner_count)?;
    let valid_ids: HashSet<Uuid> = entries
        .iter()
        .filter(|entry| entry.is_valid)
        .map(|entry| entry.entry_id)
        .collect();
    let selected_ids: HashSet<Uuid> = selected_entry_ids.iter().copied().collect();

    if selected_ids.len() != selected_entry_ids.len() {
        return Err(FinalizationError::DuplicateWinner);
    }
    let expected_count = usize::from(winner_count).min(valid_ids.len());
    if selected_entry_ids.len() != expected_count {
        return Err(FinalizationError::WrongWinnerCount);
    }
    if selected_entry_ids.iter().any(|id| !valid_ids.contains(id)) {
        return Err(FinalizationError::InvalidWinnerSelection);
    }
    Ok(selected_entry_ids.to_vec())
}

fn validate_winner_count(winner_count: u8) -> Result<(), FinalizationError> {
    if !(1..=3).contains(&winner_count) {
        return Err(FinalizationError::InvalidWinnerCount);
    }
    Ok(())
}

#[derive(Debug, Serialize, FromRow)]
pub struct CreatorEntry {
    id: Uuid,
    participant_id: Uuid,
    participant_username: String,
    participant_display_name: String,
    participant_avatar_url: Option<String>,
    caption: Option<String>,
    submitted_at: DateTime<Utc>,
    review_is_valid: Option<bool>,
    review_reason: Option<String>,
    evidence: Vec<EntryEvidence>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct EntryEvidence {
    proof_type: String,
    value: String,
}

#[derive(Debug, Deserialize)]
pub struct ReviewEntry {
    is_valid: bool,
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FinalizeQuest {
    #[serde(default)]
    winner_entry_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct FinalizedQuest {
    quest_id: Uuid,
    winner_entry_ids: Vec<Uuid>,
    status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct QuestSettlement {
    quest_id: Uuid,
    status: String,
    reward_enabled: bool,
    total_allocated_luna: i64,
    total_allocated_nim: String,
    payouts: Vec<CreatorPayout>,
}

#[derive(Debug, Serialize)]
pub struct CreatorPayout {
    id: Uuid,
    winner_position: i16,
    recipient_username: String,
    recipient_display_name: String,
    amount_luna: i64,
    amount_nim: String,
    network: String,
    destination_address: String,
    status: String,
    transaction_hash: Option<String>,
    submitted_at: Option<DateTime<Utc>>,
    confirmed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct StoredCreatorPayout {
    id: Uuid,
    winner_position: i16,
    recipient_username: String,
    recipient_display_name: String,
    amount_luna: i64,
    network: String,
    destination_address: String,
    status: String,
    transaction_hash: Option<String>,
    submitted_at: Option<DateTime<Utc>>,
    confirmed_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    created_at: DateTime<Utc>,
}

impl StoredCreatorPayout {
    fn into_response(self) -> CreatorPayout {
        CreatorPayout {
            id: self.id,
            winner_position: self.winner_position,
            recipient_username: self.recipient_username,
            recipient_display_name: self.recipient_display_name,
            amount_luna: self.amount_luna,
            amount_nim: format_luna(self.amount_luna),
            network: self.network,
            destination_address: self.destination_address,
            status: self.status,
            transaction_hash: self.transaction_hash,
            submitted_at: self.submitted_at,
            confirmed_at: self.confirmed_at,
            failure_reason: self.failure_reason,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, Error)]
pub enum ReviewError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("quest was not found")]
    NotFound,
    #[error("only the quest creator can review its entries")]
    NotCreator,
    #[error("the quest is not ready for review")]
    NotReady,
    #[error("review every entry before finalizing the quest")]
    IncompleteReviews,
    #[error("review reason cannot exceed 500 characters")]
    InvalidReason,
    #[error("the reward pool is not confirmed")]
    FundingNotReady,
    #[error("a winning entry does not have a locked payout destination")]
    PayoutDestinationMissing,
    #[error(transparent)]
    Finalization(#[from] FinalizationError),
    #[error("review service is temporarily unavailable")]
    Database,
}

impl ResponseError for ReviewError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::NotCreator => StatusCode::FORBIDDEN,
            Self::NotReady
            | Self::IncompleteReviews
            | Self::FundingNotReady
            | Self::PayoutDestinationMissing => StatusCode::CONFLICT,
            Self::InvalidReason | Self::Finalization(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
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
                Self::NotReady => "quest_not_ready_for_review",
                Self::IncompleteReviews => "incomplete_reviews",
                Self::InvalidReason => "invalid_review_reason",
                Self::FundingNotReady => "reward_funding_not_ready",
                Self::PayoutDestinationMissing => "payout_destination_missing",
                Self::Finalization(_) => "invalid_winner_selection",
                Self::Database => "review_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[get("/quests/{quest_id}/entries")]
pub async fn list_entries_for_creator(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Vec<CreatorEntry>>, ReviewError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    verify_creator(&state, quest_id, user.id).await?;

    let rows = sqlx::query_as::<_, CreatorEntryRow>(
        r#"
        select e.id,
               e.participant_id,
               u.username as participant_username,
               u.display_name as participant_display_name,
               u.avatar_url as participant_avatar_url,
               e.caption,
               e.submitted_at,
               r.is_valid as review_is_valid,
               r.reason as review_reason
        from public.quest_entries e
        join public.users u on u.id = e.participant_id
        left join public.entry_reviews r on r.entry_id = e.id
        where e.quest_id = $1
        order by e.submitted_at, e.id
        "#,
    )
    .bind(quest_id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| ReviewError::Database)?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let evidence = sqlx::query_as::<_, EntryEvidence>(
            "select proof_type, value from public.entry_evidence where entry_id = $1 order by created_at, id",
        )
        .bind(row.id)
        .fetch_all(&state.database)
        .await
        .map_err(|_| ReviewError::Database)?;
        entries.push(row.with_evidence(evidence));
    }

    Ok(web::Json(entries))
}

#[post("/quests/{quest_id}/entries/{entry_id}/review")]
pub async fn review_entry(
    request: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(Uuid, Uuid)>,
    review: web::Json<ReviewEntry>,
) -> Result<HttpResponse, ReviewError> {
    let user = state.auth.authenticate(&request).await?;
    if review
        .reason
        .as_deref()
        .is_some_and(|reason| reason.chars().count() > 500)
    {
        return Err(ReviewError::InvalidReason);
    }
    let (quest_id, entry_id) = path.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| ReviewError::Database)?;
    let quest = sqlx::query(
        "select creator_id, status::text as status, deadline from public.quests where id = $1 for update",
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?
    .ok_or(ReviewError::NotFound)?;
    let creator_id: Uuid = quest
        .try_get("creator_id")
        .map_err(|_| ReviewError::Database)?;
    if creator_id != user.id {
        return Err(ReviewError::NotCreator);
    }
    ensure_reviewable_quest(&quest)?;

    let exists = sqlx::query_scalar::<_, bool>(
        "select exists(select 1 from public.quest_entries where id = $1 and quest_id = $2)",
    )
    .bind(entry_id)
    .bind(quest_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?;
    if !exists {
        return Err(ReviewError::NotFound);
    }

    sqlx::query(
        r#"
        insert into public.entry_reviews (entry_id, reviewer_id, is_valid, reason)
        values ($1, $2, $3, $4)
        on conflict (entry_id) do update
        set reviewer_id = excluded.reviewer_id,
            is_valid = excluded.is_valid,
            reason = excluded.reason,
            created_at = now()
        "#,
    )
    .bind(entry_id)
    .bind(user.id)
    .bind(review.is_valid)
    .bind(review.reason.as_deref().map(str::trim))
    .execute(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?;

    sqlx::query(
        r#"
        update public.quests
        set status = 'REVIEWING',
            closed_at = coalesce(closed_at, now()),
            updated_at = now()
        where id = $1
        "#,
    )
    .bind(quest_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| ReviewError::Database)?;

    Ok(HttpResponse::NoContent().finish())
}

#[get("/quests/{quest_id}/settlement")]
pub async fn get_quest_settlement(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<QuestSettlement>, ReviewError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let quest = sqlx::query(
        "select creator_id, status::text as status, reward_enabled from public.quests where id = $1",
    )
    .bind(quest_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| ReviewError::Database)?
    .ok_or(ReviewError::NotFound)?;
    let creator_id: Uuid = quest
        .try_get("creator_id")
        .map_err(|_| ReviewError::Database)?;
    if creator_id != user.id {
        return Err(ReviewError::NotCreator);
    }

    let rows = sqlx::query_as::<_, StoredCreatorPayout>(
        r#"
        select p.id,
               qw.winner_position,
               u.username as recipient_username,
               u.display_name as recipient_display_name,
               p.amount_minor as amount_luna,
               p.network,
               p.destination_address,
               p.status::text as status,
               p.transaction_hash,
               p.submitted_at,
               p.confirmed_at,
               p.failure_reason,
               p.created_at
        from public.payouts p
        join public.reward_allocations ra on ra.id = p.reward_allocation_id
        join public.quest_winners qw on qw.id = ra.winner_id
        join public.users u on u.id = p.recipient_id
        where qw.quest_id = $1
        order by qw.winner_position, p.id
        "#,
    )
    .bind(quest_id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| ReviewError::Database)?;
    let total_allocated_luna = rows
        .iter()
        .try_fold(0_i64, |total, payout| total.checked_add(payout.amount_luna))
        .ok_or(ReviewError::Database)?;
    let payouts = rows
        .into_iter()
        .map(StoredCreatorPayout::into_response)
        .collect();

    Ok(web::Json(QuestSettlement {
        quest_id,
        status: quest.try_get("status").map_err(|_| ReviewError::Database)?,
        reward_enabled: quest
            .try_get("reward_enabled")
            .map_err(|_| ReviewError::Database)?,
        total_allocated_luna,
        total_allocated_nim: format_luna(total_allocated_luna),
        payouts,
    }))
}

#[post("/quests/{quest_id}/finalize")]
pub async fn finalize_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
    selection: web::Json<FinalizeQuest>,
) -> Result<web::Json<FinalizedQuest>, ReviewError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| ReviewError::Database)?;
    let quest = sqlx::query(
        r#"
        select creator_id,
               status::text as status,
               deadline,
               winner_count,
               winner_selection_method::text as winner_selection_method,
               reward_enabled,
               reward_amount_minor,
               reward_currency::text as reward_currency,
               settlement_asset
        from public.quests
        where id = $1
        for update
        "#,
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?
    .ok_or(ReviewError::NotFound)?;
    let creator_id: Uuid = quest
        .try_get("creator_id")
        .map_err(|_| ReviewError::Database)?;
    if creator_id != user.id {
        return Err(ReviewError::NotCreator);
    }
    ensure_reviewable_quest(&quest)?;

    let entries = sqlx::query(
        r#"
        select e.id, e.submitted_at, r.is_valid
        from public.quest_entries e
        left join public.entry_reviews r on r.entry_id = e.id
        where e.quest_id = $1
        order by e.submitted_at, e.id
        "#,
    )
    .bind(quest_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?;
    if entries.is_empty()
        || entries.iter().any(|entry| {
            entry
                .try_get::<Option<bool>, _>("is_valid")
                .ok()
                .flatten()
                .is_none()
        })
    {
        return Err(ReviewError::IncompleteReviews);
    }

    let reviewed = entries
        .iter()
        .map(|entry| {
            Ok(ReviewedEntry {
                entry_id: entry.try_get("id").map_err(|_| ReviewError::Database)?,
                submitted_at: entry
                    .try_get("submitted_at")
                    .map_err(|_| ReviewError::Database)?,
                is_valid: entry
                    .try_get("is_valid")
                    .map_err(|_| ReviewError::Database)?,
            })
        })
        .collect::<Result<Vec<_>, ReviewError>>()?;
    let winner_count: i16 = quest
        .try_get("winner_count")
        .map_err(|_| ReviewError::Database)?;
    let method: String = quest
        .try_get("winner_selection_method")
        .map_err(|_| ReviewError::Database)?;
    let winners = if method == "FIRST_VALID" {
        if !selection.winner_entry_ids.is_empty() {
            return Err(ReviewError::Finalization(
                FinalizationError::InvalidWinnerSelection,
            ));
        }
        first_valid_winners(&reviewed, winner_count as u8)?
    } else {
        validate_best_submission_winners(
            &reviewed,
            &selection.winner_entry_ids,
            winner_count as u8,
        )?
    };

    let reward_enabled: bool = quest
        .try_get("reward_enabled")
        .map_err(|_| ReviewError::Database)?;
    let reward_amount_minor: Option<i64> = quest
        .try_get("reward_amount_minor")
        .map_err(|_| ReviewError::Database)?;
    let reward_currency: Option<String> = quest
        .try_get("reward_currency")
        .map_err(|_| ReviewError::Database)?;
    let settlement_asset: Option<String> = quest
        .try_get("settlement_asset")
        .map_err(|_| ReviewError::Database)?;
    let reward_pool_id = if reward_enabled {
        if reward_amount_minor.is_none()
            || reward_currency.as_deref() != Some("NIM")
            || settlement_asset.as_deref() != Some("NIM")
        {
            return Err(ReviewError::FundingNotReady);
        }
        Some(
            sqlx::query_scalar::<_, Uuid>(
                "select id from public.reward_pools where quest_id = $1 and funded_at is not null for update",
            )
            .bind(quest_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|_| ReviewError::Database)?
            .ok_or(ReviewError::FundingNotReady)?,
        )
    } else {
        None
    };

    for (index, entry_id) in winners.iter().enumerate() {
        let winner_id = sqlx::query_scalar::<_, Uuid>(
            "insert into public.quest_winners (quest_id, entry_id, winner_position) values ($1, $2, $3) returning id",
        )
        .bind(quest_id)
        .bind(entry_id)
        .bind((index + 1) as i16)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| ReviewError::Database)?;

        if let Some(reward_pool_id) = reward_pool_id {
            let recipient = sqlx::query(
                r#"
                select participant_id, payout_destination_address
                from public.quest_entries
                where id = $1 and quest_id = $2
                "#,
            )
            .bind(entry_id)
            .bind(quest_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|_| ReviewError::Database)?;
            let recipient_id: Uuid = recipient
                .try_get("participant_id")
                .map_err(|_| ReviewError::Database)?;
            let destination_address: Option<String> = recipient
                .try_get("payout_destination_address")
                .map_err(|_| ReviewError::Database)?;
            let destination_address =
                destination_address.ok_or(ReviewError::PayoutDestinationMissing)?;
            let amount_luna = reward_amount_minor.ok_or(ReviewError::FundingNotReady)?;
            let allocation_id = sqlx::query_scalar::<_, Uuid>(
                r#"
                insert into public.reward_allocations (
                  reward_pool_id, winner_id, recipient_id, amount_minor, currency
                )
                values ($1, $2, $3, $4, 'NIM')
                returning id
                "#,
            )
            .bind(reward_pool_id)
            .bind(winner_id)
            .bind(recipient_id)
            .bind(amount_luna)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|_| ReviewError::Database)?;
            sqlx::query(
                r#"
                insert into public.payouts (
                  reward_allocation_id, recipient_id, amount_minor,
                  settlement_asset, network, destination_address,
                  status, idempotency_key
                )
                values ($1, $2, $3, 'NIM', 'testnet', $4, 'PENDING', $5)
                "#,
            )
            .bind(allocation_id)
            .bind(recipient_id)
            .bind(amount_luna)
            .bind(destination_address)
            .bind(format!("payout:{quest_id}:{winner_id}"))
            .execute(&mut *transaction)
            .await
            .map_err(|_| ReviewError::Database)?;
        }
    }
    sqlx::query(
        "update public.quests set status = 'FINALIZED', closed_at = coalesce(closed_at, now()), updated_at = now() where id = $1",
    )
    .bind(quest_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| ReviewError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| ReviewError::Database)?;

    Ok(web::Json(FinalizedQuest {
        quest_id,
        winner_entry_ids: winners,
        status: "FINALIZED",
    }))
}

#[derive(Debug, FromRow)]
struct CreatorEntryRow {
    id: Uuid,
    participant_id: Uuid,
    participant_username: String,
    participant_display_name: String,
    participant_avatar_url: Option<String>,
    caption: Option<String>,
    submitted_at: DateTime<Utc>,
    review_is_valid: Option<bool>,
    review_reason: Option<String>,
}

impl CreatorEntryRow {
    fn with_evidence(self, evidence: Vec<EntryEvidence>) -> CreatorEntry {
        CreatorEntry {
            id: self.id,
            participant_id: self.participant_id,
            participant_username: self.participant_username,
            participant_display_name: self.participant_display_name,
            participant_avatar_url: self.participant_avatar_url,
            caption: self.caption,
            submitted_at: self.submitted_at,
            review_is_valid: self.review_is_valid,
            review_reason: self.review_reason,
            evidence,
        }
    }
}

async fn verify_creator(
    state: &AppState,
    quest_id: Uuid,
    user_id: Uuid,
) -> Result<(), ReviewError> {
    let creator_id =
        sqlx::query_scalar::<_, Uuid>("select creator_id from public.quests where id = $1")
            .bind(quest_id)
            .fetch_optional(&state.database)
            .await
            .map_err(|_| ReviewError::Database)?
            .ok_or(ReviewError::NotFound)?;
    if creator_id != user_id {
        return Err(ReviewError::NotCreator);
    }
    Ok(())
}

fn ensure_reviewable_quest(row: &sqlx::postgres::PgRow) -> Result<(), ReviewError> {
    let status: String = row.try_get("status").map_err(|_| ReviewError::Database)?;
    let deadline: DateTime<Utc> = row.try_get("deadline").map_err(|_| ReviewError::Database)?;
    if matches!(status.as_str(), "CLOSED_FOR_REVIEW" | "REVIEWING")
        || (status == "OPEN" && deadline <= Utc::now())
    {
        Ok(())
    } else {
        Err(ReviewError::NotReady)
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    fn entry(minutes: i64, is_valid: bool) -> ReviewedEntry {
        ReviewedEntry {
            entry_id: Uuid::new_v4(),
            submitted_at: DateTime::UNIX_EPOCH + Duration::minutes(minutes),
            is_valid,
        }
    }

    #[test]
    fn first_valid_skips_earlier_invalid_entries() {
        let entries = vec![
            entry(1, false),
            entry(2, false),
            entry(3, true),
            entry(4, true),
        ];
        let winners = first_valid_winners(&entries, 1).expect("selection succeeds");
        assert_eq!(winners, vec![entries[2].entry_id]);
    }

    #[test]
    fn first_valid_returns_the_published_number_in_order() {
        let entries = vec![
            entry(5, true),
            entry(1, true),
            entry(4, false),
            entry(2, true),
        ];
        let winners = first_valid_winners(&entries, 3).expect("selection succeeds");
        assert_eq!(
            winners,
            vec![
                entries[1].entry_id,
                entries[3].entry_id,
                entries[0].entry_id
            ]
        );
    }

    #[test]
    fn no_valid_entries_produces_no_winner() {
        let entries = vec![entry(1, false), entry(2, false)];
        assert!(
            first_valid_winners(&entries, 1)
                .expect("selection succeeds")
                .is_empty()
        );
    }

    #[test]
    fn best_submission_rejects_an_invalid_selection() {
        let entries = vec![entry(1, true), entry(2, false)];
        assert_eq!(
            validate_best_submission_winners(&entries, &[entries[1].entry_id], 1),
            Err(FinalizationError::InvalidWinnerSelection)
        );
    }

    #[test]
    fn best_submission_requires_all_available_winner_positions() {
        let entries = vec![entry(1, true), entry(2, true), entry(3, true)];
        assert_eq!(
            validate_best_submission_winners(&entries, &[entries[0].entry_id], 2),
            Err(FinalizationError::WrongWinnerCount)
        );
    }

    #[test]
    fn best_submission_accepts_fewer_winners_when_valid_entries_are_insufficient() {
        let entries = vec![entry(1, true), entry(2, false)];
        let selected = vec![entries[0].entry_id];
        assert_eq!(
            validate_best_submission_winners(&entries, &selected, 3),
            Ok(selected)
        );
    }
}
