"use client";

import { useEffect, useState } from "react";
import type { BlogLanguageVariant, BlogStyle, Image as JournalImage, ImagePlacement, OutputLanguage } from "@/types";
import { StyleSelector } from "./StyleSelector";
import { LanguageToggle } from "./LanguageToggle";
import { ImagePlaceholderBlock } from "./ImagePlaceholder";
import { Button } from "./Button";

interface Props {
  variant: BlogLanguageVariant;
  imagePlacements: ImagePlacement[];
  style: BlogStyle;
  activeLanguage: OutputLanguage;
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
  variant, imagePlacements, style, activeLanguage, images, imageUrls, regeneratingSectionId, regeneratingAll,
  onStyleChange, onLanguageChange, onTitleChange, onSectionTextChange, onRegenerateSection,
  onRegenerateAll, onImageUpload, onImageRemove, onCaptionChange,
}: Props) {
  const [title, setTitle] = useState(variant.title);
  useEffect(() => setTitle(variant.title), [variant.title]);

  const imageById = new Map(images.map((i) => [i.id, i]));
  const placementBySectionId = new Map(imagePlacements.map((p) => [p.sectionId, p]));

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
        <div className="flex flex-col gap-3">
          <StyleSelector value={style} onChange={onStyleChange} />
          <LanguageToggle value={activeLanguage} onChange={onLanguageChange} />
        </div>
        <Button variant="secondary" size="sm" onClick={onRegenerateAll} disabled={regeneratingAll}>
          {regeneratingAll ? "Regenerating…" : "↻ Regenerate entire blog"}
        </Button>
      </div>

      <article className="relative bg-white border border-sand rounded-2xl px-6 py-8 sm:px-10 sm:py-12 max-w-editorial mx-auto shadow-card overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent/70 via-clay/40 to-transparent" />
        <p className="text-[11px] tracking-wide text-mist mb-3">✏️ tap any text below to edit it</p>
        <EditableField
          as="input"
          value={title}
          onChange={setTitle}
          onCommit={() => onTitleChange(title)}
          className="w-full text-3xl font-serif font-semibold text-ink mb-8"
        />

        <div className="editorial-prose">
          {variant.sections.map((section) => (
            <SectionBlock
              key={section.id}
              heading={section.heading}
              paragraphs={section.paragraphs}
              userEdited={section.userEdited}
              regenerating={regeneratingSectionId === section.id}
              onTextChange={(heading, paragraphs) => onSectionTextChange(section.id, heading, paragraphs)}
              onRegenerate={() => onRegenerateSection(section.id)}
            >
              {placementBySectionId.get(section.id) && (
                <ImagePlaceholderBlock
                  placement={placementBySectionId.get(section.id)!}
                  image={
                    placementBySectionId.get(section.id)!.imageId
                      ? imageById.get(placementBySectionId.get(section.id)!.imageId!) ?? null
                      : null
                  }
                  imageUrl={
                    placementBySectionId.get(section.id)!.imageId
                      ? imageUrls[placementBySectionId.get(section.id)!.imageId!] ?? null
                      : null
                  }
                  onUpload={(file) => onImageUpload(section.id, file)}
                  onRemove={() => onImageRemove(section.id)}
                  onCaptionChange={(caption) => {
                    const imageId = placementBySectionId.get(section.id)?.imageId;
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

/** A text field with a visible pencil affordance and hover/focus ring, so it reads as editable rather than static text. */
function EditableField({
  as, value, onChange, onCommit, className, rows,
}: {
  as: "input" | "textarea";
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  className?: string;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  const shared =
    "bg-transparent border-none focus:ring-0 p-0 rounded-md -mx-2 px-2 transition-colors hover:bg-sand/30 focus:bg-sand/40";

  return (
    <div className="relative group/field">
      {as === "input" ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onCommit(); }}
          className={`${shared} ${className ?? ""}`}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onCommit(); }}
          rows={rows}
          className={`${shared} resize-none ${className ?? ""}`}
        />
      )}
      <span
        className={`pointer-events-none absolute -right-1 top-1 text-xs text-clay transition-opacity ${
          focused ? "opacity-0" : "opacity-0 group-hover/field:opacity-70"
        }`}
      >
        ✏️
      </span>
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
        <div className="flex-1 min-w-0">
          <EditableField
            as="input"
            value={localHeading}
            onChange={setLocalHeading}
            onCommit={commit}
            className="text-xl font-serif font-semibold text-ink w-full"
          />
        </div>
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
      <EditableField
        as="textarea"
        value={localBody}
        onChange={setLocalBody}
        onCommit={commit}
        rows={Math.max(3, localBody.split("\n").length)}
        className="w-full text-[16px] leading-8 text-ink"
      />
      {children}
    </section>
  );
}
