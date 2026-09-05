"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

type RecordingState = "idle" | "recording" | "paused" | "stopped";

interface Props {
  existingUrl: string | null;
  onReady: (blob: Blob, mimeType: string, durationSeconds: number, source: "recorded" | "uploaded") => Promise<void>;
  onDelete: () => Promise<void>;
}

function pickMimeType(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
}

export function AudioRecorder({ existingUrl, onReady, onDelete }: Props) {
  const [state, setState] = useState<RecordingState>(existingUrl ? "stopped" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(existingUrl ? "stopped" : "idle");
  }, [existingUrl]);

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startTimer() {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function handleStart() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setSaving(true);
        try {
          await onReady(blob, mimeType, seconds, "recorded");
          setState("stopped");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save recording.");
          setState("idle");
        } finally {
          setSaving(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      startTimer();
      setState("recording");
    } catch {
      setError("Microphone access was denied or is unavailable.");
    }
  }

  function handlePause() {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setState("paused");
  }

  function handleResume() {
    mediaRecorderRef.current?.resume();
    startTimer();
    setState("recording");
  }

  function handleStop() {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }

  async function handleDelete() {
    await onDelete();
    setSeconds(0);
    setState("idle");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await onReady(file, file.type || "audio/mpeg", 0, "uploaded");
      setState("stopped");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload audio.");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (state === "idle") {
    return (
      <div className="bg-white border border-sand rounded-2xl p-6 text-center">
        <button
          onClick={handleStart}
          className="w-20 h-20 rounded-full bg-accent text-white text-2xl flex items-center justify-center mx-auto shadow-card active:scale-95 transition-transform"
          aria-label="Start recording"
        >
          🎙
        </button>
        <p className="text-sm text-mist mt-4">Tell today&apos;s story — speak for a minute or five, in English, Hindi, or Hinglish.</p>
        <button
          className="text-sm text-clay mt-3 hover:text-accent"
          onClick={() => fileInputRef.current?.click()}
          disabled={saving}
        >
          or upload an existing recording
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
        {saving && <p className="text-sm text-mist mt-2">Saving…</p>}
        {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
      </div>
    );
  }

  if (state === "recording" || state === "paused") {
    return (
      <div className="bg-white border border-sand rounded-2xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {state === "recording" && <span className="w-2.5 h-2.5 rounded-full bg-red-600 recording-dot" />}
          <span className="text-2xl font-mono tabular-nums">{mm}:{ss}</span>
        </div>
        <p className="text-sm text-mist mb-5">{state === "recording" ? "Recording…" : "Paused"}</p>
        <div className="flex items-center justify-center gap-4">
          {state === "recording" ? (
            <button onClick={handlePause} className="w-14 h-14 rounded-full bg-sand text-ink text-xl flex items-center justify-center" aria-label="Pause">⏸</button>
          ) : (
            <button onClick={handleResume} className="w-14 h-14 rounded-full bg-sand text-ink text-xl flex items-center justify-center" aria-label="Resume">▶</button>
          )}
          <button onClick={handleStop} className="w-16 h-16 rounded-full bg-ink text-paper text-xl flex items-center justify-center" aria-label="Stop">⏹</button>
        </div>
      </div>
    );
  }

  // stopped — playback + actions
  return (
    <div className="bg-white border border-sand rounded-2xl p-5">
      {existingUrl && (
        <audio controls src={existingUrl} className="w-full mb-4" />
      )}
      {saving && <p className="text-sm text-mist mb-2">Saving…</p>}
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={handleStart} disabled={saving}>Re-record</Button>
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>Delete</Button>
      </div>
      {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
    </div>
  );
}
