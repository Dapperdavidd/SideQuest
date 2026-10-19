# Technical validation — 14 October 2026

## Confirmed

- Nimiq Pay Mini Apps are ordinary web apps hosted inside a WebView with injected Nimiq and EVM providers.
- `@nimiq/mini-app-sdk` is the documented provider initialization layer.
- NIM payments and signing are native capabilities.
- Polygon is a documented supported EVM network, and ERC-20 assets including USDT are accessible through the injected EVM provider.
- Wallet requests require explicit native user approval and do not expose private keys to the mini app.
- Supabase Auth supports Next.js SSR, Flutter, Google, Apple, and email authentication.

## Development setup confirmed

- Supabase project URL, publishable key, database connection, migrations, and redirect allow list are configured for the development environment.
- Google OAuth is configured through Supabase and the browser sign-in flow has completed successfully.
- The dedicated TestAlbatross treasury and local payout signer are configured for direct NIM rewards.

## External setup still required

- Apple Developer Team ID, Services ID, App ID/bundle identifier, Sign in with Apple capability, and signing key.
- Production domains and callback URLs.
- Production hosting accounts, secret stores, and observability destinations.
- Nimiq competition registration/submission details and production settlement accounts.
- Legal review for contests, incentivized promotional content, crypto settlement, custody, and Nigerian payment flows.

## Release constraint

The iOS product remains full-featured during development. App Store behavior will be adjusted only in response to confirmed policy analysis or actual review feedback; restricted functionality will not be hidden from review.

## Mobile callback

The Flutter clients register `app.sidequest://login-callback/` for Supabase email and OAuth redirects. Add this exact URL to the Supabase redirect allow list. Android declares Internet access in its production manifest; iOS and Android both route the callback to the singleTop Flutter activity/application.
