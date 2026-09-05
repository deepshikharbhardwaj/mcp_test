"use client";

import Link from "next/link";
import { useState } from "react";
import type { Day } from "@/types";
import { formatLongDate } from "@/lib/utils/date";
import { StatusBadge } from "./StatusBadge";

interface Props {
  day: Day;
  tripId: string;
  onEditDate: (dayId: string, date: string) => Promise<void>;
  onRename: (dayId: string, title: string | null) => Promise<void>;
  onDelete: (dayId: string) => Promise<void>;
}

export function DayRow({ day, tripId, onEditDate, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<"date" | "title" | null>(null);
  const [dateValue, setDateValue] = useState(day.date);
  const [titleValue, setTitleValue] = useState(day.title ?? "");

  return (
    <div className="relative bg-white border border-sand rounded-2xl p-4 hover:border-clay/60 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/trips/${tripId}/days/${day.id}`} className="flex-1 min-w-0">
          <p className="text-xs tracking-widest text-mist font-medium">DAY {day.dayNumber}</p>
          <p className="text-base font-serif font-semibold text-ink truncate">
            {day.title ?? formatLongDate(day.date)}
          </p>
          {day.title && <p className="text-xs text-mist mt-0.5">{formatLongDate(day.date)}</p>}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={day.status} />
          <button
            aria-label="Day options"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-sand/60 text-mist"
          >
            ⋯
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute right-4 top-14 z-10 bg-white border border-sand rounded-xl shadow-card py-1 w-44 text-sm">
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-sand/50"
            onClick={() => { setEditing("title"); setMenuOpen(false); }}
          >
            Rename day
          </button>
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-sand/50"
            onClick={() => { setEditing("date"); setMenuOpen(false); }}
          >
            Edit date
          </button>
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-700"
            onClick={() => { setMenuOpen(false); onDelete(day.id); }}
          >
            Delete day
          </button>
        </div>
      )}

      {editing === "date" && (
        <div className="mt-3 flex gap-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm"
          />
          <button
            className="px-3 py-2 bg-ink text-paper rounded-lg text-sm"
            onClick={async () => { await onEditDate(day.id, dateValue); setEditing(null); }}
          >
            Save
          </button>
          <button className="px-3 py-2 text-sm text-mist" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}

      {editing === "title" && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            placeholder="Optional custom title"
            className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm"
          />
          <button
            className="px-3 py-2 bg-ink text-paper rounded-lg text-sm"
            onClick={async () => { await onRename(day.id, titleValue.trim() || null); setEditing(null); }}
          >
            Save
          </button>
          <button className="px-3 py-2 text-sm text-mist" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
