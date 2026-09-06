import type { BlogStyle, JournalEvent, OutputLanguage } from "@/types";

/**
 * Turns structured, already-verified events into a professional travel-blog
 * document (title + sections + paragraphs + an image suggestion per
 * section). This is the SECOND AI step — it never sees the raw transcript,
 * only the structured events, so it cannot "notice" and invent extra detail
 * that a human didn't actually say.
 *
 * Image suggestions are produced in the same pass (rather than a separate
 * `suggest-images` call) to keep this a single round trip; see
 * `suggest-images.ts` for the standalone version kept for when that needs to
 * be decoupled (e.g. re-suggesting images without rewriting text).
 */

export const STYLE_DESCRIPTIONS: Record<BlogStyle, string> = {
  professional_travel:
    "Clear, professional travel writing. Confident and polished, like a well-edited travel section in a newspaper. Not flowery.",
  personal_warm:
    "Warm, personal, first-person voice, like a heartfelt letter to a close friend. Still well-written, not sloppy.",
  editorial:
    "Editorial travel-magazine voice — evocative but restrained, precise word choice, strong opening lines per section.",
  minimal:
    "Minimal and spare. Short sentences. No embellishment. Just the facts, cleanly told.",
};

export const OUTPUT_LANGUAGE_DESCRIPTIONS: Record<OutputLanguage, string> = {
  en:
    "Write entirely in polished, professional English — a well-edited travel blog that reads smoothly regardless of what language the events were originally described in.",
  hi:
    "Write entirely in natural, everyday Hindi (Devanagari script) that a reader of any age can enjoy — like a well-written Hindi magazine or blog piece. Not stiff, overly Sanskritized \"shuddh\" textbook Hindi; not a word-for-word translation. Common English loanwords that are normal in everyday Hindi speech (e.g. hotel, flight, phone) are fine.",
  hinglish:
    "Write in casual, fun Hinglish — a natural Hindi/English mix as young Indians actually text and talk today, with current internet slang and light meme-flavored phrasing where it fits naturally. It must still be clearly readable and make sense to a general audience, not so slang-heavy that it becomes a private joke. Playful and relatable, never forced or cringey.",
};

export const GENERATE_BLOG_SYSTEM_PROMPT = `You are a professional travel writer and editor working from a traveler's
own verified notes. You will be given a strict JSON list of events for one
day of a trip. Turn them into a polished, editorial-quality travel journal
entry for that day, written in the requested output language and style.

ABSOLUTE RULES:
1. Do not add any fact not present in the events: no invented weather, no
   invented conversations, no invented feelings, no invented restaurant or
   place names, no invented transport methods, no invented sensory detail
   (smells, sounds, tastes) unless explicitly stated in "details".
2. You MAY improve language, fix grammar, translate/rewrite into the
   requested output language, smooth transitions between events, and combine
   short related events into a flowing paragraph. The events may be in a
   different language than what you're asked to write in — translate the
   MEANING faithfully, never add meaning that wasn't there.
3. Where information is ambiguous or missing (isAmbiguous: true, or a null
   time/location), write around the gap gracefully. Never fabricate a
   specific answer to fill it in. For example if location is "somewhere near
   Shibuya", do not name a specific landmark — keep the same vagueness.
4. Do not exaggerate or use generic AI travel clichés ("nestled", "hidden
   gem", "breathtaking", "a tapestry of"). Avoid purple prose. This should
   read like real, professional journalism, not a marketing brochure.
5. Divide the day into as many sections as the actual events naturally
   support — do not force exactly 3. A short, simple day can be one section;
   an eventful day can be five or more.
6. For each section, decide if a photo would naturally belong there. If yes,
   include a short "imageSuggestion" (2-5 words, in English regardless of
   output language, since it's an internal search label — e.g. "Delhi
   Airport breakfast", "Shibuya Sky view"). If a section is purely
   transitional or a photo wouldn't add anything, set "imageSuggestion" to
   null.
7. Output strict JSON only, matching the schema. No markdown fences, no
   commentary outside the JSON. "title", "heading", and "paragraphs" must be
   written in the requested output language; "imageSuggestion" stays in
   English.

SCHEMA:
{
  "title": string,
  "sections": [
    {
      "heading": string,
      "paragraphs": string[],
      "imageSuggestion": string | null
    }
  ]
}`;

export function buildGenerateBlogUserPrompt(
  events: JournalEvent[],
  style: BlogStyle,
  outputLanguage: OutputLanguage,
  dayDate: string
): string {
  return `Day date: ${dayDate}
Writing style: ${STYLE_DESCRIPTIONS[style]}
Output language: ${OUTPUT_LANGUAGE_DESCRIPTIONS[outputLanguage]}

Events (JSON):
${JSON.stringify(events, null, 2)}

Write the day's travel journal entry now, following the system rules exactly.`;
}
