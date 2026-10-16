import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { PayoutLedger } from "../src/ledger.mjs";
import { derivePrivateKeyForAddress, readUtf8Stream } from "../src/derive-key.mjs";
import { authorize, payoutFingerprint, SignerError, validatePayout } from "../src/validation.mjs";
import * as Nimiq from "@nimiq/core";

const valid = {
  idempotency_key: "payout:quest:winner",
  recipient: "NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0",
  value_luna: 100000,
  reference: "SQP:12345678",
  network: "testnet",
};

test("accepts a complete testnet payout command", () => {
  assert.deepEqual(validatePayout(valid), {
    idempotencyKey: valid.idempotency_key,
    recipient: valid.recipient,
    valueLuna: valid.value_luna,
    reference: valid.reference,
    network: valid.network,
  });
});

for (const [name, change, code] of [
  ["amount", { value_luna: 1.5 }, "invalid_amount"],
  ["network", { network: "mainnet" }, "wrong_network"],
  ["reference", { reference: "not-sidequest" }, "invalid_reference"],
  ["idempotency", { idempotency_key: "has spaces" }, "invalid_idempotency_key"],
]) {
  test(`rejects an invalid ${name}`, () => {
    assert.throws(
      () => validatePayout({ ...valid, ...change }),
      (error) => error instanceof SignerError && error.code === code,
    );
  });
}

test("compares bearer tokens without accepting partial values", () => {
  assert.equal(authorize("Bearer exact-token", "exact-token"), true);
  assert.equal(authorize("Bearer exact", "exact-token"), false);
  assert.equal(authorize(undefined, "exact-token"), false);
});

test("persists a signed transaction before submission and reuses it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sidequest-signer-"));
  const path = join(directory, "ledger.json");
  try {
    const ledger = await new PayoutLedger(path).load();
    const command = validatePayout(valid);
    const fingerprint = payoutFingerprint(command);
    const reserved = await ledger.reserve({
      idempotency_key: command.idempotencyKey,
      fingerprint,
      transaction_hex: "signed-transaction",
      transaction_hash: null,
    });
    assert.equal(reserved.transaction_hex, "signed-transaction");
    const reloaded = await new PayoutLedger(path).load();
    assert.equal(reloaded.get(command.idempotencyKey, fingerprint).transaction_hex, "signed-transaction");
    await reloaded.markSubmitted(command.idempotencyKey, "abcdef");
    const stored = JSON.parse(await readFile(path, "utf8"));
    assert.equal(stored.payouts[0].transaction_hash, "abcdef");
    await assert.rejects(
      () => reloaded.reserve({ idempotency_key: command.idempotencyKey, fingerprint: "different" }),
      (error) => error instanceof SignerError && error.code === "idempotency_conflict",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts a raw private key only when it matches the treasury", () => {
  const privateKey = Nimiq.PrivateKey.generate();
  const address = Nimiq.KeyPair.derive(privateKey).toAddress().toUserFriendlyAddress();
  assert.equal(derivePrivateKeyForAddress(privateKey.toHex(), address), privateKey.toHex());
  assert.throws(
    () => derivePrivateKeyForAddress(privateKey.toHex(), valid.recipient),
    /not the configured treasury/,
  );
});

test("derives a treasury key from recovery words", () => {
  const mnemonic = Nimiq.Entropy.generate().toMnemonic().join(" ");
  const extendedKey = Nimiq.MnemonicUtils.mnemonicToExtendedPrivateKey(mnemonic);
  const address = extendedKey.toAddress().toUserFriendlyAddress();
  assert.equal(
    derivePrivateKeyForAddress(mnemonic, address),
    extendedKey.privateKey.toHex(),
  );
});

test("reads a recovery secret from a piped standard-input stream", async () => {
  const secret = "word one word two";
  assert.equal(await readUtf8Stream(Readable.from([secret])), secret);
});
