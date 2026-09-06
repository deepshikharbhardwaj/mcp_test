import type { BlogStyle, JournalEvent, OutputLanguage } from "@/types";
import { STYLE_DESCRIPTIONS } from "./generate-blog";
import { OUTPUT_LANGUAGE_DESCRIPTIONS } from "./language-descriptions";

/**
 * Second-phase rewrite: takes the already-approved English blog structure
 * (from `generate-blog.ts`) and rewrites it into another language/voice,
 * preserving the exact same section count and order.
 *
 * This is what lets English, Hindi, and Hinglish editions all exist after
 * ONE "Generate Story" tap, with photo placements staying aligned across
 * all three: the structural decisions (how many sections, what each
 * covers, where a photo belongs) are made once in English, and this step
 * only changes the words, not the shape.
 */

export const TRANSLATE_BLOG_SYSTEM_PROMPT = `You are rewriting an already-finished, fact-checked travel blog entry into
a different language and voice. You will be given the current title and
per-section heading/paragraphs (in English), plus the original events they
are based on for factual grounding.

RULES:
1. Produce EXACTLY the same number of sections, in the same order, each
   still covering the same real content as its English counterpart. This is
   a rewrite, not a restructuring — do not merge, split, add, or remove
   sections.
2. Translate the MEANING faithfully into the requested output language and
   voice. Do not add any fact not present in the original text or the
   source events. Do not drop meaningful content either.
3. Preserve the narrative craft of the English version — catchy headings,
   narrative flow between events — adapted naturally into the target
   language's own voice, not a stiff literal translation.
4. Where the English version preserved an ambiguity or gap, keep that same
   ambiguity — don't resolve it just because you're rewriting.
5. Output strict JSON only, matching the schema below. No markdown fences,
   no commentary outside the JSON. Do not include "imageSuggestion" — that
   stays fixed from the English version and is merged back in afterward.

SCHEMA:
{
  "title": string,
  "sections": [
    { "heading": string, "paragraphs": string[] }
  ]
}`;

export function buildTranslateBlogUserPrompt(
  englishTitle: string,
  englishSections: Array<{ heading: string; paragraphs: string[] }>,
  events: JournalEvent[],
  style: BlogStyle,
  outputLanguage: OutputLanguage
): string {
  return `Target output language/voice: ${OUTPUT_LANGUAGE_DESCRIPTIONS[outputLanguage]}
Overall style: ${STYLE_DESCRIPTIONS[style]}

Original events, for factual grounding (JSON):
${JSON.stringify(events, null, 2)}

Current English version:
${JSON.stringify({ title: englishTitle, sections: englishSections }, null, 2)}

Rewrite this now in the target language/voice, following the system rules exactly.`;
}
