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
