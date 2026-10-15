import { createServer } from "node:http";
import { decodeRawData, validateExpectedTransaction, VerificationError } from "./validation.mjs";

// The Nimiq WASM worker listens for lifecycle events through the Web EventTarget
// interface. Node exposes EventTarget but not the browser-style global helpers.
if (typeof globalThis.addEventListener !== "function") {
  const lifecycleEvents = new EventTarget();
  globalThis.addEventListener = lifecycleEvents.addEventListener.bind(lifecycleEvents);
  globalThis.removeEventListener = lifecycleEvents.removeEventListener.bind(lifecycleEvents);
  globalThis.dispatchEvent = lifecycleEvents.dispatchEvent.bind(lifecycleEvents);
}

const Nimiq = await import("@nimiq/core");

const host = process.env.VERIFIER_HOST || "127.0.0.1";
const port = Number(process.env.VERIFIER_PORT || 8090);
const sharedToken = process.env.VERIFIER_SHARED_TOKEN || "";

if (host !== "127.0.0.1" && host !== "localhost" && !sharedToken) {
  throw new Error("VERIFIER_SHARED_TOKEN is required when the verifier is exposed beyond loopback");
}

let client;
let ready = false;
let startupError = null;

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

function authorize(request) {
  if (!sharedToken) return true;
  return request.headers.authorization === `Bearer ${sharedToken}`;
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) throw new VerificationError("request_too_large", "Request body is too large.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new VerificationError("invalid_json", "Request body must be valid JSON.", 400);
  }
}

function receipt(details) {
  return {
    transaction_hash: details.transactionHash,
    state: details.state,
    sender: details.sender,
    recipient: details.recipient,
    value_luna: details.value,
    reference: decodeRawData(details.data),
    network: details.network,
    confirmations: details.confirmations || 0,
    block_height: details.blockHeight || null,
  };
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/health" && request.method === "GET") {
      return json(response, ready ? 200 : 503, {
        status: ready ? "ok" : "starting",
        network: "TestAlbatross",
        error: startupError,
      });
    }
    if (!authorize(request)) {
      return json(response, 401, { code: "unauthorized", message: "Verifier authorization failed." });
    }
    if (!ready || !client) {
      return json(response, 503, { code: "consensus_unavailable", message: "TestAlbatross consensus is not established yet." });
    }

    if (request.url === "/transactions" && request.method === "POST") {
      const body = await readJson(request);
      if (typeof body.transaction_hash !== "string" || body.transaction_hash.length > 128 || !/^[0-9a-fA-F]+$/.test(body.transaction_hash)) {
        throw new VerificationError("invalid_transaction", "A valid transaction hash is required.");
      }
      if (!Number.isSafeInteger(body.value_luna) || body.value_luna <= 0) {
        throw new VerificationError("invalid_expected_amount", "Expected luna amount is invalid.", 400);
      }
      if (typeof body.recipient !== "string" || typeof body.reference !== "string") {
        throw new VerificationError("invalid_expectation", "Recipient and reference are required.", 400);
      }

      const details = await client.getTransaction(body.transaction_hash);
      validateExpectedTransaction(details, {
        recipient: body.recipient,
        value_luna: body.value_luna,
        reference: body.reference,
      });
      return json(response, 200, receipt(details));
    }

    const match = request.url?.match(/^\/transactions\/([0-9a-fA-F]+)$/);
    if (match && request.method === "GET") {
      const details = await client.getTransaction(match[1]);
      return json(response, 200, receipt(details));
    }

    return json(response, 404, { code: "not_found", message: "Verifier route was not found." });
  } catch (error) {
    if (error instanceof VerificationError) {
      return json(response, error.status, { code: error.code, message: error.message });
    }
    const message = error instanceof Error ? error.message : "Transaction verification failed.";
    return json(response, 422, { code: "verification_failed", message });
  }
});

server.listen(port, host, () => {
  console.log(`SideQuest Nimiq verifier listening on http://${host}:${port}`);
});

initialize();
