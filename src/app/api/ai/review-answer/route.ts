import { NextResponse, type NextRequest } from "next/server";
import {
  REVIEW_JSON_SCHEMA,
  REVIEW_SYSTEM_PROMPT,
  extractOpenAiText,
  parseJsonBody,
  parseReviewResult,
  type ReviewResult
} from "@/lib/ai-answer";
import { getSessionUser } from "@/server/auth";

type ReviewRequest = {
  questionTitle: string;
  questionDescription: string;
  solutionContent: string;
  solutionLanguage: string;
};

const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSecs: number } {
  const now = Date.now();
  const hits = (rateLimitMap.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateLimitMap.set(userId, hits);
    const retryAfterSecs = Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSecs };
  }
  hits.push(now);
  rateLimitMap.set(userId, hits);
  return { allowed: true, retryAfterSecs: 0 };
}

const MAX_TITLE_CHARS = 200;
const MAX_DESC_CHARS = 1000;
const MAX_CONTENT_CHARS = 8000;

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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await response.text();

  if (!response.ok) {
    let message = raw || `OpenAI request failed (${response.status}).`;
    try {
      const err = parseJsonBody<{ error?: { message?: string } }>(raw, "OpenAI error");
      message = err.error?.message ?? message;
    } catch {
      // use raw
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

function buildUserPrompt(body: ReviewRequest): string {
  const title = body.questionTitle.slice(0, MAX_TITLE_CHARS);
  const description = (body.questionDescription ?? "").slice(0, MAX_DESC_CHARS);
  const content = (body.solutionContent ?? "").slice(0, MAX_CONTENT_CHARS);
  const lang = body.solutionLanguage && body.solutionLanguage !== "none"
    ? body.solutionLanguage
    : "unspecified";

  return [
    `Question: ${title}`,
    description ? `Description: ${description}` : null,
    `Language: ${lang}`,
    "",
    "Answer:",
    content || "(empty)"
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const rateCheck = checkRateLimit(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfterSecs}s.` },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSecs) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing. Add it to .env and restart the dev server." },
      { status: 501 }
    );
  }

  let body: ReviewRequest;
  try {
    const raw = await request.text();
    body = parseJsonBody<ReviewRequest>(raw, "Request body");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 }
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const userPrompt = buildUserPrompt(body);

  const chatBody = {
    model,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: REVIEW_JSON_SCHEMA
    }
  };

  let textResult = await callOpenAi(apiKey, model, chatBody, "chat");

  if (!textResult.ok) {
    const responsesBody = {
      model,
      input: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: REVIEW_JSON_SCHEMA.name,
          schema: REVIEW_JSON_SCHEMA.schema,
          strict: true
        }
      }
    };
    textResult = await callOpenAi(apiKey, model, responsesBody, "responses");
  }

  if (!textResult.ok) {
    return NextResponse.json({ error: textResult.message }, { status: textResult.status });
  }

  let review: ReviewResult;
  try {
    review = parseReviewResult(textResult.text);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not parse model output." },
      { status: 502 }
    );
  }

  return NextResponse.json(review);
}
