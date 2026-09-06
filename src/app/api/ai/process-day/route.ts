import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai";
import type { BlogStyle, JournalEvent } from "@/types";

export const runtime = "nodejs";

interface ProcessDayRequest {
  transcript: string;
  dayDate: string;
  style: BlogStyle;
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

    // Canonical English structure first (decides section count/headings/image
    // slots), then Hindi and Hinglish are translated from it in parallel —
    // this is what makes all three languages ready after one generation.
    const english = await provider.generateBlog(eventsForBlog, body.style, body.dayDate);
    const [hi, hinglish] = await Promise.all([
      provider.translateBlog(english.title, english.sections, eventsForBlog, body.style, "hi"),
      provider.translateBlog(english.title, english.sections, eventsForBlog, body.style, "hinglish"),
    ]);

    return NextResponse.json({
      providerName: provider.name,
      detectedLanguage: extracted.detectedLanguage,
      events: extracted.events,
      english,
      translations: { hi, hinglish },
    });
  } catch (err) {
    console.error("[api/ai/process-day]", err);
    const message = err instanceof Error ? err.message : "AI processing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
