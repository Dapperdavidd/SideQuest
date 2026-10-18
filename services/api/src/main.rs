use std::io;

use actix_cors::Cors;
use actix_web::{App, HttpServer, middleware::Logger, web};
use api::{
    AppState, PaymentConfig, PayoutSignerConfig, auth::AuthVerifier, configure_routes,
    payments::run_payout_worker, quests::run_deadline_worker,
};
use sqlx::postgres::PgPoolOptions;
use std::collections::HashSet;
use uuid::Uuid;

#[actix_web::main]
async fn main() -> io::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "api=info,actix_web=info".into()),
        )
        .init();

    let host = std::env::var("API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let database_url = std::env::var("DATABASE_URL").map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "DATABASE_URL must be configured",
        )
    })?;
    let jwks_url = std::env::var("SUPABASE_JWKS_URL").map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "SUPABASE_JWKS_URL must be configured",
        )
    })?;
    let database = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .map_err(io::Error::other)?;
    let shutdown_database = database.clone();
    let payments = payment_config_from_environment();
    if payments.is_none() {
        tracing::warn!("Nimiq funding is disabled because its public configuration is incomplete");
    }
    let payout_signer = payout_signer_config_from_environment();
    if payout_signer.is_none() {
        tracing::warn!(
            "automatic NIM payouts are disabled because the local signer is not configured"
        );
    }
    let state = AppState {
        database,
        auth: AuthVerifier::new(jwks_url),
        payments,
        payout_signer,
        admin_user_ids: admin_user_ids_from_environment(),
    };
    let payout_worker_state = state.clone();
    actix_web::rt::spawn(async move { run_payout_worker(payout_worker_state).await });
    let deadline_worker_state = state.clone();
    actix_web::rt::spawn(async move { run_deadline_worker(deadline_worker_state).await });

    tracing::info!(%host, %port, "starting SideQuest API");

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .configure(configure_routes)
    })
    .bind((host, port))?
    .run()
    .await?;
    shutdown_database.close().await;
    Ok(())
}

fn admin_user_ids_from_environment() -> HashSet<Uuid> {
    std::env::var("SIDEQUEST_ADMIN_USER_IDS")
        .unwrap_or_default()
        .split(',')
        .filter_map(|value| {
            let value = value.trim();
            if value.is_empty() {
                return None;
            }
            match Uuid::parse_str(value) {
                Ok(id) => Some(id),
                Err(_) => {
                    tracing::warn!("ignoring an invalid SIDEQUEST_ADMIN_USER_IDS entry");
                    None
                }
            }
        })
        .collect()
}

fn payout_signer_config_from_environment() -> Option<PayoutSignerConfig> {
    let url = std::env::var("PAYOUT_SIGNER_URL").ok()?;
    let token = std::env::var("PAYOUT_SIGNER_TOKEN").ok()?;
    if !url.starts_with("http://127.0.0.1:") || token.len() < 32 {
        return None;
    }
    Some(PayoutSignerConfig {
        url: url.trim_end_matches('/').to_string(),
        token,
    })
}

fn payment_config_from_environment() -> Option<PaymentConfig> {
    let network = std::env::var("NIMIQ_NETWORK").ok()?;
    let treasury_address = std::env::var("NIMIQ_TREASURY_ADDRESS").ok()?;
    let verifier_url = std::env::var("NIMIQ_VERIFIER_URL").ok()?;
    let verifier_token = std::env::var("NIMIQ_VERIFIER_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let min_confirmations = std::env::var("NIMIQ_MIN_CONFIRMATIONS")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(2);

    if network != "testnet"
        || !api::payments::is_valid_nimiq_address(&treasury_address)
        || !(verifier_url.starts_with("http://") || verifier_url.starts_with("https://"))
        || min_confirmations < 1
    {
        return None;
    }

    Some(PaymentConfig {
        network,
        treasury_address,
        min_confirmations,
        verifier_url: verifier_url.trim_end_matches('/').to_string(),
        verifier_token,
    })
}
