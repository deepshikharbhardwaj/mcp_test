import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai";
import type { BlogStyle, JournalEvent, OutputLanguage } from "@/types";

export const runtime = "nodejs";

interface ProcessDayRequest {
  transcript: string;
  dayDate: string;
  style: BlogStyle;
  outputLanguage: OutputLanguage;
}

export async function POST(req: Request) {
  let body: ProcessDayRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.transcript || !body.transcript.trim()) {
    return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
  }

  const provider = getAiProvider();

  try {
    const extracted = await provider.extractEvents(body.transcript, body.dayDate);

    // JournalEvent shape without ids — the client assigns ids + dayId when persisting.
    const eventsForBlog: JournalEvent[] = extracted.events.map((e, i) => ({
      ...e,
      id: `pending-${i}`,
      dayId: "pending",
    }));

    const blog = await provider.generateBlog(eventsForBlog, body.style, body.outputLanguage ?? "en", body.dayDate);

    return NextResponse.json({
      providerName: provider.name,
      detectedLanguage: extracted.detectedLanguage,
      events: extracted.events,
      blog,
    });
  } catch (err) {
    console.error("[api/ai/process-day]", err);
    const message = err instanceof Error ? err.message : "AI processing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
