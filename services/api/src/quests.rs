use actix_web::{
    HttpRequest, HttpResponse, ResponseError, delete, get, http::StatusCode, post, put, web,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

const ALLOWED_PROOF_REQUIREMENTS: [&str; 6] = [
    "PHOTO",
    "VIDEO",
    "LINK",
    "TEXT",
    "QR_CHECKPOINT",
    "LOCATION",
];

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WinnerSelectionMethod {
    FirstValid,
    BestSubmission,
}

impl WinnerSelectionMethod {
    fn as_database_value(self) -> &'static str {
        match self {
            Self::FirstValid => "FIRST_VALID",
            Self::BestSubmission => "BEST_SUBMISSION",
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct QuestRules {
    pub max_entries: u8,
    pub winner_count: u8,
    pub winner_selection_method: WinnerSelectionMethod,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum QuestValidationError {
    #[error("max_entries must be between 1 and 10")]
    EntryLimit,
    #[error("winner_count must be between 1 and 3")]
    WinnerLimit,
    #[error("winner_count cannot exceed max_entries")]
    WinnersExceedEntries,
}

impl QuestRules {
    pub fn validate(&self) -> Result<(), QuestValidationError> {
        if !(1..=10).contains(&self.max_entries) {
            return Err(QuestValidationError::EntryLimit);
        }
        if !(1..=3).contains(&self.winner_count) {
            return Err(QuestValidationError::WinnerLimit);
        }
        if self.winner_count > self.max_entries {
            return Err(QuestValidationError::WinnersExceedEntries);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Quest {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub creator_username: String,
    pub creator_display_name: String,
    pub creator_avatar_url: Option<String>,
    pub title: String,
    pub description: String,
    pub cover_media_url: Option<String>,
    pub quest_type: String,
    pub visibility: String,
    pub is_group_challenge: bool,
    pub required_group_size: Option<i16>,
    pub max_entries: i16,
    pub winner_count: i16,
    pub winner_selection_method: String,
    pub proof_requirements: Vec<String>,
    pub judging_criteria: Option<String>,
    pub reward_enabled: bool,
    pub reward_amount_minor: Option<i64>,
    pub reward_currency: Option<String>,
    pub settlement_asset: Option<String>,
    pub deadline: DateTime<Utc>,
    pub status: String,
    pub entries_received: i64,
    pub participants_joined: i64,
    pub created_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub viewer_joined: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuest {
    title: String,
    description: String,
    cover_media_url: Option<String>,
    quest_type: String,
    #[serde(default = "default_visibility")]
    visibility: String,
    #[serde(default)]
    is_group_challenge: bool,
    required_group_size: Option<u16>,
    max_entries: u8,
    winner_count: u8,
    winner_selection_method: WinnerSelectionMethod,
    proof_requirements: Vec<String>,
    judging_criteria: Option<String>,
    #[serde(default)]
    reward_enabled: bool,
    reward_amount_minor: Option<i64>,
    reward_currency: Option<String>,
    settlement_asset: Option<String>,
    deadline: DateTime<Utc>,
}

fn default_visibility() -> String {
    "PUBLIC".to_string()
}

#[derive(Debug, Deserialize)]
pub struct QuestListQuery {
    limit: Option<i64>,
    search: Option<String>,
    quest_type: Option<String>,
}

impl QuestListQuery {
    fn normalized_search(&self) -> Result<Option<String>, QuestError> {
        let search = self
            .search
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if search.is_some_and(|value| value.chars().count() > 80) {
            return Err(QuestError::InvalidQuest);
        }
        Ok(search.map(str::to_string))
    }

    fn normalized_quest_type(&self) -> Result<Option<String>, QuestError> {
        let quest_type = self
            .quest_type
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_ascii_uppercase);
        if quest_type
            .as_deref()
            .is_some_and(|value| !matches!(value, "FRIENDS" | "BOUNTY" | "EXPLORE"))
        {
            return Err(QuestError::InvalidQuest);
        }
        Ok(quest_type)
    }
}

#[derive(Debug, Serialize)]
pub struct JoinResult {
    quest_id: Uuid,
    joined: bool,
    participants_joined: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MyQuestSummary {
    id: Uuid,
    title: String,
    quest_type: String,
    status: String,
    relationship: String,
    deadline: DateTime<Utc>,
    entries_received: i64,
    max_entries: i16,
    participants_joined: i64,
    reward_enabled: bool,
    reward_amount_minor: Option<i64>,
    reward_currency: Option<String>,
    published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SavedQuestState {
    quest_id: Uuid,
    saved: bool,
}

#[derive(Debug, Error)]
pub enum QuestError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("quest was not found")]
    NotFound,
    #[error("quest details do not satisfy the publishing rules")]
    InvalidQuest,
    #[error("deadline must be in the future")]
    InvalidDeadline,
    #[error("only the quest creator can perform this action")]
    NotCreator,
    #[error("quest is not accepting participants")]
    NotOpen,
    #[error("the creator cannot join their own quest")]
    CreatorCannotJoin,
    #[error("quest has already been joined")]
    AlreadyJoined,
    #[error("this quest can no longer be cancelled safely")]
    CannotCancel,
    #[error("quest service is temporarily unavailable")]
    Database,
}

impl ResponseError for QuestError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::InvalidQuest | Self::InvalidDeadline => StatusCode::UNPROCESSABLE_ENTITY,
            Self::NotCreator => StatusCode::FORBIDDEN,
            Self::NotOpen | Self::CreatorCannotJoin | Self::AlreadyJoined | Self::CannotCancel => {
                StatusCode::CONFLICT
            }
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
                Self::InvalidQuest => "invalid_quest",
                Self::InvalidDeadline => "invalid_deadline",
                Self::NotCreator => "not_quest_creator",
                Self::NotOpen => "quest_not_open",
                Self::CreatorCannotJoin => "creator_cannot_join",
                Self::AlreadyJoined => "quest_already_joined",
                Self::CannotCancel => "quest_cannot_be_cancelled",
                Self::Database => "quest_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

impl CreateQuest {
    fn validate(&self) -> Result<(), QuestError> {
        QuestRules {
            max_entries: self.max_entries,
            winner_count: self.winner_count,
            winner_selection_method: self.winner_selection_method,
        }
        .validate()
        .map_err(|_| QuestError::InvalidQuest)?;

        if !(3..=100).contains(&self.title.trim().chars().count())
            || !(1..=2000).contains(&self.description.trim().chars().count())
            || !matches!(self.quest_type.as_str(), "FRIENDS" | "BOUNTY" | "EXPLORE")
            || !matches!(
                self.visibility.as_str(),
                "PUBLIC" | "PRIVATE" | "INVITE_ONLY"
            )
            || self.proof_requirements.is_empty()
            || self.proof_requirements.len() > 6
            || self
                .proof_requirements
                .iter()
                .any(|proof| !ALLOWED_PROOF_REQUIREMENTS.contains(&proof.as_str()))
        {
            return Err(QuestError::InvalidQuest);
        }

        if self.cover_media_url.as_deref().is_some_and(|url| {
            let url = url.trim();
            url.chars().count() > 2048 || !url.starts_with("https://")
        }) {
            return Err(QuestError::InvalidQuest);
        }

        match (self.is_group_challenge, self.required_group_size) {
            (true, Some(2..=50)) | (false, None) => {}
            _ => return Err(QuestError::InvalidQuest),
        }

        if self.winner_selection_method == WinnerSelectionMethod::BestSubmission
            && !self
                .judging_criteria
                .as_deref()
                .is_some_and(|criteria| (3..=500).contains(&criteria.trim().chars().count()))
        {
            return Err(QuestError::InvalidQuest);
        }

        if self.reward_enabled {
            if self.reward_amount_minor.is_none_or(|amount| amount <= 0)
                || self.reward_currency.as_deref() != Some("NIM")
                || self.settlement_asset.as_deref() != Some("NIM")
            {
                return Err(QuestError::InvalidQuest);
            }
        } else if self.reward_amount_minor.is_some()
            || self.reward_currency.is_some()
            || self.settlement_asset.is_some()
        {
            return Err(QuestError::InvalidQuest);
        }

        if self.deadline <= Utc::now() {
            return Err(QuestError::InvalidDeadline);
        }

        Ok(())
    }
}

#[get("/quests")]
pub async fn list_quests(
    state: web::Data<AppState>,
    query: web::Query<QuestListQuery>,
) -> Result<web::Json<Vec<Quest>>, QuestError> {
    let limit = query.limit.unwrap_or(20).clamp(1, 50);
    let search = query.normalized_search()?;
    let quest_type = query.normalized_quest_type()?;
    let quests = sqlx::query_as::<_, Quest>(
        r#"
        select q.id,
               q.creator_id,
               u.username as creator_username,
               u.display_name as creator_display_name,
               u.avatar_url as creator_avatar_url,
               q.title,
               q.description,
               q.cover_media_url,
               q.quest_type::text as quest_type,
               q.visibility::text as visibility,
               q.is_group_challenge,
               q.required_group_size,
               q.max_entries,
               q.winner_count,
               q.winner_selection_method::text as winner_selection_method,
               q.proof_requirements,
               q.judging_criteria,
               q.reward_enabled,
               q.reward_amount_minor,
               q.reward_currency::text as reward_currency,
               q.settlement_asset,
               q.deadline,
               q.status::text as status,
               (select count(*) from public.quest_entries e where e.quest_id = q.id) as entries_received,
               (select count(*) from public.quest_participants p where p.quest_id = q.id) as participants_joined,
               q.created_at,
               q.published_at,
               false as viewer_joined
        from public.quests q
        join public.users u on u.id = q.creator_id
        where q.visibility = 'PUBLIC'
          and q.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED')
          and ($2::text is null or q.quest_type::text = $2)
          and (
            $3::text is null
            or q.title ilike '%' || $3 || '%'
            or q.description ilike '%' || $3 || '%'
            or u.username ilike '%' || $3 || '%'
            or u.display_name ilike '%' || $3 || '%'
          )
        order by q.published_at desc nulls last, q.created_at desc
        limit $1
        "#,
    )
    .bind(limit)
    .bind(quest_type)
    .bind(search)
    .fetch_all(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok(web::Json(quests))
}

#[get("/quests/{quest_id}")]
pub async fn get_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Quest>, QuestError> {
    let viewer = state.auth.authenticate_optional(&request).await?;
    let quest =
        find_accessible_quest(&state, quest_id.into_inner(), viewer.map(|user| user.id)).await?;
    Ok(web::Json(quest))
}

#[get("/users/me/quests")]
pub async fn list_my_quests(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<MyQuestSummary>>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quests = sqlx::query_as::<_, MyQuestSummary>(
        r#"
        with related_quests as (
          select q.id, 'CREATOR'::text as relationship
          from public.quests q
          where q.creator_id = $1
          union all
          select p.quest_id as id, 'PARTICIPANT'::text as relationship
          from public.quest_participants p
          where p.user_id = $1
        )
        select q.id,
               q.title,
               q.quest_type::text as quest_type,
               q.status::text as status,
               related.relationship,
               q.deadline,
               (select count(*) from public.quest_entries e where e.quest_id = q.id) as entries_received,
               q.max_entries,
               (select count(*) from public.quest_participants p where p.quest_id = q.id) as participants_joined,
               q.reward_enabled,
               q.reward_amount_minor,
               q.reward_currency::text as reward_currency,
               q.published_at
        from related_quests related
        join public.quests q on q.id = related.id
        order by coalesce(q.published_at, q.created_at) desc
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok(web::Json(quests))
}

#[get("/users/me/saved-quests")]
pub async fn list_saved_quests(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<MyQuestSummary>>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quests = sqlx::query_as::<_, MyQuestSummary>(
        r#"
        select q.id,
               q.title,
               q.quest_type::text as quest_type,
               q.status::text as status,
               'SAVED'::text as relationship,
               q.deadline,
               (select count(*) from public.quest_entries e where e.quest_id = q.id) as entries_received,
               q.max_entries,
               (select count(*) from public.quest_participants p where p.quest_id = q.id) as participants_joined,
               q.reward_enabled,
               q.reward_amount_minor,
               q.reward_currency::text as reward_currency,
               q.published_at
        from public.saved_quests saved
        join public.quests q on q.id = saved.quest_id
        where saved.user_id = $1
          and q.visibility = 'PUBLIC'
          and q.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED')
        order by saved.created_at desc
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok(web::Json(quests))
}

#[get("/quests/{quest_id}/saved")]
pub async fn get_saved_quest_state(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<SavedQuestState>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let saved = sqlx::query_scalar::<_, bool>(
        "select exists(select 1 from public.saved_quests where user_id = $1 and quest_id = $2)",
    )
    .bind(user.id)
    .bind(quest_id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok(web::Json(SavedQuestState { quest_id, saved }))
}

#[put("/quests/{quest_id}/saved")]
pub async fn save_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<SavedQuestState>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let visible = sqlx::query_scalar::<_, bool>(
        r#"
        select exists(
          select 1 from public.quests
          where id = $1
            and visibility = 'PUBLIC'
            and status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED')
        )
        "#,
    )
    .bind(quest_id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;
    if !visible {
        return Err(QuestError::NotFound);
    }

    sqlx::query(
        "insert into public.saved_quests (user_id, quest_id) values ($1, $2) on conflict do nothing",
    )
    .bind(user.id)
    .bind(quest_id)
    .execute(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok(web::Json(SavedQuestState {
        quest_id,
        saved: true,
    }))
}

#[delete("/quests/{quest_id}/saved")]
pub async fn remove_saved_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<HttpResponse, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    sqlx::query("delete from public.saved_quests where user_id = $1 and quest_id = $2")
        .bind(user.id)
        .bind(quest_id.into_inner())
        .execute(&state.database)
        .await
        .map_err(|_| QuestError::Database)?;
    Ok(HttpResponse::NoContent().finish())
}

#[post("/quests")]
pub async fn create_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest: web::Json<CreateQuest>,
) -> Result<(web::Json<Quest>, StatusCode), QuestError> {
    quest.validate()?;
    let user = state.auth.authenticate(&request).await?;

    let created_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.quests (
          creator_id, title, description, cover_media_url, quest_type, visibility,
          is_group_challenge, required_group_size, max_entries, winner_count,
          winner_selection_method, proof_requirements, judging_criteria,
          reward_enabled, reward_amount_minor, reward_currency, settlement_asset, deadline
        )
        values (
          $1, $2, $3, $4, $5::quest_type, $6::quest_visibility,
          $7, $8, $9, $10, $11::winner_selection_method, $12, $13,
          $14, $15, $16, $17, $18
        )
        returning id
        "#,
    )
    .bind(user.id)
    .bind(quest.title.trim())
    .bind(quest.description.trim())
    .bind(quest.cover_media_url.as_deref().map(str::trim))
    .bind(quest.quest_type.as_str())
    .bind(quest.visibility.as_str())
    .bind(quest.is_group_challenge)
    .bind(quest.required_group_size.map(|size| size as i16))
    .bind(i16::from(quest.max_entries))
    .bind(i16::from(quest.winner_count))
    .bind(quest.winner_selection_method.as_database_value())
    .bind(&quest.proof_requirements)
    .bind(quest.judging_criteria.as_deref().map(str::trim))
    .bind(quest.reward_enabled)
    .bind(quest.reward_amount_minor)
    .bind(quest.reward_currency.as_deref())
    .bind(quest.settlement_asset.as_deref())
    .bind(quest.deadline)
    .fetch_one(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    let created = find_creator_quest(&state, created_id, user.id).await?;
    Ok((web::Json(created), StatusCode::CREATED))
}

#[post("/quests/{quest_id}/publish")]
pub async fn publish_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Quest>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();

    let result = sqlx::query_scalar::<_, String>(
        r#"
        update public.quests
        set status = case when reward_enabled then 'AWAITING_FUNDING'::quest_status else 'OPEN'::quest_status end,
            published_at = case when reward_enabled then published_at else now() end,
            updated_at = now()
        where id = $1
          and creator_id = $2
          and status = 'DRAFT'
          and deadline > now()
        returning status::text
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    if result.is_none() {
        let ownership = sqlx::query_as::<_, (Uuid, String, DateTime<Utc>)>(
            "select creator_id, status::text, deadline from public.quests where id = $1",
        )
        .bind(quest_id)
        .fetch_optional(&state.database)
        .await
        .map_err(|_| QuestError::Database)?;

        return match ownership {
            None => Err(QuestError::NotFound),
            Some((creator_id, _, _)) if creator_id != user.id => Err(QuestError::NotCreator),
            Some((_, _, deadline)) if deadline <= Utc::now() => Err(QuestError::InvalidDeadline),
            Some(_) => Err(QuestError::NotOpen),
        };
    }

    Ok(web::Json(
        find_creator_quest(&state, quest_id, user.id).await?,
    ))
}

#[post("/quests/{quest_id}/join")]
pub async fn join_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<(web::Json<JoinResult>, StatusCode), QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let quest = sqlx::query_as::<_, (Uuid, String, DateTime<Utc>, String, bool)>(
        r#"
        select creator_id, status::text, deadline, visibility::text,
               exists(select 1 from public.quest_participants where quest_id = $1 and user_id = $2)
        from public.quests where id = $1
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| QuestError::Database)?
    .ok_or(QuestError::NotFound)?;

    if quest.0 == user.id {
        return Err(QuestError::CreatorCannotJoin);
    }
    if quest.1 != "OPEN" || quest.2 <= Utc::now() {
        return Err(QuestError::NotOpen);
    }
    if quest.3 != "PUBLIC" && !quest.4 {
        return Err(QuestError::NotFound);
    }

    let joined = sqlx::query_scalar::<_, Uuid>(
        r#"
        insert into public.quest_participants (quest_id, user_id)
        values ($1, $2)
        on conflict (quest_id, user_id) do nothing
        returning user_id
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| QuestError::Database)?
    .is_some();

    if !joined {
        return Err(QuestError::AlreadyJoined);
    }

    let participants_joined = sqlx::query_scalar::<_, i64>(
        "select count(*) from public.quest_participants where quest_id = $1",
    )
    .bind(quest_id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| QuestError::Database)?;

    Ok((
        web::Json(JoinResult {
            quest_id,
            joined,
            participants_joined,
        }),
        StatusCode::CREATED,
    ))
}

#[post("/quests/{quest_id}/close")]
pub async fn close_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Quest>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| QuestError::Database)?;
    let quest = sqlx::query_as::<_, (Uuid, String)>(
        "select creator_id, status::text from public.quests where id = $1 for update",
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| QuestError::Database)?
    .ok_or(QuestError::NotFound)?;
    if quest.0 != user.id {
        return Err(QuestError::NotCreator);
    }
    if quest.1 != "OPEN" {
        return Err(QuestError::NotOpen);
    }

    sqlx::query(
        r#"
        update public.quests
        set status = 'CLOSED_FOR_REVIEW', closed_at = now(), updated_at = now()
        where id = $1
        "#,
    )
    .bind(quest_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| QuestError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| QuestError::Database)?;

    Ok(web::Json(
        find_creator_quest(&state, quest_id, user.id).await?,
    ))
}

fn can_cancel_quest(
    status: &str,
    reward_enabled: bool,
    entry_count: i64,
    has_funding_intent: bool,
) -> bool {
    match status {
        "DRAFT" => true,
        "AWAITING_FUNDING" => !has_funding_intent,
        "OPEN" => !reward_enabled && entry_count == 0,
        _ => false,
    }
}

#[post("/quests/{quest_id}/cancel")]
pub async fn cancel_quest(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Quest>, QuestError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| QuestError::Database)?;
    let quest = sqlx::query_as::<_, (Uuid, String, bool, i64, bool)>(
        r#"
        select q.creator_id,
               q.status::text,
               q.reward_enabled,
               (select count(*) from public.quest_entries e where e.quest_id = q.id),
               exists (
                 select 1
                 from public.reward_pools pool
                 join public.payment_intents intent on intent.reward_pool_id = pool.id
                 where pool.quest_id = q.id
               )
        from public.quests q
        where q.id = $1
        for update
        "#,
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| QuestError::Database)?
    .ok_or(QuestError::NotFound)?;
    if quest.0 != user.id {
        return Err(QuestError::NotCreator);
    }
    if !can_cancel_quest(&quest.1, quest.2, quest.3, quest.4) {
        return Err(QuestError::CannotCancel);
    }

    sqlx::query(
        "update public.quests set status = 'CANCELLED', closed_at = now(), updated_at = now() where id = $1",
    )
    .bind(quest_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| QuestError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| QuestError::Database)?;

    Ok(web::Json(
        find_creator_quest(&state, quest_id, user.id).await?,
    ))
}

#[post("/quests/validate")]
pub async fn validate_quest(rules: web::Json<QuestRules>) -> impl actix_web::Responder {
    match rules.validate() {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::UnprocessableEntity().json(serde_json::json!({
            "code": "invalid_quest_rules",
            "message": error.to_string()
        })),
    }
}

async fn find_accessible_quest(
    state: &AppState,
    id: Uuid,
    viewer_id: Option<Uuid>,
) -> Result<Quest, QuestError> {
    find_quest(state, id, None, true, viewer_id).await
}

async fn find_creator_quest(
    state: &AppState,
    id: Uuid,
    creator_id: Uuid,
) -> Result<Quest, QuestError> {
    find_quest(state, id, Some(creator_id), false, Some(creator_id)).await
}

async fn find_quest(
    state: &AppState,
    id: Uuid,
    creator_id: Option<Uuid>,
    public_only: bool,
    viewer_id: Option<Uuid>,
) -> Result<Quest, QuestError> {
    sqlx::query_as::<_, Quest>(
        r#"
        select q.id,
               q.creator_id,
               u.username as creator_username,
               u.display_name as creator_display_name,
               u.avatar_url as creator_avatar_url,
               q.title,
               q.description,
               q.cover_media_url,
               q.quest_type::text as quest_type,
               q.visibility::text as visibility,
               q.is_group_challenge,
               q.required_group_size,
               q.max_entries,
               q.winner_count,
               q.winner_selection_method::text as winner_selection_method,
               q.proof_requirements,
               q.judging_criteria,
               q.reward_enabled,
               q.reward_amount_minor,
               q.reward_currency::text as reward_currency,
               q.settlement_asset,
               q.deadline,
               q.status::text as status,
               (select count(*) from public.quest_entries e where e.quest_id = q.id) as entries_received,
               (select count(*) from public.quest_participants p where p.quest_id = q.id) as participants_joined,
               q.created_at,
               q.published_at,
               ($4::uuid is not null and exists(
                 select 1 from public.quest_participants viewer_membership
                 where viewer_membership.quest_id = q.id and viewer_membership.user_id = $4
               )) as viewer_joined
        from public.quests q
        join public.users u on u.id = q.creator_id
        where q.id = $1
          and ($2::uuid is null or q.creator_id = $2)
          and (
            not $3
            or (q.visibility = 'PUBLIC' and q.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED'))
            or ($4::uuid is not null and (
              q.creator_id = $4
              or exists(
                select 1 from public.quest_participants access_membership
                where access_membership.quest_id = q.id and access_membership.user_id = $4
              )
            ))
          )
        "#,
    )
    .bind(id)
    .bind(creator_id)
    .bind(public_only)
    .bind(viewer_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|_| QuestError::Database)?
    .ok_or(QuestError::NotFound)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules(max_entries: u8, winner_count: u8) -> QuestRules {
        QuestRules {
            max_entries,
            winner_count,
            winner_selection_method: WinnerSelectionMethod::FirstValid,
        }
    }

    fn valid_quest() -> CreateQuest {
        CreateQuest {
            title: "Weekend photo walk".to_string(),
            description: "Photograph your favourite local landmark.".to_string(),
            cover_media_url: None,
            quest_type: "EXPLORE".to_string(),
            visibility: "PUBLIC".to_string(),
            is_group_challenge: false,
            required_group_size: None,
            max_entries: 5,
            winner_count: 1,
            winner_selection_method: WinnerSelectionMethod::FirstValid,
            proof_requirements: vec!["PHOTO".to_string()],
            judging_criteria: None,
            reward_enabled: false,
            reward_amount_minor: None,
            reward_currency: None,
            settlement_asset: None,
            deadline: Utc::now() + chrono::Duration::days(7),
        }
    }

    #[test]
    fn accepts_product_limits() {
        assert!(rules(10, 3).validate().is_ok());
    }

    #[test]
    fn rejects_more_than_ten_entries() {
        assert_eq!(
            rules(11, 1).validate(),
            Err(QuestValidationError::EntryLimit)
        );
    }

    #[test]
    fn rejects_more_than_three_winners() {
        assert_eq!(
            rules(5, 4).validate(),
            Err(QuestValidationError::WinnerLimit)
        );
    }

    #[test]
    fn rejects_more_winners_than_entries() {
        assert_eq!(
            rules(1, 2).validate(),
            Err(QuestValidationError::WinnersExceedEntries)
        );
    }

    #[test]
    fn accepts_a_complete_free_quest() {
        assert!(valid_quest().validate().is_ok());
    }

    #[test]
    fn accepts_https_cover_media_and_rejects_untrusted_schemes() {
        let mut quest = valid_quest();
        quest.cover_media_url = Some(
            "https://example.supabase.co/storage/v1/object/public/quest-covers/user/cover.webp"
                .to_string(),
        );
        assert!(quest.validate().is_ok());
        quest.cover_media_url = Some("javascript:alert(1)".to_string());
        assert!(matches!(quest.validate(), Err(QuestError::InvalidQuest)));
    }

    #[test]
    fn requires_criteria_for_judged_quests() {
        let mut quest = valid_quest();
        quest.winner_selection_method = WinnerSelectionMethod::BestSubmission;
        assert!(matches!(quest.validate(), Err(QuestError::InvalidQuest)));
    }

    #[test]
    fn rejects_reward_metadata_on_free_quests() {
        let mut quest = valid_quest();
        quest.reward_amount_minor = Some(1_000);
        assert!(matches!(quest.validate(), Err(QuestError::InvalidQuest)));
    }

    #[test]
    fn accepts_nim_denominated_reward_quests() {
        let mut quest = valid_quest();
        quest.reward_enabled = true;
        quest.reward_amount_minor = Some(1_000_000);
        quest.reward_currency = Some("NIM".to_string());
        quest.settlement_asset = Some("NIM".to_string());
        assert!(quest.validate().is_ok());
    }

    #[test]
    fn rejects_usd_denominated_reward_quests() {
        let mut quest = valid_quest();
        quest.reward_enabled = true;
        quest.reward_amount_minor = Some(1_000);
        quest.reward_currency = Some("USD".to_string());
        quest.settlement_asset = Some("NIM".to_string());
        assert!(matches!(quest.validate(), Err(QuestError::InvalidQuest)));
    }

    #[test]
    fn normalizes_discover_filters() {
        let query = QuestListQuery {
            limit: None,
            search: Some("  sunset walk  ".to_string()),
            quest_type: Some("explore".to_string()),
        };
        assert_eq!(
            query.normalized_search().unwrap().as_deref(),
            Some("sunset walk")
        );
        assert_eq!(
            query.normalized_quest_type().unwrap().as_deref(),
            Some("EXPLORE")
        );
    }

    #[test]
    fn rejects_invalid_discover_filters() {
        let invalid_type = QuestListQuery {
            limit: None,
            search: None,
            quest_type: Some("jobs".to_string()),
        };
        assert!(matches!(
            invalid_type.normalized_quest_type(),
            Err(QuestError::InvalidQuest)
        ));

        let long_search = QuestListQuery {
            limit: None,
            search: Some("x".repeat(81)),
            quest_type: None,
        };
        assert!(matches!(
            long_search.normalized_search(),
            Err(QuestError::InvalidQuest)
        ));
    }

    #[test]
    fn cancellation_rules_protect_entries_and_funded_rewards() {
        assert!(can_cancel_quest("DRAFT", false, 0, false));
        assert!(can_cancel_quest("AWAITING_FUNDING", true, 0, false));
        assert!(!can_cancel_quest("AWAITING_FUNDING", true, 0, true));
        assert!(can_cancel_quest("OPEN", false, 0, false));
        assert!(!can_cancel_quest("OPEN", false, 1, false));
        assert!(!can_cancel_quest("OPEN", true, 0, true));
        assert!(!can_cancel_quest("CLOSED_FOR_REVIEW", false, 0, false));
    }
}
