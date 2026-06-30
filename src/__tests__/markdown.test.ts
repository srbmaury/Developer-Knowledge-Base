import { describe, expect, it } from "vitest";
import { isLikelyHtml, normalizeGeneratedMarkdown } from "@/lib/markdown";

describe("isLikelyHtml", () => {
  it("returns false for empty string", () => {
    expect(isLikelyHtml("")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isLikelyHtml("hello world")).toBe(false);
  });

  it("returns false for markdown heading", () => {
    expect(isLikelyHtml("# My Heading")).toBe(false);
  });

  it("returns false for markdown that starts with a < comparison", () => {
    expect(isLikelyHtml("<= value check")).toBe(false);
  });

  it("returns true for basic inline HTML", () => {
    expect(isLikelyHtml("<b>bold</b>")).toBe(true);
  });

  it("returns true for full HTML document fragment", () => {
    expect(isLikelyHtml("<ul><li>item one</li><li>item two</li></ul>")).toBe(true);
  });

  it("returns true for multi-element HTML with whitespace padding", () => {
    expect(isLikelyHtml("  <p>Hello <strong>world</strong></p>  ")).toBe(true);
  });

  it("returns true for namespaced / kebab element names", () => {
    expect(isLikelyHtml("<custom-tag>content</custom-tag>")).toBe(true);
  });

  it("returns false when content starts with < but has no closing tag", () => {
    expect(isLikelyHtml("<div>no closing")).toBe(false);
  });

  it("returns false for self-closing only (no closing tag)", () => {
    expect(isLikelyHtml("<br />")).toBe(false);
  });

  it("returns false when content contains HTML-encoded &lt; entity", () => {
    expect(isLikelyHtml("<p>shows &lt;escaped&gt;</p>")).toBe(false);
  });

  it("returns false when content is only HTML-encoded entities", () => {
    expect(isLikelyHtml("&lt;div&gt;content&lt;/div&gt;")).toBe(false);
  });
});

describe("normalizeGeneratedMarkdown", () => {
  it("strips ```markdown ... ``` wrapper", () => {
    const input = "```markdown\n# Hello\n```";
    expect(normalizeGeneratedMarkdown(input)).toBe("# Hello");
  });

  it("strips ```md ... ``` wrapper", () => {
    const input = "```md\nsome content\n```";
    expect(normalizeGeneratedMarkdown(input)).toBe("some content");
  });

  it("strips generic ``` ... ``` wrapper", () => {
    const input = "```\njust text\n```";
    expect(normalizeGeneratedMarkdown(input)).toBe("just text");
  });

  it("leaves plain markdown unchanged", () => {
    const input = "## Section\n\nSome text.";
    expect(normalizeGeneratedMarkdown(input)).toBe("## Section\n\nSome text.");
  });

  it("adds newline after code fence when model jams language tag and code", () => {
    const input = "```typescript// first line";
    expect(normalizeGeneratedMarkdown(input)).toBe("```typescript\n// first line");
  });

  it("inserts blank line before fenced code block when adjacent to text", () => {
    const input = "Some text.\n```ts\ncode\n```";
    expect(normalizeGeneratedMarkdown(input)).toBe("Some text.\n\n```ts\ncode\n```");
  });

  it("splits jammed comment lines", () => {
    const input = "// foo// bar";
    expect(normalizeGeneratedMarkdown(input)).toBe("// foo\n// bar");
  });

  it("trims leading and trailing whitespace", () => {
    const input = "  \n\n# Title\n\n  ";
    expect(normalizeGeneratedMarkdown(input)).toBe("# Title");
  });
});
