import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJson(raw: string): unknown {
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

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Create 8 educational flashcards about: "${topic}"

Return ONLY valid JSON — no markdown, no code blocks, no explanation text before or after.
Use this exact structure:

{
  "topic": "${topic}",
  "cards": [
    {
      "id": 1,
      "front": "Term or short question",
      "back": "Clear definition or answer (1–3 sentences)"
    }
  ]
}

Rules:
- Exactly 8 cards, ids 1–8
- Fronts should be concise (a term, formula, or short question)
- Backs should be clear and complete without being excessively long
- Cover a range of key concepts — not all the same sub-topic`,
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
