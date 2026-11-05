/** Android App Links. Configure ANDROID_PACKAGE and ANDROID_CERT_SHA256 (comma separated). */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const fingerprints = process.env.ANDROID_CERT_SHA256?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  const body = pkg && fingerprints.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }] : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
