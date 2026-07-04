import { beforeEach, describe, expect, it, vi } from "vitest";

// Ensure no Upstash env vars are set — forces the in-memory fallback
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// Re-import fresh each time so the module-level memoryMap doesn't bleed between tests
beforeEach(() => {
  vi.resetModules();
});

describe("checkRateLimit – in-memory fallback", () => {
  it("allows the first request", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit(`user-${Math.random()}`);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSecs).toBe(0);
  });

  it("allows requests up to AI_MAX_PER_WINDOW", async () => {
    const { checkRateLimit, AI_MAX_PER_WINDOW } = await import("@/lib/rate-limit");
    const userId = `user-${Math.random()}`;
    for (let i = 0; i < AI_MAX_PER_WINDOW; i++) {
      const r = await checkRateLimit(userId);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the request after the limit is reached", async () => {
    const { checkRateLimit, AI_MAX_PER_WINDOW } = await import("@/lib/rate-limit");
    const userId = `user-${Math.random()}`;
    for (let i = 0; i < AI_MAX_PER_WINDOW; i++) {
      await checkRateLimit(userId);
    }
    const result = await checkRateLimit(userId);
    expect(result.allowed).toBe(false);
  });

  it("reports a positive retryAfterSecs when blocked", async () => {
    const { checkRateLimit, AI_MAX_PER_WINDOW } = await import("@/lib/rate-limit");
    const userId = `user-${Math.random()}`;
    for (let i = 0; i < AI_MAX_PER_WINDOW; i++) {
      await checkRateLimit(userId);
    }
    const result = await checkRateLimit(userId);
    expect(result.retryAfterSecs).toBeGreaterThan(0);
  });

  it("allows requests again after the window expires", async () => {
    const { checkRateLimit, AI_MAX_PER_WINDOW, AI_WINDOW_MS } = await import("@/lib/rate-limit");
    const userId = `user-${Math.random()}`;

    // Fill up the window using a fake past timestamp
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now - AI_WINDOW_MS - 1000);
    for (let i = 0; i < AI_MAX_PER_WINDOW; i++) {
      await checkRateLimit(userId);
    }
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await checkRateLimit(userId);
    expect(result.allowed).toBe(true);

    vi.restoreAllMocks();
  });

  it("isolates different users from each other", async () => {
    const { checkRateLimit, AI_MAX_PER_WINDOW } = await import("@/lib/rate-limit");
    const userA = `user-A-${Math.random()}`;
    const userB = `user-B-${Math.random()}`;
    for (let i = 0; i < AI_MAX_PER_WINDOW; i++) {
      await checkRateLimit(userA);
    }
    const result = await checkRateLimit(userB);
    expect(result.allowed).toBe(true);
  });
});

describe("AI_WINDOW_MS / AI_MAX_PER_WINDOW constants", () => {
  it("AI_WINDOW_MS is a positive number", async () => {
    const { AI_WINDOW_MS } = await import("@/lib/rate-limit");
    expect(AI_WINDOW_MS).toBeGreaterThan(0);
  });

  it("AI_MAX_PER_WINDOW is a positive number", async () => {
    const { AI_MAX_PER_WINDOW } = await import("@/lib/rate-limit");
    expect(AI_MAX_PER_WINDOW).toBeGreaterThan(0);
  });
});
