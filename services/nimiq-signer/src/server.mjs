import { createServer } from "node:http";
import { resolve } from "node:path";
import { PayoutLedger } from "./ledger.mjs";
import { authorize, payoutFingerprint, SignerError, validatePayout } from "./validation.mjs";

const Nimiq = await import("@nimiq/core");
const host = process.env.SIGNER_HOST || "127.0.0.1";
const port = Number(process.env.SIGNER_PORT || 8091);
const sharedToken = process.env.PAYOUT_SIGNER_TOKEN || "";
const privateKeyHex = process.env.PAYOUT_SIGNER_PRIVATE_KEY || "";
const expectedTreasury = process.env.NIMIQ_TREASURY_ADDRESS || "";
const ledgerPath = resolve(process.env.PAYOUT_SIGNER_LEDGER_PATH || ".runtime/payout-signer-ledger.json");

if (host !== "127.0.0.1" && host !== "localhost") throw new Error("The local payout signer may bind only to loopback.");
if (sharedToken.length < 32) throw new Error("PAYOUT_SIGNER_TOKEN must contain at least 32 characters.");
if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) throw new Error("PAYOUT_SIGNER_PRIVATE_KEY must be a 32-byte hex key.");

const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(privateKeyHex));
const treasuryAddress = keyPair.toAddress().toUserFriendlyAddress();
if (Nimiq.Address.fromString(expectedTreasury).compare(keyPair.toAddress()) !== 0) {
  throw new Error("The signer key does not match NIMIQ_TREASURY_ADDRESS.");
}

const ledger = await new PayoutLedger(ledgerPath).load();
let client;
let ready = false;
let startupError = null;
let dispatchQueue = Promise.resolve();

async function initialize() {
  try {
    const configuration = new Nimiq.ClientConfiguration();
    configuration.network("TestAlbatross");
    configuration.seedNodes([
      "/dns4/seed1.pos.nimiq-testnet.com/tcp/8443/wss",
      "/dns4/seed2.pos.nimiq-testnet.com/tcp/8443/wss",
      "/dns4/seed3.pos.nimiq-testnet.com/tcp/8443/wss",
      "/dns4/seed4.pos.nimiq-testnet.com/tcp/8443/wss",
    ]);
    configuration.logLevel(process.env.NIMIQ_LOG_LEVEL || "warn");
    client = await Nimiq.Client.create(configuration.build());
    await client.waitForConsensusEstablished();
    ready = true;
  } catch (error) {
    startupError = error instanceof Error ? error.message : "Unable to join TestAlbatross";
  }
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) throw new SignerError("request_too_large", "Request body is too large.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SignerError("invalid_json", "Request body must be valid JSON.", 400);
  }
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function dispatch(body) {
  const command = validatePayout(body);
  const recipient = Nimiq.Address.fromString(command.recipient);
  command.recipient = recipient.toUserFriendlyAddress();
  const fingerprint = payoutFingerprint(command);
  let record = ledger.get(command.idempotencyKey, fingerprint);
  let replayed = Boolean(record);

  if (!record) {
    const height = await client.getHeadHeight();
    const networkId = await client.getNetworkId();
    const transaction = Nimiq.TransactionBuilder.newBasicWithData(
      keyPair.toAddress(),
      recipient,
      new TextEncoder().encode(command.reference),
      BigInt(command.valueLuna),
      0n,
      height,
      networkId,
    );
    keyPair.signTransaction(transaction);
    record = await ledger.reserve({
      idempotency_key: command.idempotencyKey,
      fingerprint,
      recipient: command.recipient,
      value_luna: command.valueLuna,
      reference: command.reference,
      network: command.network,
      transaction_hex: transaction.toHex(),
      transaction_hash: null,
      created_at: new Date().toISOString(),
      submitted_at: null,
    });
  }

  if (!record.transaction_hash) {
    const details = await client.sendTransaction(record.transaction_hex);
    record = await ledger.markSubmitted(command.idempotencyKey, details.transactionHash);
  }
  return { record, replayed };
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/health" && request.method === "GET") {
      return json(response, ready ? 200 : 503, {
        status: ready ? "ok" : "starting",
        network: "TestAlbatross",
        treasury_address: treasuryAddress,
        error: startupError,
      });
    }
    if (!authorize(request.headers.authorization, sharedToken)) {
      return json(response, 401, { code: "unauthorized", message: "Signer authorization failed." });
    }
    if (!ready || !client) {
      return json(response, 503, { code: "consensus_unavailable", message: "TestAlbatross consensus is not established yet." });
    }
    if (request.url === "/payouts" && request.method === "POST") {
      const body = await readJson(request);
      const operation = dispatchQueue.then(() => dispatch(body));
      dispatchQueue = operation.catch(() => undefined);
      const { record, replayed } = await operation;
      return json(response, replayed ? 200 : 201, {
        idempotency_key: record.idempotency_key,
        transaction_hash: record.transaction_hash,
        sender: treasuryAddress,
        recipient: record.recipient,
        value_luna: record.value_luna,
        reference: record.reference,
        network: record.network,
        replayed,
      });
    }
    return json(response, 404, { code: "not_found", message: "Signer route was not found." });
  } catch (error) {
    if (error instanceof SignerError) return json(response, error.status, { code: error.code, message: error.message });
    const message = error instanceof Error ? error.message : "Payout signing failed.";
    return json(response, 422, { code: "signing_failed", message });
  }
});

server.listen(port, host, () => {
  console.log(`SideQuest payout signer listening on http://${host}:${port}`);
});

initialize();
