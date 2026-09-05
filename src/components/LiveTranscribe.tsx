"use client";

import { useEffect, useRef, useState } from "react";

// Minimal shape of the non-standard Web Speech API (webkitSpeechRecognition).
// No official TS lib types ship for this, so it's declared locally.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "en-US", label: "English (US)" },
];

interface Props {
  onAppend: (text: string) => void;
}

/**
 * Free, zero-config live speech-to-text using the browser's built-in
 * SpeechRecognition (Chrome/Edge only — feature-detected, hidden elsewhere).
 * Appends finalized phrases straight into the transcript as you speak.
 * This is a real STT path, distinct from the mock-vs-Anthropic AI writing
 * pipeline: it replaces "type the transcript" with "speak it", using
 * whatever language you pick below. Hinglish/code-switched speech works
 * best with "English" selected, since Chrome's en-IN model tolerates
 * Hindi words in the middle of English speech better than hi-IN tolerates
 * the reverse.
 */
export function LiveTranscribe({ onAppend }: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk.trim()) onAppend(finalChunk.trim());
      setInterim(interimChunk);
    };
    recognition.onerror = () => {
      setError("Microphone/recognition error — check mic permission and try again.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`text-xs px-3 py-2 rounded-full border transition-colors ${
          listening ? "bg-red-600 text-white border-red-600" : "bg-white text-clay border-sand hover:border-clay/60"
        }`}
      >
        {listening ? "⏹ Stop listening" : "🎤 Speak to transcribe"}
      </button>
      {!listening && (
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-xs bg-white border border-sand rounded-full px-2 py-2 text-mist"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      )}
      {listening && interim && <span className="text-xs text-mist italic truncate max-w-[16rem]">{interim}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
