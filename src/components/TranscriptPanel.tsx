"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { LiveTranscribe } from "./LiveTranscribe";

interface Props {
  initialText: string;
  onSave: (text: string) => Promise<void>;
  onGenerate: (text: string) => Promise<void>;
  generating: boolean;
}

export function TranscriptPanel({ initialText, onSave, onGenerate, generating }: Props) {
  const [text, setText] = useState(initialText);
  const dirtyRef = useRef(false);

  useEffect(() => setText(initialText), [initialText]);

  function handleAppend(spoken: string) {
    setText((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${spoken}` : spoken;
      dirtyRef.current = true;
      onSave(next);
      return next;
    });
  }

  return (
    <div className="bg-white border border-sand rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <p className="text-sm font-medium text-ink">Transcript</p>
        <p className="text-xs text-mist">speak it live below, or type/paste</p>
      </div>

      <LiveTranscribe onAppend={handleAppend} />

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); dirtyRef.current = true; }}
        onBlur={() => { if (dirtyRef.current) { onSave(text); dirtyRef.current = false; } }}
        rows={6}
        placeholder="Aaj subah 11 baje Delhi airport se Tokyo ke liye flight thi..."
        className="w-full text-[15px] leading-relaxed bg-paper border border-sand rounded-xl px-4 py-3 resize-y focus:border-clay"
      />
      <div className="mt-4 flex justify-end">
        <Button
          onClick={async () => { if (dirtyRef.current) { await onSave(text); dirtyRef.current = false; } await onGenerate(text); }}
          disabled={!text.trim() || generating}
        >
          {generating ? "Generating…" : "✨ Generate Story"}
        </Button>
      </div>
    </div>
  );
}
