use actix_web::{HttpRequest, HttpResponse, ResponseError, http::StatusCode, post, web};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashSet;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

const PROOF_TYPES: [&str; 6] = [
    "PHOTO",
    "VIDEO",
    "LINK",
    "TEXT",
    "QR_CHECKPOINT",
    "LOCATION",
];

#[derive(Debug, Clone, Deserialize)]
pub struct EntryEvidenceInput {
    pub proof_type: String,
    pub value: String,
}

#[derive(Debug, Clone)]
pub struct AcceptEntryCommand {
    pub quest_id: Uuid,
    pub participant_id: Uuid,
    pub caption: Option<String>,
    pub evidence: Vec<EntryEvidenceInput>,
}

#[derive(Debug, Serialize)]
pub struct AcceptedEntry {
    pub id: Uuid,
    pub submitted_at: DateTime<Utc>,
    pub quest_closed_for_review: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EntryAcceptanceError {
    #[error("quest was not found")]
    QuestNotFound,
    #[error("quest is not accepting entries")]
    QuestNotOpen,
    #[error("the submission deadline has passed")]
    DeadlinePassed,
    #[error("all entry slots have been used")]
    EntryLimitReached,
    #[error("this participant already submitted an official entry")]
    DuplicateEntry,
    #[error("join this quest before submitting an entry")]
    MembershipRequired,
    #[error("caption cannot exceed 280 characters")]
    InvalidCaption,
    #[error("submission evidence does not match the published proof requirements")]
    InvalidEvidence,
    #[error("entry could not be accepted")]
    Database,
}

#[derive(Debug)]
struct QuestEntryGate {
    status: String,
    deadline: DateTime<Utc>,
    max_entries: i16,
    accepted_entries: i64,
    proof_requirements: Vec<String>,
    participant_joined: bool,
}

fn validate_entry_gate(
    gate: &QuestEntryGate,
    now: DateTime<Utc>,
) -> Result<(), EntryAcceptanceError> {
    if gate.status != "OPEN" {
        return Err(EntryAcceptanceError::QuestNotOpen);
    }
    if gate.deadline <= now {
        return Err(EntryAcceptanceError::DeadlinePassed);
    }
    if gate.accepted_entries >= i64::from(gate.max_entries) {
        return Err(EntryAcceptanceError::EntryLimitReached);
    }
    if !gate.participant_joined {
        return Err(EntryAcceptanceError::MembershipRequired);
    }
    Ok(())
}

fn validate_evidence(
    command: &AcceptEntryCommand,
    requirements: &[String],
) -> Result<(), EntryAcceptanceError> {
    if command
        .caption
        .as_deref()
        .is_some_and(|caption| caption.chars().count() > 280)
        || command.evidence.len() != requirements.len()
    {
        return Err(
            if command
                .caption
                .as_deref()
                .is_some_and(|caption| caption.chars().count() > 280)
            {
                EntryAcceptanceError::InvalidCaption
            } else {
                EntryAcceptanceError::InvalidEvidence
            },
        );
    }

    let required: HashSet<&str> = requirements.iter().map(String::as_str).collect();
    let submitted: HashSet<&str> = command
        .evidence
        .iter()
        .map(|item| item.proof_type.as_str())
        .collect();
    if required != submitted || submitted.len() != command.evidence.len() {
        return Err(EntryAcceptanceError::InvalidEvidence);
    }

    let media_prefix = format!("{}/{}/", command.participant_id, command.quest_id);
    for item in &command.evidence {
        let value = item.value.trim();
        if !PROOF_TYPES.contains(&item.proof_type.as_str())
            || value.is_empty()
            || value.chars().count() > 2048
            || (matches!(item.proof_type.as_str(), "PHOTO" | "VIDEO")
                && !value.starts_with(&media_prefix))
            || (item.proof_type == "LINK"
                && !value.starts_with("https://")
                && !value.starts_with("http://"))
        {
            return Err(EntryAcceptanceError::InvalidEvidence);
        }
    }

    Ok(())
}

/// Accepts one official entry while holding a row lock on its quest.
///
/// Locking the quest before counting accepted entries serializes submissions
/// for the same quest. If only one slot remains, concurrent requests cannot
/// both observe and consume it.
pub async fn accept_entry(
    pool: &PgPool,
    command: AcceptEntryCommand,
) -> Result<AcceptedEntry, EntryAcceptanceError> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|_| EntryAcceptanceError::Database)?;
    let now = Utc::now();

    let row = sqlx::query(
        r#"
        select
            q.status::text as status,
            q.deadline,
            q.max_entries,
            q.proof_requirements,
            (select count(*) from quest_entries e where e.quest_id = q.id) as accepted_entries,
            exists (
              select 1 from quest_participants p
              where p.quest_id = q.id and p.user_id = $2
            ) as participant_joined
        from quests q
        where q.id = $1
        for update
        "#,
    )
    .bind(command.quest_id)
    .bind(command.participant_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| EntryAcceptanceError::Database)?
    .ok_or(EntryAcceptanceError::QuestNotFound)?;

    let gate = QuestEntryGate {
        status: row
            .try_get("status")
            .map_err(|_| EntryAcceptanceError::Database)?,
        deadline: row
            .try_get("deadline")
            .map_err(|_| EntryAcceptanceError::Database)?,
        max_entries: row
            .try_get("max_entries")
            .map_err(|_| EntryAcceptanceError::Database)?,
        accepted_entries: row
            .try_get("accepted_entries")
            .map_err(|_| EntryAcceptanceError::Database)?,
        proof_requirements: row
            .try_get("proof_requirements")
            .map_err(|_| EntryAcceptanceError::Database)?,
        participant_joined: row
            .try_get("participant_joined")
            .map_err(|_| EntryAcceptanceError::Database)?,
    };
    validate_entry_gate(&gate, now)?;
    validate_evidence(&command, &gate.proof_requirements)?;

    let inserted = sqlx::query(
        r#"
        insert into quest_entries (quest_id, participant_id, caption, submitted_at)
        values ($1, $2, $3, $4)
        returning id, submitted_at
        "#,
    )
    .bind(command.quest_id)
    .bind(command.participant_id)
    .bind(command.caption.as_deref().map(str::trim))
    .bind(now)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| {
        if error
            .as_database_error()
            .and_then(|database_error| database_error.code())
            .as_deref()
            == Some("23505")
        {
            EntryAcceptanceError::DuplicateEntry
        } else {
            EntryAcceptanceError::Database
        }
    })?;

    let entry_id: Uuid = inserted
        .try_get("id")
        .map_err(|_| EntryAcceptanceError::Database)?;
    for item in &command.evidence {
        sqlx::query(
            r#"
            insert into entry_evidence (entry_id, proof_type, value)
            values ($1, $2, $3)
            "#,
        )
        .bind(entry_id)
        .bind(&item.proof_type)
        .bind(item.value.trim())
        .execute(&mut *transaction)
        .await
        .map_err(|_| EntryAcceptanceError::Database)?;
    }

    let entry_count = gate.accepted_entries + 1;
    let quest_closed_for_review = entry_count >= i64::from(gate.max_entries);
    if quest_closed_for_review {
        sqlx::query(
            r#"
            update quests
            set status = 'CLOSED_FOR_REVIEW', closed_at = $2, updated_at = $2
            where id = $1
            "#,
        )
        .bind(command.quest_id)
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(|_| EntryAcceptanceError::Database)?;
    }

    transaction
        .commit()
        .await
        .map_err(|_| EntryAcceptanceError::Database)?;

    Ok(AcceptedEntry {
        id: entry_id,
        submitted_at: inserted
            .try_get("submitted_at")
            .map_err(|_| EntryAcceptanceError::Database)?,
        quest_closed_for_review,
    })
}

