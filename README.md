# SideQuest

Life comes with side quests.

SideQuest is a social challenge platform for small, limited-entry adventures with friends, communities, and local businesses. A quest accepts between one and ten official entries and has between one and three winners. It is deliberately not a job marketplace or mass-participation bounty platform.

## Repository

```text
apps/web                 Next.js web app and Nimiq Pay Mini App
apps/mobile              Flutter iOS and Android app
services/api             Rust / Actix Web API
packages/api-contract    OpenAPI contract
packages/design-tokens   Shared visual tokens
supabase/migrations      PostgreSQL schema and policies
infrastructure           Local and deployment infrastructure
docs                     Architecture and product engineering notes
```

## Prerequisites

- Node.js 24+
- pnpm 11+
- Rust stable
- Flutter stable
- Docker Desktop or PostgreSQL 16+

## Setup

```bash
pnpm install
cp .env.example .env
docker compose -f infrastructure/docker-compose.yml up -d
```

Run the web app:

```bash
pnpm dev:web
```

Run the API:

```bash
cargo run --manifest-path services/api/Cargo.toml
```

Run the mobile app:

```bash
cd apps/mobile
flutter run
```

## Verification

```bash
pnpm lint:web
pnpm build:web
cargo test --manifest-path services/api/Cargo.toml
flutter test apps/mobile
```

## Configuration

Copy `.env.example` and provide a Supabase project URL and publishable key to activate email, Google, and Apple authentication. Provider dashboards must include the local and production callback URLs. Apple activation additionally requires Apple Developer identifiers and signing credentials.

Wallet access is optional. The web app remains usable in a normal browser and detects Nimiq Pay at runtime before requesting wallet capabilities.

See [architecture](docs/architecture.md) and [technical validation](docs/technical-validation.md) for the current engineering decisions and external setup requirements.
