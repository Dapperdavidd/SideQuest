#!/bin/zsh
set -euo pipefail

repo_root="${0:A:h:h}"
env_file="$repo_root/.env"
key_service="sidequest-payout-private-key"
token_service="sidequest-payout-signer-token"
keychain_account="sidequest-local"
treasury_address="NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0"

if ! command -v security >/dev/null || ! command -v openssl >/dev/null; then
  print -u2 "macOS Keychain and OpenSSL are required."
  exit 1
fi

print "Enter the dedicated TestAlbatross treasury recovery phrase or private key."
print "It stays local, is converted in memory, and is never written to the repository or .env."
read -r -s "wallet_secret?Recovery words or 64-character private key: "
print
cd "$repo_root/services/nimiq-signer"
private_key=$(print -rn -- "$wallet_secret" | node --import "$repo_root/services/nimiq-signer/src/node-globals.mjs" "$repo_root/services/nimiq-signer/src/derive-key.mjs" "$treasury_address")
unset wallet_secret

shared_token=$(openssl rand -hex 32)
security add-generic-password -U -a "$keychain_account" -s "$key_service" -w "$private_key" >/dev/null
security add-generic-password -U -a "$keychain_account" -s "$token_service" -w "$shared_token" >/dev/null
unset private_key

touch "$env_file"
chmod 600 "$env_file"

upsert_env() {
  local key="$1"
  local value="$2"
  local temporary
  temporary=$(mktemp)
  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 { print key "=" value; replaced = 1; next }
    { print }
    END { if (!replaced) print key "=" value }
  ' "$env_file" > "$temporary"
  mv "$temporary" "$env_file"
  chmod 600 "$env_file"
}

upsert_env "PAYOUT_SIGNER_URL" "http://127.0.0.1:8091"
upsert_env "PAYOUT_SIGNER_TOKEN" "$shared_token"
upsert_env "PAYOUT_SIGNER_LEDGER_PATH" ".runtime/payout-signer-ledger.json"
unset shared_token

print "Local payout signer configured for $treasury_address."
print "The private key and signer token are stored in macOS Keychain."
