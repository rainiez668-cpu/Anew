interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface GuardOptions {
  scope: string;
  maxBytes: number;
  limit: number;
  windowMs: number;
}

const MAX_RATE_LIMIT_ENTRIES = 10_000;
const PRUNE_INTERVAL_MS = 60_000;

type GuardResult =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

const rateLimits = new Map<string, RateLimitEntry>();
let lastPrunedAt = 0;

function isIpAddress(value: string | null): value is string {
  return !!value && /^[0-9a-f:.]+$/i.test(value);
}

/**
 * Only accept a forwarding header where the hosting boundary is known to
 * overwrite it. All other deployments share a conservative bucket instead of
 * trusting a value that a client can forge.
 */
export function clientId(request: Request): string {
  const vercelForwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (process.env.VERCEL === "1" && isIpAddress(vercelForwardedFor)) {
    return `ip:${vercelForwardedFor}`;
  }

  const explicitlyTrusted = process.env.TRUSTED_PROXY_MODE === "overwrite-x-forwarded-for";
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim() ?? null;
  if (explicitlyTrusted && isIpAddress(forwardedFor)) {
    return `ip:${forwardedFor}`;
  }

  return "unknown";
}

function pruneExpiredRateLimits(now: number): void {
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS && rateLimits.size < MAX_RATE_LIMIT_ENTRIES) return;
  lastPrunedAt = now;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
}

function rateLimitCapacityResponse(): Response {
  return Response.json(
    { error: "Request protection is temporarily at capacity. Please try again shortly." },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}

function checkRateLimit(request: Request, options: GuardOptions): Response | null {
  const now = Date.now();
  pruneExpiredRateLimits(now);
  const key = `${options.scope}:${clientId(request)}`;
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    if (!current && rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      return rateLimitCapacityResponse();
    }
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    return Response.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
          ),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  current.count += 1;
  return null;
}

/**
 * This project has no shared rate-limit store. Never expose a paid provider in
 * production until one is implemented and enforced at every instance.
 */
export function realAiProductionGuard(
  provider: "mock" | "openai" | "anthropic",
  nodeEnv = process.env.NODE_ENV,
): Response | null {
  if (provider === "mock" || nodeEnv !== "production") return null;
  return Response.json(
    {
      error:
        "Real AI is not enabled for this deployment. Configure shared rate limiting before exposing a real provider.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function __resetApiGuardForTests(): void {
  rateLimits.clear();
  lastPrunedAt = 0;
}

export function __rateLimitSizeForTests(): number {
  return rateLimits.size;
}

export async function guardJsonRequest(
  request: Request,
  options: GuardOptions,
): Promise<GuardResult> {
  const limited = checkRateLimit(request, options);
  if (limited) return { ok: false, response: limited };

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      response: Response.json(
        { error: "Content-Type must be application/json." },
        { status: 415 },
      ),
    };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
    return {
      ok: false,
      response: Response.json({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  let text: string;
  try {
    text = await readTextWithinLimit(request, options.maxBytes);
  } catch (error) {
    return {
      ok: false,
      response: Response.json(
        { error: error instanceof RangeError ? "Request body is too large." : "Could not read request body." },
        { status: error instanceof RangeError ? 413 : 400 },
      ),
    };
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    };
  }
}

async function readTextWithinLimit(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError("body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
