export function compactAddress(address) {
  return String(address).replace(/\s+/g, "").toUpperCase();
}

export function decodeRawData(data) {
  const raw = data && typeof data === "object" && "raw" in data ? data.raw : "";
  if (typeof raw !== "string") return "";
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) return "";
  return Buffer.from(hex, "hex").toString("utf8");
}

export function validateExpectedTransaction(transaction, expected) {
  if (transaction.network !== "TestAlbatross") {
    throw new VerificationError("wrong_network", "Transaction is not valid on TestAlbatross.");
  }
  if (compactAddress(transaction.recipient) !== compactAddress(expected.recipient)) {
    throw new VerificationError("wrong_recipient", "Transaction recipient does not match the funding intent.");
  }
  if (!Number.isSafeInteger(transaction.value) || transaction.value !== expected.value_luna) {
    throw new VerificationError("wrong_amount", "Transaction amount does not match the funding intent.");
  }
  if (decodeRawData(transaction.data) !== expected.reference) {
    throw new VerificationError("wrong_reference", "Transaction reference does not match the funding intent.");
  }
}

export class VerificationError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "VerificationError";
    this.code = code;
    this.status = status;
  }
}
