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

print "Enter the dedicated TestAlbatross treasury private key."
print "It stays in macOS Keychain and is never written to the repository or .env."
read -r -s "private_key?32-byte private key (64 hex characters): "
print
if (( ${#private_key} != 64 )) || [[ "$private_key" == *[^0-9A-Fa-f]* ]]; then
  print -u2 "The private key must contain exactly 64 hexadecimal characters."
  exit 1
fi

cd "$repo_root/services/nimiq-signer"
derived_address=$(PAYOUT_SIGNER_PRIVATE_KEY="$private_key" node --import "$repo_root/services/nimiq-signer/src/node-globals.mjs" --input-type=module -e '
  const Nimiq = await import("@nimiq/core");
  const key = Nimiq.PrivateKey.fromHex(process.env.PAYOUT_SIGNER_PRIVATE_KEY);
  process.stdout.write(Nimiq.KeyPair.derive(key).toAddress().toUserFriendlyAddress());
')
if [[ "$derived_address" != "$treasury_address" ]]; then
  unset private_key
  print -u2 "That key derives $derived_address, not the configured SideQuest treasury."
  exit 1
fi

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

print "Local payout signer configured for $derived_address."
print "The private key and signer token are stored in macOS Keychain."
