"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getRepository } from "@/lib/db/repository";
import { generateTripStory } from "@/lib/ai/client";
import { tripStoryToHtml, tripStoryToMarkdown, downloadTextFile } from "@/lib/export";
import type { GeneratedTripStory } from "@/lib/ai/types";
import { TRIP_STORY_MODE_LABELS, type TripStoryMode } from "@/prompts/generate-trip-story";
import type { BlogDocument, Day, Trip } from "@/types";
import { Button } from "@/components/Button";

const MODES: TripStoryMode[] = ["day_by_day", "continuous", "guide", "highlights"];

export default function TripStoryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [blogsByDayId, setBlogsByDayId] = useState<Record<string, BlogDocument>>({});
  const [mode, setMode] = useState<TripStoryMode>("day_by_day");
  const [story, setStory] = useState<GeneratedTripStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const repo = getRepository();
      const [t, d] = await Promise.all([repo.getTrip(tripId), repo.listDays(tripId)]);
      setTrip(t ?? null);
      setDays(d);
      const entries: Record<string, BlogDocument> = {};
      for (const day of d) {
        const blog = await repo.getBlog(day.id);
        if (blog) entries[day.id] = blog;
      }
      setBlogsByDayId(entries);
      setLoading(false);
    })();
  }, [tripId]);

  async function handleGenerate() {
    if (!trip) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateTripStory(trip, days, blogsByDayId, mode);
      setStory(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the trip story.");
    } finally {
      setGenerating(false);
    }
  }

  const daysWithBlogs = days.filter((d) => blogsByDayId[d.id]);

  if (loading) return <main className="max-w-2xl mx-auto px-5 pt-10"><p className="text-mist text-sm">Loading…</p></main>;
  if (!trip) return <main className="max-w-2xl mx-auto px-5 pt-10"><p className="text-mist">Trip not found.</p></main>;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-8 pb-24 sm:pt-14">
      <Link href={`/trips/${tripId}`} className="text-sm text-mist hover:text-ink">← {trip.name}</Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-serif font-semibold text-ink">Complete Trip Story</h1>
        <p className="text-sm text-mist mt-1">
          {daysWithBlogs.length} of {days.length} days have a generated blog and will be included.
        </p>
      </header>

      <div className="flex gap-2 flex-wrap mb-6">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-2 rounded-full border transition-colors ${
              mode === m ? "bg-ink text-paper border-ink" : "bg-white text-mist border-sand hover:border-clay/60"
            }`}
          >
            {TRIP_STORY_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <Button fullWidth onClick={handleGenerate} disabled={generating || daysWithBlogs.length === 0}>
        {generating ? "Weaving your trip together…" : "✨ Generate Complete Trip Story"}
      </Button>

      {daysWithBlogs.length === 0 && (
        <p className="text-sm text-mist mt-3 text-center">Generate at least one day&apos;s blog first.</p>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3 mt-4">{error}</div>}

      {story && (
        <article className="mt-8 bg-white border border-sand rounded-2xl px-6 py-8 sm:px-10 sm:py-12">
          <h2 className="text-3xl font-serif font-semibold mb-4">{story.title}</h2>
          <p className="text-mist italic mb-8 editorial-prose">{story.introduction}</p>
          <div className="editorial-prose">
            {story.sections.map((s, i) => (
              <div key={i} className="mb-8">
                <h3 className="text-xl font-serif font-semibold mb-3">{s.heading}</h3>
                {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            ))}
          </div>
          <p className="text-mist italic mt-8">{story.conclusion}</p>

          <div className="flex justify-center gap-4 text-xs text-mist mt-8 pt-6 border-t border-sand">
            <button className="hover:text-clay" onClick={() => downloadTextFile(`${trip.name}-story.md`, tripStoryToMarkdown(story), "text/markdown")}>
              Export Markdown
            </button>
            <button className="hover:text-clay" onClick={() => downloadTextFile(`${trip.name}-story.html`, tripStoryToHtml(story, trip.name), "text/html")}>
              Export HTML
            </button>
          </div>
        </article>
      )}
    </main>
  );
}
