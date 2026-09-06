import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai";
import type { BlogStyle, JournalEvent, OutputLanguage } from "@/types";

export const runtime = "nodejs";

interface RegenerateSectionRequest {
  events: JournalEvent[];
  style: BlogStyle;
  outputLanguage: OutputLanguage;
  currentHeading: string;
  currentParagraphs: string[];
}

export async function POST(req: Request) {
  let body: RegenerateSectionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const provider = getAiProvider();

  try {
    const section = await provider.regenerateSection(
      body.events,
      body.style,
      body.outputLanguage ?? "en",
      body.currentHeading,
      body.currentParagraphs
    );
    return NextResponse.json({ providerName: provider.name, section });
  } catch (err) {
    console.error("[api/ai/regenerate-section]", err);
    const message = err instanceof Error ? err.message : "AI regeneration failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
