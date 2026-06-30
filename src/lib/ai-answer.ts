import { normalizeGeneratedMarkdown } from "@/lib/markdown";
import type { Difficulty } from "@/types/knowledge";

export type GeneratedAnswer = {
  difficulty: Difficulty;
  content: string;
};

export const ANSWER_JSON_SCHEMA = {
  name: "interview_answer",
  strict: true,
  schema: {
    type: "object",
    properties: {
      difficulty: {
        type: "string",
        enum: ["EASY", "MEDIUM", "HARD"],
        description: "Interview difficulty for this question"
      },
      content: {
        type: "string",
        description: "GitHub Flavored Markdown answer only, no HTML"
      }
    },
    required: ["difficulty", "content"],
    additionalProperties: false
  }
} as const;

export const ANSWER_SYSTEM_PROMPT = `You are a technical interview knowledge-base writer.

Return a JSON object with:
- difficulty: EASY, MEDIUM, or HARD — your assessment of how hard this question is in a typical interview (not the user's current label unless it clearly fits).
- content: the full answer as GitHub Flavored Markdown only. Never use HTML.

Markdown rules for content:
- Use ## for main sections and ### for subsections
- Use bullet lists with "- " for points
- For code, use fenced blocks: opening line is three backticks + language id (e.g. typescript), then a newline, then code, then a closing line of three backticks
- Each code statement on its own line with normal indentation
- Do not wrap content in an outer markdown code fence
- No preamble like "Here is" or "Sure"`;

export function parseJsonBody<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label} was empty.`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`${label} was not valid JSON.`);
  }
}

export function normalizeDifficulty(value: unknown, fallback: Difficulty = "MEDIUM"): Difficulty {
  const upper = String(value ?? "").toUpperCase();
  if (upper === "EASY" || upper === "MEDIUM" || upper === "HARD") {
    return upper;
  }
  return fallback;
}

export function parseGeneratedAnswer(raw: string, fallbackDifficulty: Difficulty): GeneratedAnswer {
  const parsed = parseJsonBody<{ difficulty?: unknown; content?: unknown }>(raw, "Model output");

  return {
    difficulty: normalizeDifficulty(parsed.difficulty, fallbackDifficulty),
    content: normalizeGeneratedMarkdown(String(parsed.content ?? ""))
  };
}

// ─── AI Review ───────────────────────────────────────────────────────────────

export type ReviewFeedbackItem = {
  type: "strength" | "issue" | "suggestion";
  text: string;
};

export type ReviewResult = {
  rating: "good" | "needs-work" | "poor";
  summary: string;
  feedback: ReviewFeedbackItem[];
};

export const REVIEW_JSON_SCHEMA = {
  name: "answer_review",
  strict: true,
  schema: {
    type: "object",
    properties: {
      rating: { type: "string", enum: ["good", "needs-work", "poor"] },
      summary: { type: "string" },
      feedback: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["strength", "issue", "suggestion"] },
            text: { type: "string" }
          },
          required: ["type", "text"],
          additionalProperties: false
        }
      }
    },
    required: ["rating", "summary", "feedback"],
    additionalProperties: false
  }
} as const;

export const REVIEW_SYSTEM_PROMPT = `You are a senior software engineer reviewing a technical interview answer.

Return a JSON object with:
- rating: "good" | "needs-work" | "poor" — overall quality
- summary: one sentence (≤ 25 words) on the overall answer
- feedback: 3–6 items, each with:
  - type: "strength" (done well) | "issue" (correctness or completeness problem) | "suggestion" (specific improvement)
  - text: 1–2 sentences, direct and actionable

Evaluate: correctness, time/space complexity, edge case handling, code clarity, completeness.
Be specific. No vague praise.`;

export function parseReviewResult(raw: string): ReviewResult {
  const parsed = parseJsonBody<{
    rating?: unknown;
    summary?: unknown;
    feedback?: unknown;
  }>(raw, "Review output");

  const rating = ["good", "needs-work", "poor"].includes(String(parsed.rating ?? ""))
    ? (parsed.rating as ReviewResult["rating"])
    : "needs-work";

  const feedback = Array.isArray(parsed.feedback)
    ? (parsed.feedback as ReviewFeedbackItem[]).filter(
        (item) =>
          typeof item?.text === "string" &&
          ["strength", "issue", "suggestion"].includes(item?.type)
      )
    : [];

  return {
    rating,
    summary: String(parsed.summary ?? ""),
    feedback
  };
}

// ─── OpenAI helpers ──────────────────────────────────────────────────────────

/** Extract assistant text from Chat Completions or Responses API payloads. */
export function extractOpenAiText(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const payload = data as Record<string, unknown>;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as {
      message?: { content?: string | Array<{ type?: string; text?: string }> };
    };
    const content = choice.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n");
    }
  }

  const output = payload.output;
  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        const block = item as { content?: Array<{ type?: string; text?: string }> };
        return block.content ?? [];
      })
      .filter((part) => part.type === "output_text" || part.type === "text")
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");
  }

  return "";
}
