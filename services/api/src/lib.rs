pub mod auth;
pub mod entries;
pub mod invitations;
pub mod moderation;
pub mod notifications;
pub mod payments;
pub mod profiles;
pub mod quests;
pub mod reviews;

use actix_web::{HttpResponse, Responder, get, web};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

use crate::auth::AuthVerifier;

#[derive(Clone)]
pub struct PaymentConfig {
    pub network: String,
    pub treasury_address: String,
    pub min_confirmations: i32,
    pub verifier_url: String,
    pub verifier_token: Option<String>,
}

#[derive(Clone)]
pub struct PayoutSignerConfig {
    pub url: String,
    pub token: String,
}

#[derive(Clone)]
pub struct AppState {
    pub database: PgPool,
    pub auth: AuthVerifier,
    pub payments: Option<PaymentConfig>,
    pub payout_signer: Option<PayoutSignerConfig>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    timestamp: DateTime<Utc>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok",
        service: "sidequest-api",
        timestamp: Utc::now(),
    })
}

pub fn configure_routes(config: &mut web::ServiceConfig) {
    config.service(health).service(
        web::scope("/api/v1")
            .service(profiles::get_me)
            .service(profiles::update_me)
            .service(profiles::get_profile)
            .service(profiles::get_achievements)
            .service(profiles::get_follow_state)
            .service(profiles::get_block_state)
            .service(profiles::follow_user)
            .service(profiles::unfollow_user)
            .service(profiles::block_user)
            .service(profiles::unblock_user)
            .service(profiles::list_followers)
            .service(profiles::list_following)
            .service(quests::list_quests)
            .service(quests::list_my_quests)
            .service(quests::list_saved_quests)
            .service(quests::get_quest)
            .service(quests::get_saved_quest_state)
            .service(quests::create_quest)
            .service(quests::publish_quest)
            .service(quests::join_quest)
            .service(quests::close_quest)
            .service(quests::cancel_quest)
            .service(quests::save_quest)
            .service(quests::remove_saved_quest)
            .service(quests::validate_quest)
            .service(invitations::create_invitation)
            .service(invitations::list_invitations)
            .service(invitations::revoke_invitation)
            .service(invitations::accept_invitation)
            .service(notifications::list_notifications)
            .service(notifications::unread_count)
            .service(notifications::mark_notification_read)
            .service(notifications::mark_all_notifications_read)
            .service(moderation::create_report)
            .service(payments::create_funding_intent)
            .service(payments::get_payout_destination)
            .service(payments::set_payout_destination)
            .service(payments::list_my_payouts)
            .service(payments::get_funding_intent)
            .service(payments::submit_funding_transaction)
            .service(payments::refresh_funding_transaction)
            .service(entries::submit_entry)
            .service(reviews::list_entries_for_creator)
            .service(reviews::review_entry)
            .service(reviews::get_quest_settlement)
            .service(reviews::list_public_winners)
            .service(reviews::finalize_quest),
    );
}

#[cfg(test)]
mod tests {
    use actix_web::{App, test};

    use super::*;

    #[actix_web::test]
    async fn health_check_is_available() {
        let app = test::init_service(App::new().configure(configure_routes)).await;
        let request = test::TestRequest::get().uri("/health").to_request();
        let response = test::call_service(&app, request).await;

        assert!(response.status().is_success());
    }
}
