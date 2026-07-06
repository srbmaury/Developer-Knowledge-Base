import { describe, expect, it, vi } from "vitest";

// workspace-io.ts has top-level imports of server actions and toast — mock them
// so the pure helpers (parseMarkdownFile, slugify) can be imported in isolation.
vi.mock("@/app/actions", () => ({
  bulkImportAction: vi.fn(),
  getExportContentAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

import { parseMarkdownFile, slugify } from "@/lib/workspace-io";

// ── slugify ───────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("collapses multiple spaces into one hyphen", () => {
    expect(slugify("a  b   c")).toBe("a-b-c");
  });

  it("strips filesystem-unsafe characters", () => {
    expect(slugify('file/name:with"bad*chars')).toBe("file-name-with-bad-chars");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("a--b---c")).toBe("a-b-c");
  });

  it("converts surrounding spaces to hyphens (trim removes whitespace, not hyphens)", () => {
    // spaces → hyphens, then collapsed; the result still has edge hyphens
    expect(slugify("  hello  ")).toBe("-hello-");
  });

  it("leaves alphanumeric and plain hyphens unchanged", () => {
    expect(slugify("binary-search")).toBe("binary-search");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

// ── parseMarkdownFile ─────────────────────────────────────────────────────────

describe("parseMarkdownFile", () => {
  // ── title ──────────────────────────────────────────────────────────────────

  describe("title", () => {
    it("extracts title from a leading # heading", () => {
      const { title } = parseMarkdownFile("fallback.md", "# My Question\n");
      expect(title).toBe("My Question");
    });

    it("falls back to filename (minus .md) when no # heading", () => {
      const { title } = parseMarkdownFile("binary-search.md", "some content");
      expect(title).toBe("binary-search");
    });

    it("ignores leading blank lines before the heading", () => {
      const { title } = parseMarkdownFile("f.md", "\n\n# Real Title\n");
      expect(title).toBe("Real Title");
    });

    it("stops looking for a title once a non-heading non-blank line appears", () => {
      // First non-blank line is not a heading → use filename
      const { title } = parseMarkdownFile("fallback.md", "plain text\n# Not A Title\n");
      expect(title).toBe("fallback");
    });
  });

  // ── description ────────────────────────────────────────────────────────────

  describe("description", () => {
    it("returns empty string when there is no --- separator", () => {
      const { description } = parseMarkdownFile("f.md", "# Title\nsome content");
      expect(description).toBe("");
    });

    it("extracts lines between the heading and --- as description", () => {
      const text = "# Title\ndescription line\n---\ncontent";
      const { description } = parseMarkdownFile("f.md", text);
      expect(description).toBe("description line");
    });

    it("trims leading and trailing blank lines from description", () => {
      const text = "# Title\n\ndescription text\n\n---\ncontent";
      const { description } = parseMarkdownFile("f.md", text);
      expect(description).toBe("description text");
    });

    it("preserves internal newlines in a multi-line description", () => {
      const text = "# Title\nline one\nline two\n---\ncontent";
      const { description } = parseMarkdownFile("f.md", text);
      expect(description).toBe("line one\nline two");
    });
  });

  // ── difficulty ─────────────────────────────────────────────────────────────

  describe("difficulty", () => {
    it("parses EASY difficulty", () => {
      const { difficulty } = parseMarkdownFile("f.md", "# T\n**Difficulty:** EASY\n---\n");
      expect(difficulty).toBe("EASY");
    });

    it("parses MEDIUM difficulty case-insensitively", () => {
      const { difficulty } = parseMarkdownFile("f.md", "# T\n**Difficulty:** medium\n---\n");
      expect(difficulty).toBe("MEDIUM");
    });

    it("parses HARD difficulty", () => {
      const { difficulty } = parseMarkdownFile("f.md", "# T\n**Difficulty:** HARD\n---\n");
      expect(difficulty).toBe("HARD");
    });

    it("returns null for an unrecognised difficulty value", () => {
      const { difficulty } = parseMarkdownFile("f.md", "# T\n**Difficulty:** EXTREME\n---\n");
      expect(difficulty).toBeNull();
    });

    it("returns null when no Difficulty line is present", () => {
      const { difficulty } = parseMarkdownFile("f.md", "# T\n---\ncontent");
      expect(difficulty).toBeNull();
    });
  });

  // ── tags ───────────────────────────────────────────────────────────────────

  describe("tags", () => {
    it("parses a single tag", () => {
      const { tagNames } = parseMarkdownFile("f.md", "# T\n**Tags:** javascript\n---\n");
      expect(tagNames).toEqual(["javascript"]);
    });

    it("parses multiple comma-separated tags", () => {
      const { tagNames } = parseMarkdownFile("f.md", "# T\n**Tags:** javascript, arrays, sorting\n---\n");
      expect(tagNames).toEqual(["javascript", "arrays", "sorting"]);
    });

    it("trims whitespace from each tag name", () => {
      const { tagNames } = parseMarkdownFile("f.md", "# T\n**Tags:**  a , b , c \n---\n");
      expect(tagNames).toEqual(["a", "b", "c"]);
    });

    it("returns empty array when no Tags line is present", () => {
      const { tagNames } = parseMarkdownFile("f.md", "# T\n---\ncontent");
      expect(tagNames).toEqual([]);
    });
  });

  // ── content ────────────────────────────────────────────────────────────────

  describe("content", () => {
    it("extracts everything after --- as content", () => {
      const { content } = parseMarkdownFile("f.md", "# T\n---\nfunction foo() {}");
      expect(content).toBe("function foo() {}");
    });

    it("trims leading whitespace from content", () => {
      const { content } = parseMarkdownFile("f.md", "# T\n---\n\nfunction foo() {}");
      expect(content).toBe("function foo() {}");
    });

    it("returns full body as content when there is no --- separator and no heading", () => {
      const { content } = parseMarkdownFile("f.md", "line one\nline two");
      expect(content).toBe("line one\nline two");
    });

    it("preserves multiline content", () => {
      const text = "# T\n---\nline1\nline2\nline3";
      const { content } = parseMarkdownFile("f.md", text);
      expect(content).toBe("line1\nline2\nline3");
    });
  });

  // ── export round-trip ─────────────────────────────────────────────────────
  // These tests simulate the exact format that exportWorkspaceToZip generates
  // and verify it round-trips through parseMarkdownFile without data loss.

  describe("export format round-trip", () => {
    function buildExportFile(q: {
      title: string;
      description?: string;
      difficulty?: string | null;
      tags?: string[];
      content?: string;
    }): string {
      const lines: string[] = [];
      lines.push(`# ${q.title}`);

      const hasMeta = !!(q.description || q.difficulty || (q.tags?.length ?? 0) > 0);
      const content = q.content ?? "";

      if (hasMeta) {
        if (q.description) { lines.push(""); lines.push(q.description); }
        if (q.difficulty) lines.push(`**Difficulty:** ${q.difficulty}`);
        if (q.tags?.length) lines.push(`**Tags:** ${q.tags.join(", ")}`);
        lines.push("---");
        if (content) { lines.push(""); lines.push(content); }
      } else if (content) {
        lines.push(""); lines.push(content);
      }

      return lines.join("\n");
    }

    it("round-trips title, description, difficulty, tags, and content", () => {
      const file = buildExportFile({
        title: "Binary Search",
        description: "Classic divide-and-conquer algorithm",
        difficulty: "MEDIUM",
        tags: ["algorithms", "arrays"],
        content: "function binarySearch() { return 0; }",
      });

      const parsed = parseMarkdownFile("binary-search.md", file);
      expect(parsed.title).toBe("Binary Search");
      expect(parsed.description).toBe("Classic divide-and-conquer algorithm");
      expect(parsed.difficulty).toBe("MEDIUM");
      expect(parsed.tagNames).toEqual(["algorithms", "arrays"]);
      expect(parsed.content).toBe("function binarySearch() { return 0; }");
    });

    it("round-trips title + description only (no difficulty, tags, or content)", () => {
      const file = buildExportFile({ title: "Title", description: "A description" });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.title).toBe("Title");
      expect(parsed.description).toBe("A description");
      expect(parsed.difficulty).toBeNull();
      expect(parsed.tagNames).toEqual([]);
      expect(parsed.content).toBe("");
    });

    it("round-trips title + tags + content (no description or difficulty)", () => {
      const file = buildExportFile({ title: "T", tags: ["dp"], content: "code here" });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.description).toBe("");
      expect(parsed.tagNames).toEqual(["dp"]);
      expect(parsed.content).toBe("code here");
    });

    it("round-trips title + content only (no meta)", () => {
      const file = buildExportFile({ title: "T", content: "just code" });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.description).toBe("");
      expect(parsed.difficulty).toBeNull();
      expect(parsed.tagNames).toEqual([]);
      expect(parsed.content).toBe("just code");
    });

    it("round-trips a question with no fields at all", () => {
      const file = buildExportFile({ title: "Bare Title" });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.title).toBe("Bare Title");
      expect(parsed.description).toBe("");
      expect(parsed.difficulty).toBeNull();
      expect(parsed.tagNames).toEqual([]);
      expect(parsed.content).toBe("");
    });

    it("does not leak difficulty or tags into content", () => {
      const file = buildExportFile({
        title: "T",
        difficulty: "HARD",
        tags: ["graph"],
        content: "function solve() {}",
      });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.content).toBe("function solve() {}");
      expect(parsed.content).not.toContain("Difficulty");
      expect(parsed.content).not.toContain("Tags");
      expect(parsed.content).not.toContain("---");
    });

    it("does not include difficulty or tags in the description", () => {
      const file = buildExportFile({
        title: "T",
        description: "desc",
        difficulty: "EASY",
        tags: ["tree"],
      });
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.description).toBe("desc");
      expect(parsed.description).not.toContain("Difficulty");
      expect(parsed.description).not.toContain("Tags");
    });

    it("handles a multiline description in the round-trip", () => {
      const q = {
        title: "T",
        description: "line one\nline two\nline three",
        difficulty: "MEDIUM" as const,
        tags: ["a"],
        content: "code",
      };
      const file = buildExportFile(q);
      const parsed = parseMarkdownFile("f.md", file);
      expect(parsed.description).toBe("line one\nline two\nline three");
    });
  });
});
