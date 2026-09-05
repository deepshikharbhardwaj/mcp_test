import type { BlogStyle, JournalEvent } from "@/types";
import type { ExtractedEvents, GeneratedBlog, GeneratedSection } from "./types";

/** Browser-side helpers that call our own API routes (never the AI provider directly). */

export async function processDayTranscript(
  transcript: string,
  dayDate: string,
  style: BlogStyle
): Promise<{ providerName: string; detectedLanguage: ExtractedEvents["detectedLanguage"]; events: ExtractedEvents["events"]; blog: GeneratedBlog }> {
  const res = await fetch("/api/ai/process-day", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript, dayDate, style }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to process day");
  return data;
}

export async function regenerateSection(
  events: JournalEvent[],
  style: BlogStyle,
  currentHeading: string,
  currentParagraphs: string[]
): Promise<GeneratedSection> {
  const res = await fetch("/api/ai/regenerate-section", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events, style, currentHeading, currentParagraphs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to regenerate section");
  return data.section as GeneratedSection;
}
