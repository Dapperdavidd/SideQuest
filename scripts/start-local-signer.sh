#!/bin/zsh
set -euo pipefail

repo_root="${0:A:h:h}"
key_service="sidequest-payout-private-key"
token_service="sidequest-payout-signer-token"
keychain_account="sidequest-local"

private_key=$(security find-generic-password -a "$keychain_account" -s "$key_service" -w)
shared_token=$(security find-generic-password -a "$keychain_account" -s "$token_service" -w)

cd "$repo_root"
exec env \
  SIGNER_HOST="127.0.0.1" \
  SIGNER_PORT="8091" \
  NIMIQ_TREASURY_ADDRESS="NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0" \
  PAYOUT_SIGNER_PRIVATE_KEY="$private_key" \
  PAYOUT_SIGNER_TOKEN="$shared_token" \
  PAYOUT_SIGNER_LEDGER_PATH="$repo_root/.runtime/payout-signer-ledger.json" \
  pnpm start:nimiq-signer