#[derive(Debug, Deserialize)]
pub struct SubmitEntry {
    caption: Option<String>,
    evidence: Vec<EntryEvidenceInput>,
}

#[derive(Debug, Error)]
pub enum EntryError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error(transparent)]
    Acceptance(#[from] EntryAcceptanceError),
}

impl ResponseError for EntryError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::Acceptance(error) => match error {
                EntryAcceptanceError::QuestNotFound => StatusCode::NOT_FOUND,
                EntryAcceptanceError::InvalidCaption | EntryAcceptanceError::InvalidEvidence => {
                    StatusCode::UNPROCESSABLE_ENTITY
                }
                EntryAcceptanceError::Database => StatusCode::SERVICE_UNAVAILABLE,
                _ => StatusCode::CONFLICT,
            },
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }

        let Self::Acceptance(error) = self else {
            unreachable!()
        };
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match error {
                EntryAcceptanceError::QuestNotFound => "quest_not_found",
                EntryAcceptanceError::QuestNotOpen => "quest_not_open",
                EntryAcceptanceError::DeadlinePassed => "deadline_passed",
                EntryAcceptanceError::EntryLimitReached => "entry_limit_reached",
                EntryAcceptanceError::DuplicateEntry => "duplicate_entry",
                EntryAcceptanceError::MembershipRequired => "membership_required",
                EntryAcceptanceError::InvalidCaption => "invalid_caption",
                EntryAcceptanceError::InvalidEvidence => "invalid_evidence",
                EntryAcceptanceError::Database => "entry_service_unavailable",
            },
            "message": error.to_string(),
        }))
    }
}

