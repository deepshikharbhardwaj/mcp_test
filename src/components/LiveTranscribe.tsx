"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionCtor,
  SPEECH_LANGUAGES,
  type SpeechRecognitionLike,
} from "@/lib/speech";

interface Props {
  onAppend: (text: string) => void;
}

/**
 * Standalone "dictate without recording audio" option — free, zero-config,
 * browser-only speech-to-text (Chrome/Edge). The main "Tell today's story"
 * button (AudioRecorder) now does this automatically alongside recording;
 * this stays as a fallback for when someone just wants to add a line of
 * text by voice without starting a recording.
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
        {listening ? "⏹ Stop listening" : "🎤 Or dictate a line here"}
      </button>
      {!listening && (
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-xs bg-white border border-sand rounded-full px-2 py-2 text-mist"
        >
          {SPEECH_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      )}
      {listening && interim && <span className="text-xs text-mist italic truncate max-w-[16rem]">{interim}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
