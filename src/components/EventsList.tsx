"use client";

import { useState } from "react";
import type { JournalEvent } from "@/types";

export function EventsList({ events }: { events: JournalEvent[] }) {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;

  return (
    <div className="bg-white border border-sand rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-ink"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Structured events ({events.length})</span>
        <span className="text-mist">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          {events.map((e) => (
            <div key={e.id} className="border-l-2 border-sand pl-3">
              <div className="flex items-center gap-2 text-xs text-mist">
                {e.time && <span className="font-mono">{e.time}</span>}
                {e.location && <span className="font-medium text-clay">{e.location}</span>}
                {e.isAmbiguous && <span className="italic">interpreted</span>}
              </div>
              <p className="text-sm text-ink mt-0.5">{e.activity}</p>
              {e.details.length > 0 && (
                <ul className="text-xs text-mist list-disc list-inside mt-0.5">
                  {e.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
