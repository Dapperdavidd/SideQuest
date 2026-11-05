import { createPrivateKey, createSign } from "node:crypto";
import { connection } from "next/server";

/**
 * Issues a short-lived MapKit JS token for Apple Maps.
 *
 * Needs an Apple Developer "Maps ID" key: MAPKIT_TEAM_ID, MAPKIT_KEY_ID and MAPKIT_PRIVATE_KEY
 * (the .p8 contents; literal "\n" sequences are accepted). MAPKIT_ALLOWED_ORIGIN pins the token
 * to the site origin in production. Without the key the endpoint answers 503 and the map falls
 * back to the illustrated map.
 */
const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export async function GET() {
  // Signed per request: never prerendered or cached.
  await connection();
  const teamId = process.env.MAPKIT_TEAM_ID;
  const keyId = process.env.MAPKIT_KEY_ID;
  const privateKey = process.env.MAPKIT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!teamId || !keyId || !privateKey) {
    return Response.json({ error: "Apple Maps is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload: Record<string, string | number> = { iss: teamId, iat: now, exp: now + 30 * 60 };
  if (process.env.MAPKIT_ALLOWED_ORIGIN) payload.origin = process.env.MAPKIT_ALLOWED_ORIGIN;
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  try {
    const signature = createSign("SHA256").update(unsigned).sign({ key: createPrivateKey(privateKey), dsaEncoding: "ieee-p1363" });
    return new Response(`${unsigned}.${base64url(signature)}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Apple Maps key could not be read." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
