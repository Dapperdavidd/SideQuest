# Verified reward funding readiness

SideQuest does not mark a monetary quest funded because a browser reports that a wallet dialog succeeded. The API must independently verify the chain transaction, its recipient, amount, network, memo/reference, and confirmation depth before moving a quest from `AWAITING_FUNDING` to `OPEN`.

## Confirmed integration surface

- Nimiq Pay injects the Mini App provider and presents native confirmation for sensitive wallet operations. The installed `@nimiq/mini-app-sdk` exposes `sendBasicTransaction` and `sendBasicTransactionWithData`; values are expressed in luna, where 100,000 luna equals 1 NIM.
- Nimiq's JSON-RPC API exposes `getTransactionByHash` and related history methods for backend verification. A production verifier needs a history-enabled RPC endpoint for the selected network.
- The existing database already separates reward pools, payment intents, observed transactions, reward allocations, and payouts. Provider references and idempotency keys are unique, and quest opening remains gated on confirmed funding.

References:

- [Nimiq Mini Apps Framework](https://www.nimiq.com/blog/mini-apps-framework/)
- [Nimiq RPC overview](https://nimiq.dev/rpc/)
- [Nimiq RPC methods](https://nimiq.dev/rpc/methods/)
- [Nimiq public mainnet RPC limitations](https://rpc.nimiqwatch.com/)

## Decision required before financial endpoints are enabled

The app needs one explicit settlement model:

1. **Isolated testnet escrow signer — recommended for the competition.** Creators fund a dedicated testnet address. The API verifies deposits through a configured testnet history node. After finalization, a separate restricted signing service submits winner payouts. The API never stores or receives a raw private key.
2. **Creator-direct payouts.** The creator pays winners from their own wallet after finalization. This remains self-custodial but cannot guarantee or automate payout and therefore does not satisfy the current verified-payout requirement by itself.
3. **Third-party custody/payment provider.** Appropriate for real funds only after provider, legal, fee, webhook-signature, reconciliation, refund, and regional availability review.

Do not place a treasury private key, seed phrase, or raw signing material in `.env`, Supabase, the browser bundle, Flutter assets, source control, or chat.

## Inputs needed for the recommended testnet path

- `NIMIQ_TREASURY_ADDRESS`: a dedicated Nimiq testnet receiving address.
- `NIMIQ_RPC_URL`: a history-enabled testnet JSON-RPC endpoint that supports `getTransactionByHash`.
- `NIMIQ_MIN_CONFIRMATIONS`: the confirmation policy; the placeholder is two.
- Reward denomination policy: either publish rewards directly in NIM, or approve a server-side USD/NIM quote source, quote lifetime, rounding rule, and slippage policy.
- `PAYOUT_SIGNER_URL`: an isolated service that accepts an authenticated, idempotent payout command and never exports its key.
- `PAYOUT_SIGNER_TOKEN`: a server-only credential for that service, stored through the deployment secret manager.
- Winner wallet-address collection and change policy, including whether an address is locked when a user joins, submits, or wins.

USDT additionally requires an approved Polygon Amoy RPC endpoint, the exact supported testnet token contract, decimal handling, receipt/log verification, gas policy, and an EVM payout signer. It should follow after the NIM path is verified end to end.

## Planned server flow

1. The creator publishes a reward quest; it stays `AWAITING_FUNDING`.
2. The authenticated creator requests an idempotent payment intent.
3. The server fixes the settlement amount, expiry, network, treasury recipient, and unique quest memo/reference.
4. Nimiq Pay asks the creator to approve `sendBasicTransactionWithData`.
5. The client submits the resulting transaction identifier/serialized result to the API; client success remains `PENDING`, never `CONFIRMED`.
6. The verifier independently reads the chain and compares network, recipient, amount, memo/reference, and confirmation depth.
7. A matching transaction atomically confirms the intent, funds the reward pool, and opens the quest. Replays return the existing intent/transaction result.
8. Finalization creates one allocation per winner. The signing service submits each payout with an immutable idempotency key.
9. The verifier independently confirms payouts before the UI displays them as paid.
10. Expiry, underpayment, overpayment, failed payout, refund, and reconciliation paths remain explicit states with audit records.

## Environment placeholders

The root `.env.example` contains all non-secret names required by this design. The ignored local `.env` also contains blank placeholders. Financial features must fail closed while any required value is absent.
