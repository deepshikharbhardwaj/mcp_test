"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/db/repository";
import type { TripSummary } from "@/types";
import { TripCard } from "@/components/TripCard";
import { NewTripModal } from "@/components/NewTripModal";
import { Button } from "@/components/Button";

export default function DashboardPage() {
  const [summaries, setSummaries] = useState<TripSummary[] | null>(null);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const router = useRouter();

  async function refresh() {
    const repo = getRepository();
    setSummaries(await repo.listTripSummaries());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(input: { name: string; startDate: string; endDate: string | null }) {
    const repo = getRepository();
    const { trip } = await repo.createTrip(input);
    setShowNewTrip(false);
    router.push(`/trips/${trip.id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-5 pt-10 pb-24 sm:pt-16">
      <header className="mb-8">
        <p className="text-xs tracking-[0.3em] text-clay font-medium mb-1">PRIVATE JOURNAL</p>
        <h1 className="text-3xl font-serif font-semibold text-ink">My Travel Journal</h1>
      </header>

      <Button size="lg" fullWidth onClick={() => setShowNewTrip(true)} className="mb-8">
        + New Trip
      </Button>

      {summaries === null ? (
        <p className="text-mist text-sm">Loading your trips…</p>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-mist">
          <p className="text-4xl mb-3">🧳</p>
          <p className="text-base">No trips yet.</p>
          <p className="text-sm mt-1">Start one above — your first day is created automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => (
            <TripCard key={s.trip.id} summary={s} />
          ))}
        </div>
      )}

      {showNewTrip && (
        <NewTripModal onClose={() => setShowNewTrip(false)} onCreate={handleCreate} />
      )}
    </main>
  );
}
