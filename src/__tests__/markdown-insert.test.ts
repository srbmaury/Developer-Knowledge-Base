import { describe, expect, it } from "vitest";
import { applyMarkdownInsert } from "@/lib/markdown-insert";

const text = "hello world";
const all = { start: 0, end: text.length };
const none = { start: 5, end: 5 }; // cursor between "hello" and " world"
const sel = { start: 0, end: 5 }; // selects "hello"

describe("applyMarkdownInsert – heading prefixes", () => {
  it("h1 adds # prefix to the current line", () => {
    const { next } = applyMarkdownInsert(text, all.start, all.end, "h1");
    expect(next).toBe("# hello world");
  });

  it("h2 adds ## prefix", () => {
    expect(applyMarkdownInsert(text, 0, 0, "h2").next).toBe("## hello world");
  });

  it("h3 adds ### prefix", () => {
    expect(applyMarkdownInsert(text, 0, 0, "h3").next).toBe("### hello world");
  });

  it("replaces an existing heading prefix before applying new one", () => {
    const withH2 = "## existing heading";
    const { next } = applyMarkdownInsert(withH2, 0, withH2.length, "h1");
    expect(next).toBe("# existing heading");
  });

  it("applies heading only to the selected lines (multiline)", () => {
    const multiline = "line1\nline2\nline3";
    // Select just line2
    const { next } = applyMarkdownInsert(multiline, 6, 11, "h2");
    expect(next).toBe("line1\n## line2\nline3");
  });
});

describe("applyMarkdownInsert – list prefixes", () => {
  it("bullet adds '- ' prefix", () => {
    expect(applyMarkdownInsert(text, 0, 0, "bullet").next).toBe("- hello world");
  });

  it("ordered list numbers each line starting from 1", () => {
    const multiline = "alpha\nbeta\ngamma";
    const { next } = applyMarkdownInsert(multiline, 0, multiline.length, "ordered");
    expect(next).toBe("1. alpha\n2. beta\n3. gamma");
  });

  it("converting a bullet list to ordered strips the bullet prefix", () => {
    const bulleted = "- item one\n- item two";
    const { next } = applyMarkdownInsert(bulleted, 0, bulleted.length, "ordered");
    expect(next).toBe("1. item one\n2. item two");
  });

  it("quote adds '> ' prefix", () => {
    expect(applyMarkdownInsert(text, 0, 0, "quote").next).toBe("> hello world");
  });
});

describe("applyMarkdownInsert – inline wrapping", () => {
  it("bold wraps selection with **", () => {
    const { next, selectionStart, selectionEnd } = applyMarkdownInsert(text, sel.start, sel.end, "bold");
    expect(next).toBe("**hello** world");
    // selection should cover the original word inside the markers
    expect(next.slice(selectionStart, selectionEnd)).toBe("hello");
  });

  it("bold uses placeholder when nothing is selected", () => {
    const { next } = applyMarkdownInsert(text, none.start, none.end, "bold");
    expect(next).toContain("**bold text**");
  });

  it("italic wraps selection with *", () => {
    const { next } = applyMarkdownInsert(text, sel.start, sel.end, "italic");
    expect(next).toBe("*hello* world");
  });

  it("code wraps selection with backticks", () => {
    const { next } = applyMarkdownInsert(text, sel.start, sel.end, "code");
    expect(next).toBe("`hello` world");
  });
});

describe("applyMarkdownInsert – code block", () => {
  it("wraps selection in a fenced code block with language", () => {
    const { next, selectionStart, selectionEnd } = applyMarkdownInsert(
      "const x = 1;",
      0,
      13,
      "codeBlock",
      "typescript"
    );
    expect(next).toBe("```typescript\nconst x = 1;\n```");
    expect(next.slice(selectionStart, selectionEnd)).toBe("const x = 1;");
  });

  it("uses placeholder code when nothing is selected", () => {
    const { next } = applyMarkdownInsert("", 0, 0, "codeBlock", "javascript");
    expect(next).toContain("// your code here");
    expect(next.startsWith("```javascript")).toBe(true);
  });

  it("omits language identifier when language is 'none'", () => {
    const { next } = applyMarkdownInsert("code", 0, 4, "codeBlock", "none");
    expect(next.startsWith("```\n")).toBe(true);
  });
});

describe("applyMarkdownInsert – link", () => {
  it("wraps selection as link text and pre-selects the url placeholder", () => {
    const base = "click here to go";
    const { next, selectionStart, selectionEnd } = applyMarkdownInsert(base, 6, 10, "link");
    // "here" becomes the link text
    expect(next).toBe("click [here](url) to go");
    expect(next.slice(selectionStart, selectionEnd)).toBe("url");
  });

  it("uses placeholder link text when nothing is selected", () => {
    const { next } = applyMarkdownInsert("", 0, 0, "link");
    expect(next).toBe("[link text](url)");
  });
});

describe("applyMarkdownInsert – horizontal rule", () => {
  it("inserts --- with surrounding blank lines after cursor", () => {
    const { next } = applyMarkdownInsert("above", 5, 5, "hr");
    expect(next).toBe("above\n\n---\n\n");
  });
});

describe("applyMarkdownInsert – result cursor / selection positions", () => {
  it("selectionStart <= selectionEnd for all actions", () => {
    const actions = ["h1", "h2", "h3", "bullet", "ordered", "bold", "italic", "code", "codeBlock", "quote", "link", "hr"] as const;
    for (const action of actions) {
      const { selectionStart, selectionEnd } = applyMarkdownInsert(text, 0, 5, action);
      expect(selectionStart).toBeLessThanOrEqual(selectionEnd);
    }
  });
});
