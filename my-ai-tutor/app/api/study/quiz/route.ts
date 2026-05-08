import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function parseJson(raw: string): unknown {
  // Strip markdown code fences Claude sometimes adds despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  let body: { topic: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic } = body;
  if (!topic?.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Create a 5-question multiple-choice quiz about: "${topic}"

Return ONLY valid JSON — no markdown, no code blocks, no explanation text before or after.
Use this exact structure:

{
  "topic": "${topic}",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": {
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      },
      "correct": "B",
      "explanation": "Concise explanation of why B is correct."
    }
  ]
}

Rules:
- Exactly 5 questions, ids 1–5
- The "correct" field must be exactly one of: "A", "B", "C", or "D"
- Vary difficulty: 2 easy, 2 medium, 1 hard
- Explanations should be 1–2 sentences`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const data = parseJson(text);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Claude returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
