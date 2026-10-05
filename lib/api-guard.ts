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

type GuardResult =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

const rateLimits = new Map<string, RateLimitEntry>();

function clientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(request: Request, options: GuardOptions): Response | null {
  const now = Date.now();
  const key = `${options.scope}:${clientId(request)}`;
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
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
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Could not read request body." }, { status: 400 }),
    };
  }

  if (new TextEncoder().encode(text).byteLength > options.maxBytes) {
    return {
      ok: false,
      response: Response.json({ error: "Request body is too large." }, { status: 413 }),
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
