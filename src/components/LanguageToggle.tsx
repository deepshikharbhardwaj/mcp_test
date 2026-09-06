"use client";

import type { OutputLanguage } from "@/types";

const OPTIONS: Array<{ value: OutputLanguage; label: string; hint: string }> = [
  { value: "en", label: "English", hint: "Polished, professional English" },
  { value: "hi", label: "हिंदी", hint: "Natural Hindi, easy for all ages" },
  { value: "hinglish", label: "Hinglish", hint: "Gen-Z cool English with a Hindi flavor" },
];

export function LanguageToggle({ value, onChange }: { value: OutputLanguage; onChange: (v: OutputLanguage) => void }) {
  return (
    <div>
      <div className="inline-flex bg-sand/50 rounded-full p-1 gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={`text-xs px-3 py-2 rounded-full transition-colors ${
              value === opt.value ? "bg-ink text-paper" : "text-mist hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-mist mt-1">{OPTIONS.find((o) => o.value === value)?.hint} · all three ready instantly</p>
    </div>
  );
}
