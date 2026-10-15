import test from "node:test";
import assert from "node:assert/strict";
import { decodeRawData, validateExpectedTransaction, VerificationError } from "../src/validation.mjs";

const expected = {
  recipient: "NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0",
  value_luna: 1_000_000,
  reference: "SQF:0123456789abcdef",
};

function transaction(overrides = {}) {
  return {
    network: "TestAlbatross",
    recipient: "NQ24VU9V76NVSRFAQVGJJE50139Q3U38DUN0",
    value: 1_000_000,
    data: { raw: Buffer.from(expected.reference).toString("hex") },
    ...overrides,
  };
}

test("decodes a raw Nimiq data payload", () => {
  assert.equal(decodeRawData(transaction().data), expected.reference);
});

test("accepts the exact network, treasury, amount, and reference", () => {
  assert.doesNotThrow(() => validateExpectedTransaction(transaction(), expected));
});

for (const [name, overrides, code] of [
  ["network", { network: "MainAlbatross" }, "wrong_network"],
  ["recipient", { recipient: "NQ00 0000 0000 0000 0000 0000 0000 0000 0000" }, "wrong_recipient"],
  ["amount", { value: 999_999 }, "wrong_amount"],
  ["reference", { data: { raw: Buffer.from("different").toString("hex") } }, "wrong_reference"],
]) {
  test(`rejects a mismatched ${name}`, () => {
    assert.throws(
      () => validateExpectedTransaction(transaction(overrides), expected),
      (error) => error instanceof VerificationError && error.code === code,
    );
  });
}
