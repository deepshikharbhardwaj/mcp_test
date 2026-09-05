import type { BlogStyle, JournalEvent } from "@/types";
import type { AiProvider, ExtractedEvents, GeneratedBlog, GeneratedSection } from "./types";

/**
 * Zero-config fallback provider. Runs entirely offline with simple
 * heuristics — no API key, no network call, no cost.
 *
 * Honesty note: this provider does NOT translate Hindi/Hinglish into
 * polished English prose (that genuinely requires a language model). It
 * demonstrates the full pipeline shape — transcript -> structured events ->
 * sectioned "blog" with image suggestions -> editable output — using
 * lightly cleaned-up versions of the user's own words. Configure
 * `ANTHROPIC_API_KEY` (see `.env.example`) to switch to `AnthropicAiProvider`
 * for real professional-quality writing; the rest of the app doesn't change.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async extractEvents(transcript: string, _dayDate: string): Promise<ExtractedEvents> {
    const sentences = splitIntoClauses(transcript);
    const events: ExtractedEvents["events"] = sentences.map((sentence, i) => {
      const time = extractTime(sentence);
      const location = extractLocation(sentence);
      return {
        sequence: i + 1,
        time,
        location,
        activity: cleanClause(sentence),
        details: [],
        isAmbiguous: !location,
      };
    });
    return { detectedLanguage: detectLanguage(transcript), events };
  }

  async generateBlog(events: JournalEvent[], _style: BlogStyle, _dayDate: string): Promise<GeneratedBlog> {
    if (events.length === 0) {
      return { title: "Untitled Day", sections: [] };
    }
    const groups = groupEvents(events, 2);
    const sections: GeneratedSection[] = groups.map((group) => {
      const heading = group.find((e) => e.location)?.location ?? group[0]!.activity;
      const paragraphs = [group.map((e) => formatEventSentence(e)).join(" ")];
      const suggestionSource = group.find((e) => e.location)?.location;
      return {
        heading: toTitleCase(heading),
        paragraphs,
        imageSuggestion: suggestionSource,
      };
    });

    const title = deriveTitle(events);
    return { title, sections };
  }

  async regenerateSection(
    events: JournalEvent[],
    _style: BlogStyle,
    currentHeading: string,
    _currentParagraphs: string[]
  ): Promise<GeneratedSection> {
    const paragraphs = [events.map((e) => formatEventSentence(e)).join(" ")];
    const suggestionSource = events.find((e) => e.location)?.location;
    return { heading: currentHeading, paragraphs, imageSuggestion: suggestionSource };
  }
}

function splitIntoClauses(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function cleanClause(sentence: string): string {
  const trimmed = sentence.replace(/\s+/g, " ").trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const TIME_RE = /\b(\d{1,2}(:\d{2})?\s?(am|pm|AM|PM)?)\s?(baje|o'clock)?\b/;
function extractTime(sentence: string): string | null {
  if (/\d{1,2}\s?(baje|am|pm|AM|PM|:\d{2})/.test(sentence)) {
    const m = sentence.match(TIME_RE);
    return m ? m[0].trim() : null;
  }
  return null;
}

function extractLocation(sentence: string): string | null {
  const words = sentence.split(/\s+/);
  const capSeq: string[] = [];
  const found: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z]/g, "");
    if (clean.length > 1 && clean[0] === clean[0]?.toUpperCase() && /[A-Za-z]/.test(clean[0] ?? "")) {
      capSeq.push(clean);
    } else if (capSeq.length) {
      found.push(capSeq.join(" "));
      capSeq.length = 0;
    }
  }
  if (capSeq.length) found.push(capSeq.join(" "));
  return found.length ? found[0]! : null;
}

const HINDI_MARKERS = [
  "aaj", "subah", "shaam", "gaya", "gayi", "kiya", "hua", "bahut", "wahan",
  "dekha", "khaya", "pahunch", "baad", "phir", "kaafi", "bhi", "tha", "thi",
  "the", "hain", "raat",
];
function detectLanguage(transcript: string): ExtractedEvents["detectedLanguage"] {
  const hasDevanagari = /[ऀ-ॿ]/.test(transcript);
  const lower = transcript.toLowerCase();
  const hindiHits = HINDI_MARKERS.filter((w) => new RegExp(`\\b${w}\\b`).test(lower)).length;
  if (hasDevanagari && hindiHits > 2) return "mixed";
  if (hasDevanagari) return "hi";
  if (hindiHits >= 3) return "hinglish";
  if (hindiHits > 0) return "mixed";
  return "en";
}

function groupEvents(events: JournalEvent[], size: number): JournalEvent[][] {
  const groups: JournalEvent[][] = [];
  for (let i = 0; i < events.length; i += size) {
    groups.push(events.slice(i, i + size));
  }
  return groups;
}

function formatEventSentence(e: JournalEvent): string {
  const prefix = e.time ? `At ${e.time}, ` : "";
  return `${prefix}${e.activity}`;
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function deriveTitle(events: JournalEvent[]): string {
  const locations = events.map((e) => e.location).filter((l): l is string => Boolean(l));
  const unique = Array.from(new Set(locations));
  if (unique.length >= 2) return `${unique[0]} to ${unique[unique.length - 1]}`;
  if (unique.length === 1) return unique[0]!;
  return "Today's Journey";
}
