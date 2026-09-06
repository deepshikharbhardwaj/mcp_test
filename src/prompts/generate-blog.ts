import type { BlogStyle, JournalEvent } from "@/types";

/**
 * Turns structured, already-verified events into the CANONICAL blog
 * structure — title + sections + paragraphs (in English) + an image
 * suggestion per section. This is the SECOND AI step — it never sees the
 * raw transcript, only the structured events, so it cannot "notice" and
 * invent extra detail that a human didn't actually say.
 *
 * This English pass also fixes the section structure (how many sections,
 * what each covers, where a photo belongs) for the whole day. The Hindi and
 * Hinglish editions are produced afterward by `translate-blog.ts`, which
 * rewrites this same structure into another language/voice rather than
 * re-deciding it — that's what keeps image placement slots aligned across
 * all three languages without any extra bookkeeping.
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

export const GENERATE_BLOG_SYSTEM_PROMPT = `You are a professional travel writer and editor working from a traveler's
own verified notes. You will be given a strict JSON list of events for one
day of a trip. Turn them into a polished, editorial-quality travel journal
entry for that day, written in English in the requested style.

ABSOLUTE RULES (facts):
1. Do not add any fact not present in the events: no invented weather, no
   invented conversations, no invented feelings, no invented restaurant or
   place names, no invented transport methods, no invented sensory detail
   (smells, sounds, tastes) unless explicitly stated in "details".
2. You MAY improve language, fix grammar, smooth transitions between
   events, and combine short related events into a flowing paragraph.
3. Where information is ambiguous or missing (isAmbiguous: true, or a null
   time/location), write around the gap gracefully. Never fabricate a
   specific answer to fill it in. For example if location is "somewhere near
   Shibuya", do not name a specific landmark — keep the same vagueness.

CRAFT RULES (make it worth reading):
4. Do not exaggerate or use generic AI travel clichés ("nestled", "hidden
   gem", "breathtaking", "a tapestry of"). Avoid purple prose. This should
   read like real, sharp travel journalism, not a marketing brochure or a
   flat list of "then this happened, then that happened."
5. Write catchy, specific section headings that make someone want to keep
   reading — like a real travel-magazine headline, not a restated location
   name. Prefer something like "Wheels Up, Homeward Bound" over "Delhi
   Airport" — evocative in WORDING only, never inventing a fact the heading
   implies didn't happen.
6. Give the day a narrative throughline, not a bullet-point recap: connect
   events with a sense of cause, contrast, or forward motion ("Just as the
   jet lag started to bite...", "That's when the day took a turn..."). Each
   section should feel like it flows out of the last one, not a fresh,
   disconnected scene.
7. Divide the day into as many sections as the actual events naturally
   support — do not force exactly 3. A short, simple day can be one section;
   an eventful day can be five or more.
8. For each section, decide if a photo would naturally belong there. If yes,
   include a short "imageSuggestion" (2-5 words, e.g. "Delhi Airport
   breakfast", "Shibuya Sky view"). If a section is purely transitional or a
   photo wouldn't add anything, set "imageSuggestion" to null.
9. Output strict JSON only, matching the schema. No markdown fences, no
   commentary outside the JSON.

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

export function buildGenerateBlogUserPrompt(events: JournalEvent[], style: BlogStyle, dayDate: string): string {
  return `Day date: ${dayDate}
Writing style: ${STYLE_DESCRIPTIONS[style]}

Events (JSON):
${JSON.stringify(events, null, 2)}

Write the day's travel journal entry now, following the system rules exactly.`;
}
