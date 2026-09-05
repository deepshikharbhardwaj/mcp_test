"use client";

import { useRef, useState } from "react";
import type { Image as JournalImage } from "@/types";

interface Props {
  images: JournalImage[];
  urls: Record<string, string>;
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
}

export function PhotoGallery({ images, urls, onUpload, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(files);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const gallery = images.filter((img) => !img.placedInBlog);

  return (
    <section className="mt-10">
      <p className="text-xs tracking-widest text-mist font-medium mb-3">MORE PHOTOS</p>
      {gallery.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {gallery.map((img) => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group bg-sand">
              {urls[img.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[img.id]} alt={img.caption ?? ""} className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => onDelete(img.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink/70 text-paper text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border border-sand rounded-xl py-3 text-sm text-clay hover:border-clay/60 hover:bg-white transition-colors"
      >
        {uploading ? "Uploading…" : "📷 Add more photos"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={handleFiles}
      />
    </section>
  );
}
