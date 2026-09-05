import type { BlogSection } from "@/types";

/**
 * Standalone image-suggestion prompt.
 *
 * V1 asks `generate-blog.ts` to produce image suggestions inline (one LLM
 * call instead of two). This file exists for the case where suggestions
 * need to be regenerated independently — e.g. the user liked the text of a
 * section but wants a fresh placeholder idea, or uploaded photos and wants
 * suggestions re-ranked against what's already available.
 */

export const SUGGEST_IMAGES_SYSTEM_PROMPT = `You suggest, for a single travel-journal section, a short label describing
what photo would naturally illustrate it — based only on what the section
text actually describes. Never suggest a specific stock photo, a generic
travel cliché image, or a location/subject not mentioned in the text.

If the section is purely transitional and no specific photo subject is
implied, return null rather than guessing.

Output strict JSON: { "imageSuggestion": string | null }`;

export function buildSuggestImageUserPrompt(section: Pick<BlogSection, "heading" | "paragraphs">): string {
  return `Section heading: ${section.heading}

Section text:
${section.paragraphs.join("\n\n")}

Suggest an image label now.`;
}
