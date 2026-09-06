"use client";

import { useEffect, useState } from "react";
import type { BlogDocument, BlogStyle, Image as JournalImage, OutputLanguage } from "@/types";
import { StyleSelector } from "./StyleSelector";
import { LanguageToggle } from "./LanguageToggle";
import { ImagePlaceholderBlock } from "./ImagePlaceholder";
import { Button } from "./Button";

interface Props {
  blog: BlogDocument;
  style: BlogStyle;
  outputLanguage: OutputLanguage;
  images: JournalImage[];
  imageUrls: Record<string, string>;
  regeneratingSectionId: string | null;
  regeneratingAll: boolean;
  onStyleChange: (style: BlogStyle) => void;
  onLanguageChange: (language: OutputLanguage) => void;
  onTitleChange: (title: string) => Promise<void>;
  onSectionTextChange: (sectionId: string, heading: string, paragraphs: string[]) => Promise<void>;
  onRegenerateSection: (sectionId: string) => Promise<void>;
  onRegenerateAll: () => Promise<void>;
  onImageUpload: (sectionId: string, file: File) => Promise<void>;
  onImageRemove: (sectionId: string) => Promise<void>;
  onCaptionChange: (imageId: string, caption: string) => Promise<void>;
}

export function BlogEditor({
  blog, style, outputLanguage, images, imageUrls, regeneratingSectionId, regeneratingAll,
  onStyleChange, onLanguageChange, onTitleChange, onSectionTextChange, onRegenerateSection,
  onRegenerateAll, onImageUpload, onImageRemove, onCaptionChange,
}: Props) {
  const [title, setTitle] = useState(blog.title);
  useEffect(() => setTitle(blog.title), [blog.title]);

  const imageById = new Map(images.map((i) => [i.id, i]));

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
        <div className="flex flex-col gap-3">
          <StyleSelector value={style} onChange={onStyleChange} />
          <LanguageToggle value={outputLanguage} onChange={onLanguageChange} />
        </div>
        <Button variant="secondary" size="sm" onClick={onRegenerateAll} disabled={regeneratingAll}>
          {regeneratingAll ? "Regenerating…" : "↻ Regenerate entire blog"}
        </Button>
      </div>

      <article className="relative bg-white border border-sand rounded-2xl px-6 py-8 sm:px-10 sm:py-12 max-w-editorial mx-auto shadow-card overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent/70 via-clay/40 to-transparent" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onTitleChange(title)}
          className="w-full text-3xl font-serif font-semibold text-ink mb-8 bg-transparent border-none focus:ring-0 p-0"
        />

        <div className="editorial-prose">
          {blog.sections.map((section) => (
            <SectionBlock
              key={section.id}
              heading={section.heading}
              paragraphs={section.paragraphs}
              userEdited={section.userEdited}
              regenerating={regeneratingSectionId === section.id}
              onTextChange={(heading, paragraphs) => onSectionTextChange(section.id, heading, paragraphs)}
              onRegenerate={() => onRegenerateSection(section.id)}
            >
              {section.imagePlacement && (
                <ImagePlaceholderBlock
                  placement={section.imagePlacement}
                  image={section.imagePlacement.imageId ? imageById.get(section.imagePlacement.imageId) ?? null : null}
                  imageUrl={section.imagePlacement.imageId ? imageUrls[section.imagePlacement.imageId] ?? null : null}
                  onUpload={(file) => onImageUpload(section.id, file)}
                  onRemove={() => onImageRemove(section.id)}
                  onCaptionChange={(caption) => {
                    const imageId = section.imagePlacement?.imageId;
                    return imageId ? onCaptionChange(imageId, caption) : Promise.resolve();
                  }}
                />
              )}
            </SectionBlock>
          ))}
        </div>
      </article>
    </div>
  );
}

function SectionBlock({
  heading, paragraphs, userEdited, regenerating, onTextChange, onRegenerate, children,
}: {
  heading: string;
  paragraphs: string[];
  userEdited: boolean;
  regenerating: boolean;
  onTextChange: (heading: string, paragraphs: string[]) => Promise<void>;
  onRegenerate: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [localHeading, setLocalHeading] = useState(heading);
  const [localBody, setLocalBody] = useState(paragraphs.join("\n\n"));

  // Re-sync when the section changes underneath us (regenerate, style/language
  // switch) — otherwise this component (keyed by a stable section id) would
  // keep showing stale local text forever after an external update.
  useEffect(() => setLocalHeading(heading), [heading]);
  useEffect(() => setLocalBody(paragraphs.join("\n\n")), [paragraphs]);

  async function commit() {
    const nextParagraphs = localBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    await onTextChange(localHeading, nextParagraphs.length ? nextParagraphs : [""]);
  }

  return (
    <section className="mb-2 group">
      <div className="flex items-center justify-between gap-3 mt-8 mb-3">
        <input
          value={localHeading}
          onChange={(e) => setLocalHeading(e.target.value)}
          onBlur={commit}
          className="text-xl font-serif font-semibold text-ink bg-transparent border-none focus:ring-0 p-0 flex-1"
        />
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-xs text-mist opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-clay transition-opacity whitespace-nowrap"
          title="Regenerate this section"
        >
          {regenerating ? "…" : "↻ Regenerate"}
        </button>
      </div>
      {userEdited && <p className="text-[11px] text-mist mb-2 -mt-2">edited</p>}
      <textarea
        value={localBody}
        onChange={(e) => setLocalBody(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, localBody.split("\n").length)}
        className="w-full text-[16px] leading-8 text-ink bg-transparent border-none focus:ring-0 p-0 resize-none"
      />
      {children}
    </section>
  );
}
