import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  let body: { messages: { role: "user" | "assistant"; content: string }[]; systemPrompt: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, systemPrompt } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }
  if (!systemPrompt || typeof systemPrompt !== "string") {
    return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    });

    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(enc.encode(chunk.delta.text));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? 500;
      return NextResponse.json(
        { error: err.message ?? "Anthropic API error" },
        { status }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
