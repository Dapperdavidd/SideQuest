/**
 * iOS Universal Links for sdqst.app/q/* and /g/*. Configure APPLE_TEAM_ID and IOS_BUNDLE_ID
 * once the App Store app exists; until then the file lists no apps and links open the web.
 */
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.IOS_BUNDLE_ID;
  const details = team && bundle ? [{ appIDs: [`${team}.${bundle}`], components: [{ "/": "/q/*" }, { "/": "/g/*" }] }] : [];
  return Response.json({ applinks: { details } }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
