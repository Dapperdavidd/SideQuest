FROM rust:1.95-bookworm AS builder

WORKDIR /build
COPY services/api/Cargo.toml services/api/Cargo.lock ./
COPY services/api/src ./src
RUN cargo build --release --locked \
    && cp /build/target/release/api /tmp/sidequest-api

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 sidequest

COPY --from=builder /tmp/sidequest-api /usr/local/bin/sidequest-api

USER sidequest
ENV API_HOST=0.0.0.0 \
    API_PORT=8080 \
    RUST_LOG=api=info,actix_web=info
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=4 \
  CMD curl --fail --silent http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/sidequest-api"]
