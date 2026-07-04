import { NextResponse, type NextRequest } from "next/server";
import {
  ANSWER_JSON_SCHEMA,
  ANSWER_SYSTEM_PROMPT,
  extractOpenAiText,
  parseGeneratedAnswer,
  parseJsonBody,
  type GeneratedAnswer
} from "@/lib/ai-answer";
import { getSessionUser } from "@/server/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Difficulty } from "@/types/knowledge";

type GenerateAnswerRequest = {
  questionTitle: string;
  questionDescription: string;
  difficulty: string;
  language: string;
  defaultLanguage: string;
};

const MAX_TITLE_CHARS = 200;
const MAX_DESC_CHARS = 2000;

async function callOpenAi(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  endpoint: "chat" | "responses"
) {
  const url =
    endpoint === "chat"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.openai.com/v1/responses";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();

  if (!response.ok) {
    let message = raw || `OpenAI request failed (${response.status}).`;
    try {
      const err = parseJsonBody<{ error?: { message?: string } }>(raw, "OpenAI error");
      message = err.error?.message ?? message;
    } catch {
      // use raw text
    }
    return { ok: false as const, status: response.status, message };
  }

  if (!raw.trim()) {
    return { ok: false as const, status: 502, message: "OpenAI returned an empty response." };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false as const, status: 502, message: "OpenAI returned invalid JSON." };
  }

  const text = extractOpenAiText(data);
  if (!text.trim()) {
    return { ok: false as const, status: 502, message: "OpenAI returned no answer text." };
  }

  return { ok: true as const, text };
}

function buildUserPrompt(body: GenerateAnswerRequest, lang: string) {
  const title = body.questionTitle.slice(0, MAX_TITLE_CHARS);
  const description = (body.questionDescription ?? "").slice(0, MAX_DESC_CHARS) || "No description provided.";
  return [
    `Question: ${title}`,
    `Description: ${description}`,
    `Current difficulty label: ${body.difficulty}`,
    `Preferred code language: ${lang}`,
    "Assess the true interview difficulty and set the difficulty field accordingly.",
    "Write a clear interview-ready markdown answer in the content field.",
    `Include one well-formatted ${lang} code example in a fenced block when helpful.`
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Rate limit (per user, distributed via Upstash when configured)
  const rateCheck = await checkRateLimit(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfterSecs}s.` },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSecs) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 501 });
  }

  let body: GenerateAnswerRequest;
  try {
    const raw = await request.text();
    body = parseJsonBody<GenerateAnswerRequest>(raw, "Request body");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 }
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const fallbackLanguage = body.defaultLanguage && body.defaultLanguage !== "none" ? body.defaultLanguage : "typescript";
  const lang = body.language && body.language !== "none" ? body.language : fallbackLanguage;
  const fallbackDifficulty = (body.difficulty?.toUpperCase() ?? "MEDIUM") as Difficulty;
  const userPrompt = buildUserPrompt(body, lang);

  const chatBody = {
    model,
    messages: [
      { role: "system", content: ANSWER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_schema", json_schema: ANSWER_JSON_SCHEMA }
  };

  let textResult = await callOpenAi(apiKey, model, chatBody, "chat");

  if (!textResult.ok) {
    const responsesBody = {
      model,
      input: [
        { role: "system", content: ANSWER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: ANSWER_JSON_SCHEMA.name,
          schema: ANSWER_JSON_SCHEMA.schema,
          strict: true
        }
      }
    };
    textResult = await callOpenAi(apiKey, model, responsesBody, "responses");
  }

  if (!textResult.ok) {
    return NextResponse.json({ error: textResult.message }, { status: textResult.status });
  }

  let answer: GeneratedAnswer;
  try {
    answer = parseGeneratedAnswer(textResult.text, fallbackDifficulty);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not parse model output." },
      { status: 502 }
    );
  }

  if (!answer.content.trim()) {
    return NextResponse.json({ error: "Model returned empty markdown content." }, { status: 502 });
  }

  return NextResponse.json({ content: answer.content, difficulty: answer.difficulty });
}
