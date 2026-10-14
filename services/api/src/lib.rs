pub mod auth;
pub mod entries;
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
pub struct AppState {
    pub database: PgPool,
    pub auth: AuthVerifier,
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
            .service(quests::list_quests)
            .service(quests::get_quest)
            .service(quests::create_quest)
            .service(quests::publish_quest)
            .service(quests::join_quest)
            .service(quests::validate_quest)
            .service(entries::submit_entry)
            .service(reviews::list_entries_for_creator)
            .service(reviews::review_entry)
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
