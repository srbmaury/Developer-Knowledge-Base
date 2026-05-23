import { NextResponse, type NextRequest } from "next/server";
import {
  ANSWER_JSON_SCHEMA,
  ANSWER_SYSTEM_PROMPT,
  extractOpenAiText,
  parseGeneratedAnswer,
  parseJsonBody,
  type GeneratedAnswer
} from "@/lib/ai-answer";
import type { Difficulty } from "@/types/knowledge";

type GenerateAnswerRequest = {
  questionTitle: string;
  questionDescription: string;
  difficulty: string;
  language: string;
};

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
  return [
    `Question: ${body.questionTitle}`,
    `Description: ${body.questionDescription || "No description provided."}`,
    `Current difficulty label: ${body.difficulty}`,
    `Preferred code language: ${lang}`,
    "Assess the true interview difficulty and set the difficulty field accordingly.",
    "Write a clear interview-ready markdown answer in the content field.",
    `Include one well-formatted ${lang} code example in a fenced block when helpful.`
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing. Add it to .env and restart the dev server." },
      { status: 501 }
    );
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
  const lang = body.language && body.language !== "none" ? body.language : "typescript";
  const fallbackDifficulty = (body.difficulty?.toUpperCase() ?? "MEDIUM") as Difficulty;
  const userPrompt = buildUserPrompt(body, lang);

  const chatBody = {
    model,
    messages: [
      { role: "system", content: ANSWER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: ANSWER_JSON_SCHEMA
    }
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

  return NextResponse.json({
    content: answer.content,
    difficulty: answer.difficulty
  });
}
