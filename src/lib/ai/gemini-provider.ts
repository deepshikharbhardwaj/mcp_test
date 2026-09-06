import type { BlogDocument, BlogStyle, Day, JournalEvent, OutputLanguage, Trip } from "@/types";
import {
  EXTRACT_EVENTS_SYSTEM_PROMPT,
  buildExtractEventsUserPrompt,
} from "@/prompts/extract-events";
import {
  GENERATE_BLOG_SYSTEM_PROMPT,
  buildGenerateBlogUserPrompt,
} from "@/prompts/generate-blog";
import {
  REGENERATE_SECTION_SYSTEM_PROMPT,
  buildRegenerateSectionUserPrompt,
} from "@/prompts/regenerate-section";
import {
  GENERATE_TRIP_STORY_SYSTEM_PROMPT,
  buildGenerateTripStoryUserPrompt,
  type TripStoryMode,
} from "@/prompts/generate-trip-story";
import type { AiProvider, ExtractedEvents, GeneratedBlog, GeneratedSection, GeneratedTripStory } from "./types";

const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Real AI provider backed by Google Gemini. Only ever instantiated and
 * called server-side (API routes / route handlers) — the key never reaches
 * the browser. See `.env.example` for `GEMINI_API_KEY`. Set `GEMINI_MODEL`
 * to override the model (e.g. a "-pro" variant for higher quality at higher
 * cost/latency).
 */
export class GeminiAiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly model: string;

  constructor(private readonly apiKey: string, model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  private async complete(system: string, user: string): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) {
      const blockReason = data.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Gemini blocked the request: ${blockReason}` : "Gemini API returned no text content");
    }
    return parseJsonLoose(text);
  }

  async extractEvents(transcript: string, dayDate: string): Promise<ExtractedEvents> {
    const result = await this.complete(
      EXTRACT_EVENTS_SYSTEM_PROMPT,
      buildExtractEventsUserPrompt(transcript, dayDate)
    );
    return result as ExtractedEvents;
  }

  async generateBlog(events: JournalEvent[], style: BlogStyle, outputLanguage: OutputLanguage, dayDate: string): Promise<GeneratedBlog> {
    const result = await this.complete(
      GENERATE_BLOG_SYSTEM_PROMPT,
      buildGenerateBlogUserPrompt(events, style, outputLanguage, dayDate)
    );
    return result as GeneratedBlog;
  }

  async regenerateSection(
    events: JournalEvent[],
    style: BlogStyle,
    outputLanguage: OutputLanguage,
    currentHeading: string,
    currentParagraphs: string[]
  ): Promise<GeneratedSection> {
    const result = await this.complete(
      REGENERATE_SECTION_SYSTEM_PROMPT,
      buildRegenerateSectionUserPrompt(events, style, outputLanguage, currentHeading, currentParagraphs)
    );
    return result as GeneratedSection;
  }

  async generateTripStory(
    trip: Trip,
    days: Day[],
    blogs: Map<string, BlogDocument>,
    mode: TripStoryMode
  ): Promise<GeneratedTripStory> {
    const result = await this.complete(
      GENERATE_TRIP_STORY_SYSTEM_PROMPT,
      buildGenerateTripStoryUserPrompt(trip, days, blogs, mode)
    );
    return result as GeneratedTripStory;
  }
}

/** Strips accidental markdown code fences before parsing, in case responseMimeType is ignored. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenced ? fenced[1]! : trimmed;
  return JSON.parse(jsonText);
}
