import type { BlogStyle, JournalEvent, OutputLanguage } from "@/types";
import { STYLE_DESCRIPTIONS, OUTPUT_LANGUAGE_DESCRIPTIONS } from "./generate-blog";

/**
 * Rewrites ONE section in isolation. Used by "Regenerate this section" so
 * the user never has to risk their other, already-edited sections to try a
 * different take on one paragraph. The rest of the document (other
 * sections, uploaded images, captions) is never touched by this call —
 * that's enforced in `repository.ts`/the API route, not just the prompt.
 */

export const REGENERATE_SECTION_SYSTEM_PROMPT = `You are rewriting a single section of a travel journal entry. You will get
the events that this section is based on, and the current heading/text for
context. Produce a fresh version of just this section, in the requested
output language and style.

Follow the same absolute rules as full blog generation:
- Use only facts present in the given events. Never invent detail.
- Preserve ambiguity where the events are ambiguous or incomplete.
- Avoid generic AI travel clichés and purple prose.
- Decide independently whether an image suggestion still fits (keep
  "imageSuggestion" in English regardless of output language — it's an
  internal search label).
- "heading" and "paragraphs" must be written in the requested output
  language, even if the current heading/paragraphs given for context are in
  a different language.

Output strict JSON only:
{ "heading": string, "paragraphs": string[], "imageSuggestion": string | null }`;

export function buildRegenerateSectionUserPrompt(
  events: JournalEvent[],
  style: BlogStyle,
  outputLanguage: OutputLanguage,
  currentHeading: string,
  currentParagraphs: string[]
): string {
  return `Writing style: ${STYLE_DESCRIPTIONS[style]}
Output language: ${OUTPUT_LANGUAGE_DESCRIPTIONS[outputLanguage]}

Events this section is based on (JSON):
${JSON.stringify(events, null, 2)}

Current heading: ${currentHeading}
Current paragraphs:
${currentParagraphs.join("\n\n")}

Rewrite this section now.`;
}
