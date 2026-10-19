# Production deployment

SideQuest ships three deployable public services and one deliberately isolated signing process:

| Service | Container definition | Public traffic |
|---|---|---|
| Next.js web/PWA | `infrastructure/docker/web.Dockerfile` | HTTPS |
| Rust API | `infrastructure/docker/api.Dockerfile` | HTTPS |
| TestAlbatross verifier | `infrastructure/docker/nimiq-verifier.Dockerfile` | Private network only |
| NIM payout signer | Host-managed process | Loopback only; never public |

The signer is intentionally not included in a production container. The API accepts its URL only when it is loopback, and the signer keeps its treasury key outside the repository. Run both processes on the same trusted host or use an equivalent host-level sidecar that shares the API network namespace. Do not weaken the loopback restriction to make a general network deployment easier.

## Build images

Run these commands from the repository root. Replace the public values with the final production endpoints; Next.js embeds them during the web build.

```bash
docker build -f infrastructure/docker/api.Dockerfile -t sidequest-api .

docker build -f infrastructure/docker/nimiq-verifier.Dockerfile -t sidequest-verifier .

docker build -f infrastructure/docker/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PUBLISHABLE_KEY \
  -t sidequest-web .
```

All images run as an unprivileged user and include health checks. The API liveness check uses `/health`; configure the hosting platform's traffic-readiness probe to use `/ready` so database or configured payment-dependency outages stop new traffic.

The repository also includes a manual **Publish SideQuest images** GitHub Actions workflow. Before running it, set the repository variables `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It publishes immutable commit-SHA tags plus `latest` to the repository's GitHub Container Registry namespace. Manual dispatch prevents an ordinary code push from replacing a production image unexpectedly.

## API runtime environment

Required:

```text
API_HOST=0.0.0.0
API_PORT=8080
API_ALLOWED_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://...
DATABASE_MAX_CONNECTIONS=5
SUPABASE_JWKS_URL=https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
```

Verified NIM funding additionally requires:

```text
NIMIQ_NETWORK=testnet
NIMIQ_TREASURY_ADDRESS=NQ...
NIMIQ_VERIFIER_URL=http://verifier.internal:8090
NIMIQ_VERIFIER_TOKEN=at-least-32-random-characters
NIMIQ_MIN_CONFIRMATIONS=2
```

Automatic payouts require the host-managed signer:

```text
PAYOUT_SIGNER_URL=http://127.0.0.1:8091
PAYOUT_SIGNER_TOKEN=the-token-stored-in-the-host-keychain-or-secret-store
```

Set `SIDEQUEST_ADMIN_USER_IDS` to a comma-separated list of trusted Supabase user UUIDs. Never put a database password, signer token, treasury key, recovery phrase, or Supabase service-role key in an image build argument or committed file.

## Verifier runtime environment

```text
VERIFIER_HOST=0.0.0.0
VERIFIER_PORT=8090
VERIFIER_SHARED_TOKEN=the-same-value-as-NIMIQ_VERIFIER_TOKEN
NIMIQ_LOG_LEVEL=warn
```

Keep port 8090 private. The health route is intentionally unauthenticated for infrastructure probes; transaction routes require the shared token whenever the verifier binds beyond loopback.

## Release order

1. Apply every file in `supabase/migrations` to the production Supabase project in filename order.
2. Confirm Auth site URL, web callback URL, and `app.sidequest://login-callback/` are allowlisted in Supabase.
3. Deploy and wait for the verifier to establish TestAlbatross consensus.
4. Start the loopback signer on the trusted API host and confirm its owner-only ledger path is persistent.
5. Deploy the API and require `/ready` to return HTTP 200 before routing traffic.
6. Build and deploy the web image using the final public API and Supabase values.
7. Add the final web origin to `API_ALLOWED_ORIGINS` and verify the production CORS preflight.
8. Run email and Google authentication, free-quest, media-submission, review/finalization, NIM funding, and NIM payout smoke tests with test accounts.
9. Confirm the creator refund path using a quest finalized with fewer valid winners than funded winner positions.

## Rollback

- Keep the previously healthy web and API image tags available.
- Roll application images back independently; do not reverse applied database migrations unless a separately reviewed down migration exists.
- If the signer or verifier is unhealthy, stop routing API traffic rather than marking payments successful from the client.
- Never retry or recreate a payout manually outside the idempotent admin retry flow.

## External decisions still required

Code can produce and verify these images, but production launch still needs the owner to choose the hosting accounts and final domains, provide their secret stores, complete Apple signing, and approve the jurisdiction-specific legal/payment posture. NGN funding remains intentionally disabled until a compliant provider is selected.
