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

Run the independent Nimiq TestAlbatross verifier before testing reward funding:

```bash
pnpm dev:nimiq-verifier
```

The verifier binds to `127.0.0.1:8090` by default, joins the official TestAlbatross seed set, and exposes a health check at `/health`. It never holds treasury signing keys.

Configure the loopback-only payout signer once on macOS:

```bash
./scripts/configure-local-signer.sh
```

The silent setup prompt accepts either the treasury recovery phrase or its 64-character private key. It supports Nimiq recovery words and the standard `m/44'/242'/…'/0'` account path, then validates that the locally derived key matches the configured SideQuest treasury address. It stores only the matched private key and a generated service token in macOS Keychain; neither recovery words nor the private key are written to `.env` or the repository. Start the signer in its own terminal:

```bash
./scripts/start-local-signer.sh
```

The signer binds only to `127.0.0.1:8091`. It persists signed payout transactions to an ignored, owner-only local ledger before broadcasting, so an API retry reuses the exact same transaction.

When `PAYOUT_SIGNER_URL` and `PAYOUT_SIGNER_TOKEN` are configured, the API starts its payout worker automatically. Keep the signer and the independent verifier running alongside the API. The worker claims one pending payout under a database row lock, validates the complete signer receipt before recording `SUBMITTED`, and uses the independent verifier before recording `CONFIRMED`.

Run the API:

```bash
cargo run --manifest-path services/api/Cargo.toml
```

The API exposes two operational checks outside the versioned API prefix:

- `GET /health` confirms that the HTTP process is running.
- `GET /ready` confirms that the database and every configured payment dependency are reachable. It returns `503 Service Unavailable` until the service is safe to receive application traffic.

Run the mobile app:

```bash
cd apps/mobile
flutter run \
  --dart-define=API_URL=http://127.0.0.1:8080/api/v1 \
  --dart-define=MOBILE_WEB_URL=http://localhost:3000 \
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

The same formatting, test, analysis, lint, and production-build checks run automatically on every push to `main` and on pull requests through `.github/workflows/ci.yml`.

## Configuration

Copy the root `.env.example` for the API and `apps/web/.env.example` to `apps/web/.env.local` for the Next.js client. Provide a Supabase project URL and publishable key to activate email, Google, and Apple authentication. Provider dashboards must include the local and production callback URLs. Apple activation additionally requires Apple Developer identifiers and signing credentials.

`DATABASE_MAX_CONNECTIONS` defaults to five, which leaves headroom for migrations and dashboard access on Supabase's smaller session pools. Increase it only alongside the database or pooler's connection allowance.

`API_ALLOWED_ORIGINS` is a comma-separated allowlist for browser origins. It defaults to `http://localhost:3000`; set the deployed web origin explicitly before production traffic. Invalid values and wildcards are rejected rather than enabling permissive cross-origin access.

Wallet access is optional. The web app remains usable in a normal browser and detects Nimiq Pay at runtime before requesting wallet capabilities.

Monetary quests remain `AWAITING_FUNDING` until the API independently verifies the exact Nimiq Pay transaction through the TestAlbatross verifier. Client wallet success alone never opens a quest or records a payout. Automatic winner payouts remain disabled until the isolated signer is configured. See [verified reward funding readiness](docs/payment-readiness.md) for the full security model.

Unpublished quest drafts are resumable from **My quests** on both web and mobile. Draft rules can be changed only by the creator and become immutable as soon as the quest is published or enters reward funding.

Joined quests expose the participant's official submission result in **My quests** on both clients, including review validity and reason, winner state, and verified payout progress where applicable.

See [architecture](docs/architecture.md) and [technical validation](docs/technical-validation.md) for the current engineering decisions and external setup requirements.

For production images, health checks, environment boundaries, rollout order, and rollback rules, see the [deployment runbook](docs/deployment.md).
