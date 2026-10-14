use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{PgPool, Row};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AcceptEntryCommand {
    pub quest_id: Uuid,
    pub participant_id: Uuid,
    pub caption: Option<String>,
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
    #[error("entry could not be accepted")]
    Database,
}

#[derive(Debug)]
struct QuestEntryGate {
    status: String,
    deadline: DateTime<Utc>,
    max_entries: i16,
    accepted_entries: i64,
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
            (select count(*) from quest_entries e where e.quest_id = q.id) as accepted_entries
        from quests q
        where q.id = $1
        for update
        "#,
    )
    .bind(command.quest_id)
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
    };
    validate_entry_gate(&gate, now)?;

    let inserted = sqlx::query(
        r#"
        insert into quest_entries (quest_id, participant_id, caption, submitted_at)
        values ($1, $2, $3, $4)
        returning id, submitted_at
        "#,
    )
    .bind(command.quest_id)
    .bind(command.participant_id)
    .bind(command.caption)
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
        id: inserted
            .try_get("id")
            .map_err(|_| EntryAcceptanceError::Database)?,
        submitted_at: inserted
            .try_get("submitted_at")
            .map_err(|_| EntryAcceptanceError::Database)?,
        quest_closed_for_review,
    })
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
}
