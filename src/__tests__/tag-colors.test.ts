import { describe, expect, it } from "vitest";
import { TAG_COLORS, TAG_COLOR_CLASSES, TAG_DOT_CLASSES } from "@/lib/tag-colors";
import type { TagColor } from "@/types/knowledge";

describe("TAG_COLORS", () => {
  it("contains all eight tag colors", () => {
    expect(TAG_COLORS).toHaveLength(8);
    expect(TAG_COLORS).toContain("blue");
    expect(TAG_COLORS).toContain("gray");
    expect(TAG_COLORS).toContain("pink");
  });
});

describe("TAG_COLOR_CLASSES", () => {
  it("has an entry for every tag color", () => {
    for (const color of TAG_COLORS) {
      expect(TAG_COLOR_CLASSES[color]).toBeTruthy();
    }
  });

  it("each class string contains a background and text class", () => {
    for (const color of TAG_COLORS as TagColor[]) {
      expect(TAG_COLOR_CLASSES[color]).toMatch(/bg-/);
      expect(TAG_COLOR_CLASSES[color]).toMatch(/text-/);
    }
  });
});

describe("TAG_DOT_CLASSES", () => {
  it("has an entry for every tag color", () => {
    for (const color of TAG_COLORS) {
      expect(TAG_DOT_CLASSES[color]).toBeTruthy();
    }
  });

  it("each dot class is a background color", () => {
    for (const color of TAG_COLORS as TagColor[]) {
      expect(TAG_DOT_CLASSES[color]).toMatch(/^bg-/);
    }
  });
});
