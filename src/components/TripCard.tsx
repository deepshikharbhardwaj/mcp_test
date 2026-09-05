"use client";

import Link from "next/link";
import type { TripSummary } from "@/types";
import { formatDateRange, formatRelativeUpdated } from "@/lib/utils/date";

export function TripCard({ summary }: { summary: TripSummary }) {
  const { trip, dayCount, photoCount, lastUpdated } = summary;
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block bg-white border border-sand rounded-2xl p-5 hover:border-clay/60 hover:shadow-card transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{trip.emoji ?? "✈️"}</span>
            <h3 className="text-lg font-serif font-semibold text-ink">{trip.name}</h3>
          </div>
          <p className="text-sm text-mist mt-1">
            {formatDateRange(trip.startDate, trip.endDate)}
            {trip.isOpenEnded ? " · ongoing" : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 text-sm text-mist">
        <span>{dayCount} {dayCount === 1 ? "day" : "days"}</span>
        <span className="w-1 h-1 rounded-full bg-sand" />
        <span>{photoCount} {photoCount === 1 ? "photo" : "photos"}</span>
        <span className="w-1 h-1 rounded-full bg-sand" />
        <span>updated {formatRelativeUpdated(lastUpdated)}</span>
      </div>
    </Link>
  );
}
