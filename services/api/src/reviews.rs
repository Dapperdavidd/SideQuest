use std::collections::HashSet;

use chrono::{DateTime, Utc};
use thiserror::Error;
use uuid::Uuid;

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
