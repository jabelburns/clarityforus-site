// Pure helper: authorize incoming automated refresh requests. No database writes.
// This is a staging-only patch; it must not be deployed until the existing
// scheduler has been updated to provide an independently protected bearer token.
const encoder = new TextEncoder();

export async function authorizeScheduledBearer(authorization, expectedToken) {
  if (typeof expectedToken !== "string" || expectedToken.length < 32) {
    return { ok: false, status: 503, error: "Scheduled ingestion credentials are not configured." };
  }
  if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) {
    return { ok: false, status: 401, error: "Service authentication is required." };
  }
  const supplied = authorization.slice(7);
  if (supplied.length > 8192) {
    return { ok: false, status: 403, error: "Service authorization failed." };
  }
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
  ]);
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  const ok = difference === 0 && supplied.length === expectedToken.length;
  return ok
    ? { ok: true, status: 200 }
    : { ok: false, status: 403, error: "Service authorization failed." };
}
