"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getRepository } from "@/lib/db/repository";
import type { Day, Trip } from "@/types";
import { formatDateRange } from "@/lib/utils/date";
import { DayRow } from "@/components/DayRow";
import { Button } from "@/components/Button";

export default function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState(false);

  async function refresh() {
    const repo = getRepository();
    const [t, d] = await Promise.all([repo.getTrip(tripId), repo.listDays(tripId)]);
    setTrip(t ?? null);
    setDays(d);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleAddDay() {
    setAddingDay(true);
    try {
      const repo = getRepository();
      await repo.addDay(tripId);
      await refresh();
    } finally {
      setAddingDay(false);
    }
  }

  async function handleEditDate(dayId: string, date: string) {
    await getRepository().updateDay(dayId, { date });
    await refresh();
  }

  async function handleRename(dayId: string, title: string | null) {
    await getRepository().updateDay(dayId, { title });
    await refresh();
  }

  async function handleDelete(dayId: string) {
    if (!confirm("Delete this day? This removes its recording, transcript, blog and photos permanently.")) return;
    await getRepository().deleteDay(dayId);
    await refresh();
  }

  if (loading) {
    return <main className="max-w-2xl mx-auto px-5 pt-10"><p className="text-mist text-sm">Loading trip…</p></main>;
  }

  if (!trip) {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-10">
        <p className="text-mist">Trip not found.</p>
        <Link href="/" className="text-clay text-sm">← Back to journal</Link>
      </main>
    );
  }

  const lastDate = days[days.length - 1]?.date ?? trip.startDate;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-8 pb-28 sm:pt-14">
      <Link href="/" className="text-sm text-mist hover:text-ink">← My Travel Journal</Link>

      <header className="mt-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{trip.emoji ?? "✈️"}</span>
          <h1 className="text-2xl font-serif font-semibold text-ink">{trip.name}</h1>
        </div>
        <p className="text-sm text-mist mt-1 tracking-wide">
          {formatDateRange(trip.startDate, trip.endDate ?? (trip.isOpenEnded ? lastDate : trip.endDate))}
          {trip.isOpenEnded ? " · ongoing" : ""}
        </p>
      </header>

      <div className="space-y-3">
        {days.map((day) => (
          <DayRow
            key={day.id}
            day={day}
            tripId={tripId}
            onEditDate={handleEditDate}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <Button variant="secondary" size="lg" fullWidth className="mt-4" onClick={handleAddDay} disabled={addingDay}>
        {addingDay ? "Adding…" : "+ Add Day"}
      </Button>

      {days.length >= 2 && (
        <div className="mt-10 pt-8 border-t border-sand text-center">
          <p className="text-sm text-mist mb-3">Once your days are told, weave them into one trip story.</p>
          <Button variant="secondary" onClick={() => router.push(`/trips/${tripId}/story`)}>
            ✨ Generate Complete Trip Story
          </Button>
        </div>
      )}
    </main>
  );
}
