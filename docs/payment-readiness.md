# Verified reward funding readiness

SideQuest does not mark a monetary quest funded because a browser reports that a wallet dialog succeeded. The API must independently verify the chain transaction, its recipient, amount, network, memo/reference, and confirmation depth before moving a quest from `AWAITING_FUNDING` to `OPEN`.

## Implemented funding surface

- Nimiq Pay injects the Mini App provider and presents native confirmation for sensitive wallet operations. The installed `@nimiq/mini-app-sdk` exposes `sendBasicTransactionWithData`, returns a transaction hash, and expresses values in luna, where 100,000 luna equals 1 NIM.
- The private verifier uses the official `@nimiq/core` Node.js Web Client, explicitly selects TestAlbatross and its official testnet seed nodes, establishes consensus, and fetches the transaction by the wallet-returned hash.
- The verifier rejects any network, treasury recipient, integer-luna amount, or `SQF:` payment-reference mismatch. The Rust API repeats those checks before storing the receipt.
- A matching transaction is recorded as pending until its state is `confirmed` and it reaches the configured confirmation depth. Only then does one database transaction confirm the intent, mark the reward pool funded, and open the quest.
- The existing database already separates reward pools, payment intents, observed transactions, reward allocations, and payouts. Provider references and idempotency keys are unique, and quest opening remains gated on confirmed funding.
- Authenticated participants can register one checksum-validated TestAlbatross payout destination. Rewarded submissions snapshot that address when the official entry is accepted, so changing a profile later cannot redirect an already-earned reward.
- Quest finalization atomically creates one immutable reward allocation and one idempotent pending payout for each winner. The pending records deliberately remain unsigned until the isolated signer is configured.
- The local isolated signer is implemented as a loopback-only service. It validates a bearer token, checks that its Keychain-provided private key derives the configured treasury address, serializes each signed transaction into an owner-only durable ledger before broadcast, and rejects idempotency-key reuse with changed payout details.

References:

- [Nimiq Mini Apps Framework](https://www.nimiq.com/blog/mini-apps-framework/)
- [Nimiq RPC overview](https://nimiq.dev/rpc/)
- [Nimiq RPC methods](https://nimiq.dev/rpc/methods/)
- [Nimiq public mainnet RPC limitations](https://rpc.nimiqwatch.com/)

## Settlement decision

The app needs one explicit settlement model:

1. **Isolated testnet escrow signer — selected for the competition.** Creators fund the dedicated SideQuest testnet treasury. The API verifies deposits through the TestAlbatross verifier. After finalization, a separate restricted signing service submits winner payouts. The API never stores or receives a raw private key.
2. **Creator-direct payouts.** The creator pays winners from their own wallet after finalization. This remains self-custodial but cannot guarantee or automate payout and therefore does not satisfy the current verified-payout requirement by itself.
3. **Third-party custody/payment provider.** Appropriate for real funds only after provider, legal, fee, webhook-signature, reconciliation, refund, and regional availability review.

Do not place a treasury private key, seed phrase, or raw signing material in `.env`, Supabase, the browser bundle, Flutter assets, source control, or chat.

For the local competition setup, `scripts/configure-local-signer.sh` accepts the private key through a silent terminal prompt and stores it in macOS Keychain. `scripts/start-local-signer.sh` retrieves it only into the signer process environment. The generated API-to-signer token is stored in Keychain and copied into the ignored local `.env` for the API client.

## Inputs needed for the recommended testnet path

- `NIMIQ_TREASURY_ADDRESS`: a dedicated Nimiq testnet receiving address.
- `NIMIQ_VERIFIER_URL`: the private URL of the SideQuest verifier service. The verifier uses Nimiq's official Node.js Web Client to join TestAlbatross directly, so development does not depend on an unlisted public testnet RPC server.
- `NIMIQ_MIN_CONFIRMATIONS`: the confirmation policy; development currently requires two.
- Reward denomination policy: either publish rewards directly in NIM, or approve a server-side USD/NIM quote source, quote lifetime, rounding rule, and slippage policy.
- `PAYOUT_SIGNER_URL`: an isolated service that accepts an authenticated, idempotent payout command and never exports its key.
- `PAYOUT_SIGNER_TOKEN`: a server-only credential for that service, stored through the deployment secret manager.
- Winner wallet-address collection uses a checksum-validated Nimiq address and locks a snapshot when the official rewarded entry is submitted.

USDT additionally requires an approved Polygon Amoy RPC endpoint, the exact supported testnet token contract, decimal handling, receipt/log verification, gas policy, and an EVM payout signer. It should follow after the NIM path is verified end to end.

## Planned server flow

1. The creator publishes a reward quest; it stays `AWAITING_FUNDING`.
2. The authenticated creator requests an idempotent payment intent. The API calculates the complete prize pool in integer luna, selects the configured treasury, creates a unique reference, and returns the same active intent on safe retries.
3. The server fixes the settlement amount, expiry, network, treasury recipient, and unique quest memo/reference.
4. Nimiq Pay asks the creator to approve `sendBasicTransactionWithData` and broadcasts the transaction.
5. The client submits only the resulting transaction hash to the API; client success remains `PENDING`, never `CONFIRMED`.
6. The verifier independently reads the chain and compares network, recipient, amount, memo/reference, and confirmation depth.
7. A matching transaction atomically confirms the intent, funds the reward pool, and opens the quest. Replays return the existing intent/transaction result.
8. Finalization creates one allocation and pending payout per winner using the destination locked with the entry. The signing service submits each payout with its immutable idempotency key.
9. The verifier independently confirms payouts before the UI displays them as paid.
10. Expiry, underpayment, overpayment, failed payout, refund, and reconciliation paths remain explicit states with audit records.

## Environment placeholders

The root `.env.example` contains all non-secret names required by this design. `NIMIQ_VERIFIER_TOKEN` is optional only while the verifier is bound to loopback; it becomes mandatory if the verifier is exposed on another interface. The ignored local `.env` contains the development values. Financial features fail closed while required public configuration is absent.
