"use client";

import { FormEvent, useState } from "react";
import { Button } from "./Button";
import { todayISO } from "@/lib/utils/date";

interface Props {
  onClose: () => void;
  onCreate: (input: { name: string; startDate: string; endDate: string | null }) => Promise<void>;
}

export function NewTripModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [showEndDate, setShowEndDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your trip a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), startDate, endDate: showEndDate && endDate ? endDate : null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-sand rounded-full mx-auto mb-5 sm:hidden" />
        <h2 className="text-xl font-serif font-semibold mb-5">New Trip</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-mist mb-1.5" htmlFor="trip-name">Trip name</label>
            <input
              id="trip-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Japan"
              className="w-full text-base bg-white border border-sand rounded-xl px-4 py-3 focus:border-clay"
            />
          </div>
          <div>
            <label className="block text-sm text-mist mb-1.5" htmlFor="start-date">Start date</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-base bg-white border border-sand rounded-xl px-4 py-3 focus:border-clay"
            />
          </div>

          {showEndDate ? (
            <div>
              <label className="block text-sm text-mist mb-1.5" htmlFor="end-date">End date</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full text-base bg-white border border-sand rounded-xl px-4 py-3 focus:border-clay"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowEndDate(true)}
              className="text-sm text-clay hover:text-accent"
            >
              + Add end date (optional)
            </button>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Creating…" : "Create Trip"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
