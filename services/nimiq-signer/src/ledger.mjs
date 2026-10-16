import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SignerError } from "./validation.mjs";

export class PayoutLedger {
  constructor(path) {
    this.path = path;
    this.records = new Map();
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8"));
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.payouts)) throw new Error("invalid ledger");
      this.records = new Map(parsed.payouts.map((record) => [record.idempotency_key, record]));
    } catch (error) {
      if (error?.code !== "ENOENT") throw new Error("The payout ledger is unreadable or invalid.", { cause: error });
    }
    return this;
  }

  get(idempotencyKey, fingerprint) {
    const existing = this.records.get(idempotencyKey);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new SignerError("idempotency_conflict", "This idempotency key was already used for a different payout.", 409);
    }
    return existing ?? null;
  }

  async reserve(record) {
    const existing = this.get(record.idempotency_key, record.fingerprint);
    if (existing) return existing;
    this.records.set(record.idempotency_key, record);
    await this.persist();
    return record;
  }

  async markSubmitted(idempotencyKey, transactionHash) {
    const existing = this.records.get(idempotencyKey);
    if (!existing) throw new Error("Cannot submit an unreserved payout.");
    const updated = { ...existing, transaction_hash: transactionHash, submitted_at: new Date().toISOString() };
    this.records.set(idempotencyKey, updated);
    await this.persist();
    return updated;
  }

  async persist() {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.tmp`;
    const payload = JSON.stringify({ version: 1, payouts: [...this.records.values()] }, null, 2);
    await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.path);
  }
}
