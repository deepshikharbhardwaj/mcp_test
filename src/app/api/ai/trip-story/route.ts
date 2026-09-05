import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai";
import type { TripStoryMode } from "@/prompts/generate-trip-story";
import type { BlogDocument, Day, Trip } from "@/types";

export const runtime = "nodejs";

interface TripStoryRequest {
  trip: Trip;
  days: Day[];
  blogsByDayId: Record<string, BlogDocument>;
  mode: TripStoryMode;
}

export async function POST(req: Request) {
  let body: TripStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const provider = getAiProvider();
  const blogs = new Map(Object.entries(body.blogsByDayId));

  try {
    const story = await provider.generateTripStory(body.trip, body.days, blogs, body.mode);
    return NextResponse.json({ providerName: provider.name, story });
  } catch (err) {
    console.error("[api/ai/trip-story]", err);
    const message = err instanceof Error ? err.message : "Trip story generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
