import type { BlogStyle, JournalEvent } from "@/types";

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

/**
 * Provider-agnostic AI pipeline. `MockAiProvider` needs no API key and runs
 * anywhere; `AnthropicAiProvider` calls Claude for real extraction/writing
 * when `ANTHROPIC_API_KEY` is configured. Selection happens once, server
 * side, in `getAiProvider()` — nothing else in the app knows which one is
 * active.
 */
export interface AiProvider {
  readonly name: string;
  extractEvents(transcript: string, dayDate: string): Promise<ExtractedEvents>;
  generateBlog(events: JournalEvent[], style: BlogStyle, dayDate: string): Promise<GeneratedBlog>;
  regenerateSection(
    events: JournalEvent[],
    style: BlogStyle,
    currentHeading: string,
    currentParagraphs: string[]
  ): Promise<GeneratedSection>;
}
