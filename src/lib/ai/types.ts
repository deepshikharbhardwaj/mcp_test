import type { BlogDocument, BlogStyle, Day, JournalEvent, OutputLanguage, Trip } from "@/types";
import type { TripStoryMode } from "@/prompts/generate-trip-story";

export interface ExtractedEvents {
  detectedLanguage: "en" | "hi" | "hinglish" | "mixed" | "unknown";
  events: Array<Omit<JournalEvent, "id" | "dayId">>;
}

export interface GeneratedSection {
  heading: string;
  paragraphs: string[];
  imageSuggestion: string | null;
}

export interface GeneratedBlog {
  title: string;
  sections: GeneratedSection[];
}

export interface TranslatedBlog {
  title: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

export interface GeneratedTripStory {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  conclusion: string;
}

/**
 * Provider-agnostic AI pipeline. `MockAiProvider` needs no API key and runs
 * anywhere; `AnthropicAiProvider`/`GeminiAiProvider` call a real model when
 * their key is configured. Selection happens once, server side, in
 * `getAiProvider()` — nothing else in the app knows which one is active.
 */
export interface AiProvider {
  readonly name: string;
  extractEvents(transcript: string, dayDate: string): Promise<ExtractedEvents>;

  /** Canonical English structure + prose — decides section count, headings, and image slots for the whole day. */
  generateBlog(events: JournalEvent[], style: BlogStyle, dayDate: string): Promise<GeneratedBlog>;

  /** Rewrites the English structure into another language/voice, preserving section count and order exactly. */
  translateBlog(
    englishTitle: string,
    englishSections: Array<{ heading: string; paragraphs: string[] }>,
    events: JournalEvent[],
    style: BlogStyle,
    outputLanguage: OutputLanguage
  ): Promise<TranslatedBlog>;

  regenerateSection(
    events: JournalEvent[],
    style: BlogStyle,
    outputLanguage: OutputLanguage,
    currentHeading: string,
    currentParagraphs: string[]
  ): Promise<GeneratedSection>;
  generateTripStory(
    trip: Trip,
    days: Day[],
    blogs: Map<string, BlogDocument>,
    mode: TripStoryMode
  ): Promise<GeneratedTripStory>;
}
