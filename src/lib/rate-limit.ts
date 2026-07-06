/**
 * Rate limiter: uses Upstash Redis when env vars are present, falls back to
 * an in-process sliding-window map for local dev / single-instance deploys.
 */

type RateLimitResult = { allowed: boolean; retryAfterSecs: number };

// ── In-memory fallback ────────────────────────────────────────────────────────

const memoryMap = new Map<string, number[]>();

function memoryCheck(key: string, maxHits: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (memoryMap.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    memoryMap.set(key, hits);
    const retryAfterSecs = Math.ceil((hits[0] + windowMs - now) / 1000);
    return { allowed: false, retryAfterSecs };
  }
  hits.push(now);
  memoryMap.set(key, hits);
  return { allowed: true, retryAfterSecs: 0 };
}

// ── Upstash Redis limiter (lazy-initialised) ──────────────────────────────────

let upstashLimiter: ((key: string) => Promise<RateLimitResult>) | null = null;

async function getUpstashLimiter() {
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { Redis } = await import("@upstash/redis");
  const { Ratelimit } = await import("@upstash/ratelimit");

  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AI_MAX_PER_WINDOW, `${AI_WINDOW_MS}ms`),
    analytics: false
  });

  upstashLimiter = async (key: string) => {
    const { success, reset } = await limiter.limit(key);
    if (success) return { allowed: true, retryAfterSecs: 0 };
    const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000);
    return { allowed: false, retryAfterSecs: Math.max(1, retryAfterSecs) };
  };

  return upstashLimiter;
}

// ── Public constants ──────────────────────────────────────────────────────────

export const AI_WINDOW_MS = 60_000;
export const AI_MAX_PER_WINDOW = 10;

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const upstash = await getUpstashLimiter().catch(() => null);
  if (upstash) return upstash(`ai:${userId}`);
  return memoryCheck(`ai:${userId}`, AI_MAX_PER_WINDOW, AI_WINDOW_MS);
}
