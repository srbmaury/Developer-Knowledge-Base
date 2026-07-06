import { describe, expect, it } from "vitest";
import { computeNextSR, isDue, daysUntilDue } from "@/lib/spaced-repetition";

const DEFAULT = { interval: 1, ease: 2.5, reviews: 0 };

describe("computeNextSR", () => {
  describe("'again' grade (q < 3) resets interval to 1", () => {
    it("resets interval to 1 regardless of current interval", () => {
      const result = computeNextSR({ interval: 20, ease: 2.5, reviews: 5 }, "again");
      expect(result.interval).toBe(1);
    });

    it("increments reviews", () => {
      const result = computeNextSR({ ...DEFAULT, reviews: 2 }, "again");
      expect(result.reviews).toBe(3);
    });

    it("does not change ease on 'again'", () => {
      const result = computeNextSR({ ...DEFAULT, ease: 2.5 }, "again");
      // ease is only updated for q >= 3
      expect(result.ease).toBe(2.5);
    });
  });

  describe("first review (reviews === 0 → becomes 1)", () => {
    it("good grade sets interval to 1 on first review", () => {
      const result = computeNextSR({ ...DEFAULT, reviews: 0 }, "good");
      expect(result.interval).toBe(1);
      expect(result.reviews).toBe(1);
    });

    it("easy grade sets interval to 1 on first review", () => {
      const result = computeNextSR({ ...DEFAULT, reviews: 0 }, "easy");
      expect(result.interval).toBe(1);
    });
  });

  describe("second review (reviews === 1 → becomes 2)", () => {
    it("good grade sets interval to 6", () => {
      const result = computeNextSR({ interval: 1, ease: 2.5, reviews: 1 }, "good");
      expect(result.interval).toBe(6);
      expect(result.reviews).toBe(2);
    });

    it("easy grade sets interval to 6", () => {
      const result = computeNextSR({ interval: 1, ease: 2.5, reviews: 1 }, "easy");
      expect(result.interval).toBe(6);
    });
  });

  describe("subsequent reviews (reviews >= 2)", () => {
    it("good grade multiplies interval by ease", () => {
      const result = computeNextSR({ interval: 6, ease: 2.5, reviews: 2 }, "good");
      expect(result.interval).toBe(Math.round(6 * 2.5)); // 15
    });

    it("easy grade increases ease and multiplies interval by the old ease", () => {
      const before = { interval: 6, ease: 2.5, reviews: 2 };
      const result = computeNextSR(before, "easy");
      expect(result.ease).toBeGreaterThan(before.ease);
      // interval is calculated using the ease value BEFORE it is updated
      expect(result.interval).toBe(Math.round(6 * before.ease));
    });

    it("hard grade decreases ease", () => {
      const before = { interval: 6, ease: 2.5, reviews: 2 };
      const result = computeNextSR(before, "hard");
      expect(result.ease).toBeLessThan(before.ease);
    });

    it("ease never falls below 1.3", () => {
      // Multiple 'hard' grades push ease toward its floor
      let state = { interval: 1, ease: 1.31, reviews: 5 };
      state = computeNextSR(state, "hard");
      expect(state.ease).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe("due date", () => {
    it("due date is interval calendar days from today, at 4am", () => {
      const result = computeNextSR({ interval: 6, ease: 2.5, reviews: 2 }, "good");
      const expected = new Date();
      expected.setDate(expected.getDate() + result.interval);
      expected.setHours(4, 0, 0, 0);
      expect(new Date(result.due).getTime()).toBe(expected.getTime());
    });

    it("due date is set to 4am", () => {
      const result = computeNextSR(DEFAULT, "good");
      const due = new Date(result.due);
      expect(due.getHours()).toBe(4);
      expect(due.getMinutes()).toBe(0);
      expect(due.getSeconds()).toBe(0);
    });
  });

  describe("ease rounding", () => {
    it("ease is rounded to 2 decimal places", () => {
      const result = computeNextSR({ interval: 6, ease: 2.5, reviews: 2 }, "good");
      const decimals = result.ease.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });
});

describe("isDue", () => {
  it("returns false for null (not enrolled in review)", () => {
    expect(isDue(null)).toBe(false);
  });

  it("returns true when due date is in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isDue(past)).toBe(true);
  });

  it("returns true when due date is exactly now", () => {
    const now = new Date().toISOString();
    expect(isDue(now)).toBe(true);
  });

  it("returns false when due date is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isDue(future)).toBe(false);
  });
});

describe("daysUntilDue", () => {
  it("returns 0 for null", () => {
    expect(daysUntilDue(null)).toBe(0);
  });

  it("returns a positive number for a future date", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilDue(future)).toBeGreaterThan(0);
  });

  it("returns a non-positive number for a past date", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilDue(past)).toBeLessThanOrEqual(0);
  });

  it("returns ceil of fractional days", () => {
    // 1.5 days from now → ceil = 2
    const future = new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilDue(future)).toBe(2);
  });
});
