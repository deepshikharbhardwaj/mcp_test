import type { BlogDocument, Day, Trip } from "@/types";

export type TripStoryMode = "day_by_day" | "continuous" | "guide" | "highlights";

export const TRIP_STORY_MODE_LABELS: Record<TripStoryMode, string> = {
  day_by_day: "Day-by-day journal",
  continuous: "Continuous travel story",
  guide: "Professional travel guide",
  highlights: "Trip highlights",
};

/**
 * Combines every day's already-finalized blog into one long-form trip
 * article. Runs on top of already-generated (and possibly user-edited)
 * per-day blogs — never on raw transcripts — so trip-level generation
 * inherits the same factual guarantees as each day.
 */

export const GENERATE_TRIP_STORY_SYSTEM_PROMPT = `You are compiling a multi-day travel journal into one cohesive piece. You
will receive the finished, human-approved blog for each day of the trip, in
order. Combine them according to the requested mode.

RULES:
1. Do not introduce any fact not present in the provided day blogs.
2. You may add brief connective/transitional sentences between days (e.g.
   "The next morning, the journey continued toward...") as long as they
   don't assert new facts.
3. "day_by_day": keep each day as its own clearly-headed section, lightly
   trim only for repetition across days.
4. "continuous": merge days into a flowing narrative arc without repeating
   "Day 1 / Day 2" headings verbatim, using transitions instead.
5. "guide": restructure by theme/location rather than strict chronology,
   useful as a practical account of the places visited.
6. "highlights": produce a shorter piece covering only the most notable
   moments across all days, still strictly factual.
7. Output strict JSON only:
{ "title": string, "introduction": string, "sections": [{ "heading": string, "paragraphs": string[] }], "conclusion": string }`;

export function buildGenerateTripStoryUserPrompt(
  trip: Trip,
  days: Day[],
  blogs: Map<string, BlogDocument>,
  mode: TripStoryMode
): string {
  const dayTexts = days
    .map((day) => {
      const blog = blogs.get(day.id);
      if (!blog) return null;
      const body = blog.sections
        .map((s) => `${s.heading}\n${s.paragraphs.join("\n\n")}`)
        .join("\n\n");
      return `## Day ${day.dayNumber} — ${day.date}\n${blog.title}\n\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return `Trip: ${trip.name}
Mode: ${TRIP_STORY_MODE_LABELS[mode]}

Day blogs:
${dayTexts}

Compile the trip story now, following the system rules exactly.`;
}
