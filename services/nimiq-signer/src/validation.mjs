import { createHash, timingSafeEqual } from "node:crypto";

export class SignerError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function authorize(header, expectedToken) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function validatePayout(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SignerError("invalid_request", "Payout command must be a JSON object.", 400);
  }
  const { idempotency_key: idempotencyKey, recipient, value_luna: valueLuna, reference, network } = body;
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(idempotencyKey)) {
    throw new SignerError("invalid_idempotency_key", "A stable payout idempotency key is required.");
  }
  if (typeof recipient !== "string" || recipient.length > 64) {
    throw new SignerError("invalid_recipient", "A Nimiq recipient address is required.");
  }
  if (!Number.isSafeInteger(valueLuna) || valueLuna <= 0) {
    throw new SignerError("invalid_amount", "Payout value must be a positive integer number of Luna.");
  }
  if (typeof reference !== "string" || !reference.startsWith("SQP:") || Buffer.byteLength(reference, "utf8") > 64) {
    throw new SignerError("invalid_reference", "A SideQuest payout reference of at most 64 bytes is required.");
  }
  if (network !== "testnet") {
    throw new SignerError("wrong_network", "Only Nimiq TestAlbatross payouts are supported.");
  }
  return { idempotencyKey, recipient, valueLuna, reference, network };
}

export function payoutFingerprint(command) {
  return createHash("sha256")
    .update(JSON.stringify({
      recipient: command.recipient,
      value_luna: command.valueLuna,
      reference: command.reference,
      network: command.network,
    }))
    .digest("hex");
}
