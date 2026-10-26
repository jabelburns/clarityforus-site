import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { siteSettings } from "@/db/schema";

const OWNER_KEY = "owner_user_id";

export function requestUserId(request: Request) {
  return request.headers.get("oai-authenticated-user-id")?.trim() || null;
}

export function isSameOriginMutation(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin && origin !== requestUrl.origin) return false;
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  return true;
}

export async function requireSiteOwner(request: Request) {
  const userId = requestUserId(request);
  if (!userId) {
    return { ok: false as const, status: 401, error: "Sign in is required." };
  }

  const db = getDb();
  const [existing] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, OWNER_KEY))
    .limit(1);

  if (!existing) {
    // Never assign a restored/new database to its first authenticated visitor.
    // Provision the owner from a server-only configuration value.
    if (!env.CLARITY_OWNER_USER_ID) {
      return { ok: false as const, status: 503, error: "Site owner has not been provisioned." };
    }
    if (env.CLARITY_OWNER_USER_ID !== userId) {
      return { ok: false as const, status: 403, error: "Owner access is required." };
    }
    await db
      .insert(siteSettings)
      .values({ key: OWNER_KEY, value: userId })
      .onConflictDoNothing();
  }

  const [owner] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, OWNER_KEY))
    .limit(1);

  if (owner?.value !== userId) {
    return { ok: false as const, status: 403, error: "Owner access is required." };
  }

  return { ok: true as const, userId };
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function authorizeIngestRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (
    supplied &&
    env.INGEST_TOKEN &&
    constantTimeEqual(supplied, env.INGEST_TOKEN)
  ) {
    return { ok: true as const, userId: null, mode: "service" as const };
  }

  const owner = await requireSiteOwner(request);
  return owner.ok ? { ...owner, mode: "owner" as const } : owner;
}
