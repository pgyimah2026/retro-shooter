import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 60;

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
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Create an educational case study about: "${topic}"

Return ONLY valid JSON — no markdown, no code blocks, no explanation text before or after.
Use this exact structure:

{
  "topic": "${topic}",
  "title": "A compelling case study title",
  "scenario": "A realistic, detailed scenario description. Write 2–3 paragraphs that set the scene, introduce the key challenge or decision, and provide relevant context. Be specific and make it feel real.",
  "questions": [
    {
      "id": 1,
      "question": "A focused analytical question about the scenario",
      "analysis": "A thorough suggested answer (3–5 sentences). Explain the reasoning, reference specific details from the scenario, and highlight key principles."
    }
  ]
}

Rules:
- Exactly 3 questions, ids 1–3
- The scenario must be at least 150 words
- Questions should progress from identifying the problem → analyzing causes → recommending solutions
- Analysis answers should be substantive and educational`,
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
