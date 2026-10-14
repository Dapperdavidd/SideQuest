# SideQuest architecture

SideQuest is a monorepo with two complete clients and one authoritative backend.

## Runtime boundaries

- `apps/web` is the responsive Next.js application and Nimiq Pay Mini App surface.
- `apps/mobile` is the Flutter iOS/Android application.
- `services/api` is the Rust/Actix Web domain API.
- PostgreSQL stores product state. Supabase provides the managed Postgres environment, authentication, and media storage.
- The API verifies Supabase-issued JWTs and owns all quest, entry, review, winner, and payment invariants.

Clients never decide whether an entry slot remains, whether a deadline has passed, whether a winner is valid, or whether money moved. Those decisions are transactional backend operations.

## Quest invariants

- `max_entries` is 1–10.
- `winner_count` is 1–3 and cannot exceed `max_entries`.
- A participant has one accepted official entry per quest.
- Joining and saving do not reserve an entry slot.
- Entry acceptance uses a database transaction and a row lock on the quest.
- First Valid winners are derived from trusted `submitted_at` order after validity review.
- Best Submission winners must be selected from valid entries and cannot exceed the published count.
- Published selection rules are immutable.
- Funding and payouts have provider references and idempotency keys. Provider confirmation is required before a successful state is recorded.

The entry repository locks the quest row before it reads the accepted-entry count, validates status and deadline against server time, inserts the official entry, and closes the quest in the same transaction when capacity is reached. The database uniqueness constraint prevents one participant from submitting twice. Accepted entries cannot be deleted by authenticated clients, so invalid review results do not silently reopen slots.

## Nimiq Mini App integration

The web app works without wallet access. Inside Nimiq Pay it feature-detects the host and initializes `@nimiq/mini-app-sdk`. NIM operations use the native provider. USDT uses the injected EVM provider on an explicitly supported chain. All sensitive wallet operations remain user-confirmed in Nimiq Pay.

No wallet connection is required for browsing, authentication, free quests, or ordinary social features.

## Authentication

Supabase Auth is shared across web and Flutter. Email and Google can be completed after a Supabase project and Google OAuth client are configured. Apple UI and callback boundaries can be implemented in code, but final activation requires Apple Developer identifiers and a signing key supplied by the account owner.
