use actix_web::{HttpResponse, Responder, get, post, web};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WinnerSelectionMethod {
    FirstValid,
    BestSubmission,
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

#[derive(Serialize)]
struct QuestSummary {
    id: &'static str,
    title: &'static str,
    quest_type: &'static str,
    entries_received: u8,
    max_entries: u8,
    winner_count: u8,
}

#[get("/quests")]
pub async fn list_quests() -> impl Responder {
    HttpResponse::Ok().json(vec![QuestSummary {
        id: "city-sunset-challenge",
        title: "Catch the city at golden hour",
        quest_type: "EXPLORE",
        entries_received: 3,
        max_entries: 5,
        winner_count: 1,
    }])
}

#[post("/quests/validate")]
pub async fn validate_quest(rules: web::Json<QuestRules>) -> impl Responder {
    match rules.validate() {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::UnprocessableEntity().json(serde_json::json!({
            "code": "invalid_quest_rules",
            "message": error.to_string()
        })),
    }
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
}
