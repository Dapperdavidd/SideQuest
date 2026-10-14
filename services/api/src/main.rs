use std::io;

use actix_cors::Cors;
use actix_web::{App, HttpServer, middleware::Logger, web};
use api::{AppState, configure_routes};

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

    tracing::info!(%host, %port, "starting SideQuest API");

    HttpServer::new(|| {
        App::new()
            .app_data(web::Data::new(AppState))
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .configure(configure_routes)
    })
    .bind((host, port))?
    .run()
    .await
}
