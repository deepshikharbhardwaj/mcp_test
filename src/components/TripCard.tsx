"use client";

import Link from "next/link";
import type { TripSummary } from "@/types";
import { formatDateRange, formatRelativeUpdated } from "@/lib/utils/date";

export function TripCard({ summary }: { summary: TripSummary }) {
  const { trip, dayCount, photoCount, lastUpdated, coverImageUrl } = summary;
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block relative rounded-2xl overflow-hidden border border-sand hover:border-clay/60 hover:shadow-card transition-all h-44"
    >
      <div
        className={`absolute inset-0 ${coverImageUrl ? "" : "hero-fallback"}`}
        style={
          coverImageUrl
            ? {
                backgroundImage: `url(${coverImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />
      {!coverImageUrl && (
        <span className="absolute right-4 top-4 text-4xl opacity-70">{trip.emoji ?? "✈️"}</span>
      )}
      <div className="absolute inset-0 hero-overlay transition-opacity group-hover:opacity-90" />

      <div className="relative h-full flex flex-col justify-end p-5 text-white">
        <div className="flex items-center gap-2">
          {coverImageUrl && <span className="text-xl leading-none">{trip.emoji ?? "✈️"}</span>}
          <h3 className="text-lg font-serif font-semibold drop-shadow-sm">{trip.name}</h3>
        </div>
        <p className="text-sm text-white/85 mt-0.5">
          {formatDateRange(trip.startDate, trip.endDate)}
          {trip.isOpenEnded ? " · ongoing" : ""}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-white/75">
          <span>{dayCount} {dayCount === 1 ? "day" : "days"}</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>{photoCount} {photoCount === 1 ? "photo" : "photos"}</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>updated {formatRelativeUpdated(lastUpdated)}</span>
        </div>
      </div>
    </Link>
  );
}
