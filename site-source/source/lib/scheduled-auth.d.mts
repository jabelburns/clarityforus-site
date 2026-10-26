export declare function authorizeScheduledBearer(
  authorization: string | null,
  expectedToken: string | undefined,
): Promise<{ ok: true; status: 200 } | { ok: false; status: 401 | 403 | 503; error: string }>;
