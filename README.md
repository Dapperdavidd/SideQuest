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
cp apps/web/.env.example apps/web/.env.local
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
flutter run \
  --dart-define=API_URL=http://127.0.0.1:8080/api/v1 \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Verification

```bash
pnpm lint:web
pnpm build:web
cargo test --manifest-path services/api/Cargo.toml
flutter test apps/mobile
```

## Configuration

Copy the root `.env.example` for the API and `apps/web/.env.example` to `apps/web/.env.local` for the Next.js client. Provide a Supabase project URL and publishable key to activate email, Google, and Apple authentication. Provider dashboards must include the local and production callback URLs. Apple activation additionally requires Apple Developer identifiers and signing credentials.

Wallet access is optional. The web app remains usable in a normal browser and detects Nimiq Pay at runtime before requesting wallet capabilities.

Monetary quests deliberately stop at `AWAITING_FUNDING` until chain verification and payout signing are configured. Client wallet success alone never opens a quest or records a payout. See [verified reward funding readiness](docs/payment-readiness.md) for the required infrastructure and environment values.

See [architecture](docs/architecture.md) and [technical validation](docs/technical-validation.md) for the current engineering decisions and external setup requirements.
