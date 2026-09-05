"use client";

import { useRef, useState } from "react";
import type { Image as JournalImage, ImagePlacement } from "@/types";

interface Props {
  placement: ImagePlacement;
  image: JournalImage | null;
  imageUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  onCaptionChange: (caption: string) => Promise<void>;
}

export function ImagePlaceholderBlock({ placement, image, imageUrl, onUpload, onRemove, onCaptionChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState(image?.caption ?? "");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (image && imageUrl) {
    return (
      <figure className="my-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={placement.suggestion} className="w-full rounded-xl object-cover" />
        <div className="flex items-center justify-between mt-2 gap-3">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => onCaptionChange(caption)}
            placeholder="Add a caption (optional)"
            className="flex-1 text-sm text-mist bg-transparent border-b border-transparent focus:border-sand"
          />
          <div className="flex gap-3 shrink-0 text-xs">
            <button className="text-clay hover:text-accent" onClick={() => inputRef.current?.click()}>Replace</button>
            <button className="text-red-700 hover:text-red-800" onClick={onRemove}>Remove</button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={handleFile} />
      </figure>
    );
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="my-6 w-full border-2 border-dashed border-sand rounded-xl py-10 flex flex-col items-center gap-1.5 text-mist hover:border-clay/60 hover:text-clay transition-colors"
    >
      <span className="text-2xl">📷</span>
      <span className="text-sm font-medium">{uploading ? "Uploading…" : "Add photo"}</span>
      <span className="text-xs">Suggested: {placement.suggestion}</span>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={handleFile} />
    </button>
  );
}
