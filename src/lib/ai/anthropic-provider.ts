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
  TRANSLATE_BLOG_SYSTEM_PROMPT,
  buildTranslateBlogUserPrompt,
} from "@/prompts/translate-blog";
import {
  REGENERATE_SECTION_SYSTEM_PROMPT,
  buildRegenerateSectionUserPrompt,
} from "@/prompts/regenerate-section";
import {
  GENERATE_TRIP_STORY_SYSTEM_PROMPT,
  buildGenerateTripStoryUserPrompt,
  type TripStoryMode,
} from "@/prompts/generate-trip-story";
import type { AiProvider, ExtractedEvents, GeneratedBlog, GeneratedSection, GeneratedTripStory, TranslatedBlog } from "./types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

/**
 * Real AI provider backed by Claude. Only ever instantiated and called
 * server-side (API routes / route handlers) — the API key never reaches the
 * browser. See `.env.example` for `ANTHROPIC_API_KEY`.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";

  constructor(private readonly apiKey: string) {}

  private async complete(system: string, user: string): Promise<unknown> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Anthropic API returned no text content");
    return parseJsonLoose(text);
  }

  async extractEvents(transcript: string, dayDate: string): Promise<ExtractedEvents> {
    const result = await this.complete(
      EXTRACT_EVENTS_SYSTEM_PROMPT,
      buildExtractEventsUserPrompt(transcript, dayDate)
    );
    return result as ExtractedEvents;
  }

  async generateBlog(events: JournalEvent[], style: BlogStyle, dayDate: string): Promise<GeneratedBlog> {
    const result = await this.complete(
      GENERATE_BLOG_SYSTEM_PROMPT,
      buildGenerateBlogUserPrompt(events, style, dayDate)
    );
    return result as GeneratedBlog;
  }

  async translateBlog(
    englishTitle: string,
    englishSections: Array<{ heading: string; paragraphs: string[] }>,
    events: JournalEvent[],
    style: BlogStyle,
    outputLanguage: OutputLanguage
  ): Promise<TranslatedBlog> {
    const result = await this.complete(
      TRANSLATE_BLOG_SYSTEM_PROMPT,
      buildTranslateBlogUserPrompt(englishTitle, englishSections, events, style, outputLanguage)
    );
    return result as TranslatedBlog;
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

/** Strips accidental markdown code fences before parsing, since prompts sometimes get wrapped anyway. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenced ? fenced[1]! : trimmed;
  return JSON.parse(jsonText);
}
