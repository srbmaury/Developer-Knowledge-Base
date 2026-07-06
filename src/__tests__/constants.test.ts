import { describe, expect, it } from "vitest";
import { difficultyLabel, difficultyBadgeClass } from "@/lib/constants";

describe("difficultyLabel", () => {
  it("returns 'Easy' for EASY", () => {
    expect(difficultyLabel("EASY")).toBe("Easy");
  });

  it("returns 'Medium' for MEDIUM", () => {
    expect(difficultyLabel("MEDIUM")).toBe("Medium");
  });

  it("returns 'Hard' for HARD", () => {
    expect(difficultyLabel("HARD")).toBe("Hard");
  });
});

describe("difficultyBadgeClass", () => {
  it("returns emerald class for EASY", () => {
    const cls = difficultyBadgeClass("EASY");
    expect(cls).toContain("emerald");
    expect(cls).not.toContain("rose");
    expect(cls).not.toContain("amber");
  });

  it("returns rose class for HARD", () => {
    const cls = difficultyBadgeClass("HARD");
    expect(cls).toContain("rose");
    expect(cls).not.toContain("emerald");
  });

  it("returns amber class for MEDIUM (default)", () => {
    const cls = difficultyBadgeClass("MEDIUM");
    expect(cls).toContain("amber");
    expect(cls).not.toContain("emerald");
    expect(cls).not.toContain("rose");
  });
});
