import { describe, expect, it } from "vitest";
import {
  assignOrdersByPinGroups,
  compareQuestionsByPinAndOrder,
  normalizeQuestionIdsForReorder
} from "@/lib/question-order";

describe("compareQuestionsByPinAndOrder", () => {
  it("puts pinned question before unpinned", () => {
    const pinned = { isPinned: true, order: 10 };
    const unpinned = { isPinned: false, order: 0 };
    expect(compareQuestionsByPinAndOrder(pinned, unpinned)).toBeLessThan(0);
    expect(compareQuestionsByPinAndOrder(unpinned, pinned)).toBeGreaterThan(0);
  });

  it("within the same pin group, sorts by order ascending", () => {
    const a = { isPinned: false, order: 1 };
    const b = { isPinned: false, order: 5 };
    expect(compareQuestionsByPinAndOrder(a, b)).toBeLessThan(0);
    expect(compareQuestionsByPinAndOrder(b, a)).toBeGreaterThan(0);
  });

  it("returns 0 for equal pin status and order", () => {
    const a = { isPinned: true, order: 3 };
    const b = { isPinned: true, order: 3 };
    expect(compareQuestionsByPinAndOrder(a, b)).toBe(0);
  });

  it("stable-sorts a mixed array correctly when used with Array.sort", () => {
    const questions = [
      { id: "a", isPinned: false, order: 2 },
      { id: "b", isPinned: true, order: 1 },
      { id: "c", isPinned: false, order: 0 },
      { id: "d", isPinned: true, order: 0 }
    ];
    const sorted = [...questions].sort(compareQuestionsByPinAndOrder);
    expect(sorted.map((q) => q.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("normalizeQuestionIdsForReorder", () => {
  const byId = new Map([
    ["p1", { id: "p1", isPinned: true }],
    ["p2", { id: "p2", isPinned: true }],
    ["u1", { id: "u1", isPinned: false }],
    ["u2", { id: "u2", isPinned: false }]
  ]);

  it("places pinned ids before unpinned ids regardless of input order", () => {
    const result = normalizeQuestionIdsForReorder(["u1", "p1", "u2", "p2"], byId);
    expect(result).toEqual(["p1", "p2", "u1", "u2"]);
  });

  it("silently drops ids that are not in the byId map", () => {
    const result = normalizeQuestionIdsForReorder(["u1", "unknown", "p1"], byId);
    expect(result).toEqual(["p1", "u1"]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeQuestionIdsForReorder([], byId)).toEqual([]);
  });
});

describe("assignOrdersByPinGroups", () => {
  const byId = new Map([
    ["p1", { id: "p1", isPinned: true }],
    ["p2", { id: "p2", isPinned: true }],
    ["u1", { id: "u1", isPinned: false }],
    ["u2", { id: "u2", isPinned: false }]
  ]);

  it("assigns 0-based orders to pinned items independently from unpinned", () => {
    const result = assignOrdersByPinGroups(["p1", "p2", "u1", "u2"], byId);
    const find = (id: string) => result.find((r) => r.id === id)!;
    expect(find("p1").order).toBe(0);
    expect(find("p2").order).toBe(1);
    expect(find("u1").order).toBe(0);
    expect(find("u2").order).toBe(1);
  });

  it("normalizes mixed input order (pinned first) before assigning", () => {
    const result = assignOrdersByPinGroups(["u1", "p1", "u2", "p2"], byId);
    const find = (id: string) => result.find((r) => r.id === id)!;
    // After normalisation: p1, p2, u1, u2
    expect(find("p1").order).toBe(0);
    expect(find("p2").order).toBe(1);
    expect(find("u1").order).toBe(0);
    expect(find("u2").order).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(assignOrdersByPinGroups([], byId)).toEqual([]);
  });
});