#[post("/quests/{quest_id}/entries")]
pub async fn submit_entry(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
    submission: web::Json<SubmitEntry>,
) -> Result<(web::Json<AcceptedEntry>, StatusCode), EntryError> {
    let user = state.auth.authenticate(&request).await?;
    let accepted = accept_entry(
        &state.database,
        AcceptEntryCommand {
            quest_id: quest_id.into_inner(),
            participant_id: user.id,
            caption: submission.caption.clone(),
            evidence: submission.evidence.clone(),
        },
    )
    .await?;

    Ok((web::Json(accepted), StatusCode::CREATED))
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    fn gate(status: &str, deadline: DateTime<Utc>, max: i16, accepted: i64) -> QuestEntryGate {
        QuestEntryGate {
            status: status.to_string(),
            deadline,
            max_entries: max,
            accepted_entries: accepted,
            proof_requirements: vec!["PHOTO".to_string()],
            participant_joined: true,
        }
    }

    fn command(proof_type: &str, value: &str) -> AcceptEntryCommand {
        let participant_id = Uuid::new_v4();
        let quest_id = Uuid::new_v4();
        AcceptEntryCommand {
            quest_id,
            participant_id,
            caption: Some("Made it just before sunset.".to_string()),
            evidence: vec![EntryEvidenceInput {
                proof_type: proof_type.to_string(),
                value: if matches!(proof_type, "PHOTO" | "VIDEO") {
                    format!("{participant_id}/{quest_id}/{value}")
                } else {
                    value.to_string()
                },
            }],
        }
    }

    #[test]
    fn accepts_when_a_slot_remains() {
        let now = Utc::now();
        assert!(validate_entry_gate(&gate("OPEN", now + Duration::hours(1), 5, 4), now).is_ok());
    }

    #[test]
    fn rejects_when_entry_limit_is_reached() {
        let now = Utc::now();
        assert_eq!(
            validate_entry_gate(&gate("OPEN", now + Duration::hours(1), 5, 5), now),
            Err(EntryAcceptanceError::EntryLimitReached)
        );
    }

    #[test]
    fn rejects_late_submissions() {
        let now = Utc::now();
        assert_eq!(
            validate_entry_gate(&gate("OPEN", now - Duration::seconds(1), 5, 0), now),
            Err(EntryAcceptanceError::DeadlinePassed)
        );
    }

    #[test]
    fn rejects_non_open_quests() {
        let now = Utc::now();
        assert_eq!(
            validate_entry_gate(
                &gate("CLOSED_FOR_REVIEW", now + Duration::hours(1), 5, 2),
                now
            ),
            Err(EntryAcceptanceError::QuestNotOpen)
        );
    }

    #[test]
    fn requires_quest_membership() {
        let now = Utc::now();
        let mut gate = gate("OPEN", now + Duration::hours(1), 5, 0);
        gate.participant_joined = false;
        assert_eq!(
            validate_entry_gate(&gate, now),
            Err(EntryAcceptanceError::MembershipRequired)
        );
    }

    #[test]
    fn accepts_matching_photo_evidence_in_the_participants_folder() {
        let command = command("PHOTO", "proof.jpg");
        assert!(validate_evidence(&command, &["PHOTO".to_string()]).is_ok());
    }

    #[test]
    fn rejects_missing_or_unexpected_proof() {
        let command = command("LINK", "https://example.com/proof");
        assert_eq!(
            validate_evidence(&command, &["PHOTO".to_string()]),
            Err(EntryAcceptanceError::InvalidEvidence)
        );
    }

    #[test]
    fn rejects_media_outside_the_participant_quest_folder() {
        let mut command = command("VIDEO", "proof.mp4");
        command.evidence[0].value = "another-user/another-quest/proof.mp4".to_string();
        assert_eq!(
            validate_evidence(&command, &["VIDEO".to_string()]),
            Err(EntryAcceptanceError::InvalidEvidence)
        );
    }
}
