use serde::{Deserialize, Serialize};
use thiserror::Error;

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
}
