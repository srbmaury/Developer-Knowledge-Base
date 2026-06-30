import { describe, expect, it } from "vitest";
import {
  extractOpenAiText,
  normalizeDifficulty,
  parseGeneratedAnswer,
  parseJsonBody,
  parseReviewResult
} from "@/lib/ai-answer";

describe("normalizeDifficulty", () => {
  it.each(["EASY", "easy", "Easy"])("recognises '%s' as EASY", (v) => {
    expect(normalizeDifficulty(v)).toBe("EASY");
  });

  it.each(["MEDIUM", "medium", "Medium"])("recognises '%s' as MEDIUM", (v) => {
    expect(normalizeDifficulty(v)).toBe("MEDIUM");
  });

  it.each(["HARD", "hard", "Hard"])("recognises '%s' as HARD", (v) => {
    expect(normalizeDifficulty(v)).toBe("HARD");
  });

  it("returns the fallback for unrecognised strings", () => {
    expect(normalizeDifficulty("extreme", "EASY")).toBe("EASY");
    expect(normalizeDifficulty("")).toBe("MEDIUM");
  });

  it("returns the fallback for null and undefined", () => {
    expect(normalizeDifficulty(null)).toBe("MEDIUM");
    expect(normalizeDifficulty(undefined)).toBe("MEDIUM");
  });
});

describe("parseJsonBody", () => {
  it("parses a valid JSON string", () => {
    const result = parseJsonBody<{ x: number }>('{"x":42}', "test");
    expect(result.x).toBe(42);
  });

  it("throws for an empty string", () => {
    expect(() => parseJsonBody("", "test")).toThrow("empty");
  });

  it("throws for invalid JSON", () => {
    expect(() => parseJsonBody("{bad json}", "test")).toThrow("not valid JSON");
  });
});

describe("parseGeneratedAnswer", () => {
  it("extracts difficulty and normalises content markdown", () => {
    const raw = JSON.stringify({
      difficulty: "HARD",
      content: "```markdown\n# Answer\n```"
    });
    const result = parseGeneratedAnswer(raw, "EASY");
    expect(result.difficulty).toBe("HARD");
    expect(result.content).toBe("# Answer");
  });

  it("falls back to provided difficulty when model returns an invalid value", () => {
    const raw = JSON.stringify({ difficulty: "extreme", content: "some content" });
    const result = parseGeneratedAnswer(raw, "MEDIUM");
    expect(result.difficulty).toBe("MEDIUM");
  });

  it("coerces missing content to empty string", () => {
    const raw = JSON.stringify({ difficulty: "EASY" });
    const result = parseGeneratedAnswer(raw, "EASY");
    expect(result.content).toBe("");
  });

  it("throws for completely invalid JSON", () => {
    expect(() => parseGeneratedAnswer("{invalid}", "MEDIUM")).toThrow();
  });
});

describe("parseReviewResult", () => {
  it("parses a valid review JSON string", () => {
    const raw = JSON.stringify({
      rating: "good",
      summary: "Solid solution with clear logic.",
      feedback: [
        { type: "strength", text: "Correct time complexity." },
        { type: "issue", text: "Missing null check." },
        { type: "suggestion", text: "Consider early return." }
      ]
    });
    const result = parseReviewResult(raw);
    expect(result.rating).toBe("good");
    expect(result.summary).toBe("Solid solution with clear logic.");
    expect(result.feedback).toHaveLength(3);
    expect(result.feedback[0].type).toBe("strength");
    expect(result.feedback[1].type).toBe("issue");
    expect(result.feedback[2].type).toBe("suggestion");
  });

  it("falls back to 'needs-work' rating for unrecognised values", () => {
    const raw = JSON.stringify({ rating: "excellent", summary: "ok", feedback: [] });
    expect(parseReviewResult(raw).rating).toBe("needs-work");
  });

  it("filters out feedback items with invalid type", () => {
    const raw = JSON.stringify({
      rating: "poor",
      summary: "Needs work.",
      feedback: [
        { type: "strength", text: "Good naming." },
        { type: "invalid-type", text: "Should be dropped." }
      ]
    });
    const result = parseReviewResult(raw);
    expect(result.feedback).toHaveLength(1);
    expect(result.feedback[0].type).toBe("strength");
  });

  it("handles missing feedback array gracefully", () => {
    const raw = JSON.stringify({ rating: "good", summary: "Fine." });
    const result = parseReviewResult(raw);
    expect(result.feedback).toEqual([]);
  });

  it("throws for completely invalid JSON", () => {
    expect(() => parseReviewResult("{bad}")).toThrow();
  });
});

describe("extractOpenAiText", () => {
  it("returns empty string for null / non-object input", () => {
    expect(extractOpenAiText(null)).toBe("");
    expect(extractOpenAiText("a string")).toBe("");
    expect(extractOpenAiText(42)).toBe("");
  });

  it("extracts text from output_text (Responses API)", () => {
    expect(extractOpenAiText({ output_text: "hello" })).toBe("hello");
  });

  it("ignores empty output_text and falls through to choices", () => {
    const payload = {
      output_text: "  ",
      choices: [{ message: { content: "from choices" } }]
    };
    expect(extractOpenAiText(payload)).toBe("from choices");
  });

  it("extracts string content from Chat Completions choices", () => {
    const payload = {
      choices: [{ message: { content: "the answer" } }]
    };
    expect(extractOpenAiText(payload)).toBe("the answer");
  });

  it("joins array content parts for Chat Completions multipart", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              { type: "text", text: "part one" },
              { type: "text", text: "part two" }
            ]
          }
        }
      ]
    };
    expect(extractOpenAiText(payload)).toBe("part one\npart two");
  });

  it("filters non-text parts in multipart content", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              { type: "image", text: "ignore me" },
              { type: "text", text: "keep me" }
            ]
          }
        }
      ]
    };
    expect(extractOpenAiText(payload)).toBe("keep me");
  });

  it("extracts text from Responses API output array", () => {
    const payload = {
      output: [
        {
          content: [
            { type: "output_text", text: "response one" },
            { type: "output_text", text: "response two" }
          ]
        }
      ]
    };
    expect(extractOpenAiText(payload)).toBe("response one\nresponse two");
  });

  it("returns empty string when no known field exists", () => {
    expect(extractOpenAiText({ unknown_field: "data" })).toBe("");
  });
});
