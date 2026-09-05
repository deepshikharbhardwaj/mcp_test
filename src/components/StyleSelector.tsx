"use client";

import type { BlogStyle } from "@/types";

const OPTIONS: Array<{ value: BlogStyle; label: string }> = [
  { value: "professional_travel", label: "Professional Travel" },
  { value: "personal_warm", label: "Personal & Warm" },
  { value: "editorial", label: "Editorial / Magazine" },
  { value: "minimal", label: "Minimal" },
];

export function StyleSelector({ value, onChange }: { value: BlogStyle; onChange: (v: BlogStyle) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-3 py-2 rounded-full border transition-colors ${
            value === opt.value
              ? "bg-ink text-paper border-ink"
              : "bg-white text-mist border-sand hover:border-clay/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
