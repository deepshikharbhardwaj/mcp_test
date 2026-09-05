"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";

interface Props {
  initialText: string;
  onSave: (text: string) => Promise<void>;
  onGenerate: (text: string) => Promise<void>;
  generating: boolean;
}

export function TranscriptPanel({ initialText, onSave, onGenerate, generating }: Props) {
  const [text, setText] = useState(initialText);
  const [dirty, setDirty] = useState(false);

  useEffect(() => setText(initialText), [initialText]);

  return (
    <div className="bg-white border border-sand rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ink">Transcript</p>
        <p className="text-xs text-mist">speech-to-text arrives later — type or paste for now</p>
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true); }}
        onBlur={() => { if (dirty) { onSave(text); setDirty(false); } }}
        rows={6}
        placeholder="Aaj subah 11 baje Delhi airport se Tokyo ke liye flight thi..."
        className="w-full text-[15px] leading-relaxed bg-paper border border-sand rounded-xl px-4 py-3 resize-y focus:border-clay"
      />
      <div className="mt-4 flex justify-end">
        <Button
          onClick={async () => { if (dirty) { await onSave(text); setDirty(false); } await onGenerate(text); }}
          disabled={!text.trim() || generating}
        >
          {generating ? "Generating…" : "✨ Generate Story"}
        </Button>
      </div>
    </div>
  );
}
