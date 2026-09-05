"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getRepository } from "@/lib/db/repository";
import { processDayTranscript, regenerateSection as apiRegenerateSection } from "@/lib/ai/client";
import { buildBlogDocument } from "@/lib/ai/build-blog";
import { newId } from "@/lib/utils/id";
import { formatLongDate } from "@/lib/utils/date";
import type { BlogDocument, BlogStyle, Day, Image as JournalImage, JournalEvent, Trip } from "@/types";
import { AudioRecorder } from "@/components/AudioRecorder";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EventsList } from "@/components/EventsList";
import { BlogEditor } from "@/components/BlogEditor";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Button } from "@/components/Button";
import { dayBlogToHtml, dayBlogToMarkdown, downloadTextFile } from "@/lib/export";

export default function DayPage() {
  const { tripId, dayId } = useParams<{ tripId: string; dayId: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [blog, setBlog] = useState<BlogDocument | null>(null);
  const [style, setStyle] = useState<BlogStyle>("professional_travel");
  const [images, setImages] = useState<JournalImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);
  const transcriptRef = useRef("");

  async function refresh() {
    const repo = getRepository();
    const [t, d, recording, transcript, evs, blogDoc, imgs] = await Promise.all([
      repo.getTrip(tripId),
      repo.getDay(dayId),
      repo.getRecording(dayId),
      repo.getTranscript(dayId),
      repo.getEvents(dayId),
      repo.getBlog(dayId),
      repo.listImages(dayId),
    ]);
    setTrip(t ?? null);
    setDay(d ?? null);
    setRecordingUrl(recording ? await repo.getBlobUrl(recording.blobKey) : null);
    setTranscriptText(transcript?.rawText ?? "");
    transcriptRef.current = transcript?.rawText ?? "";
    setEvents(evs);
    setBlog(blogDoc ?? null);
    if (blogDoc) setStyle(blogDoc.style);
    setImages(imgs);
    const urls: Record<string, string> = {};
    for (const img of imgs) urls[img.id] = await repo.getBlobUrl(img.blobKey);
    setImageUrls(urls);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  async function handleRecordingReady(blob: Blob, mimeType: string, durationSeconds: number, source: "recorded" | "uploaded") {
    const repo = getRepository();
    const recording = await repo.saveRecording(dayId, blob, mimeType, durationSeconds, source);
    setRecordingUrl(await repo.getBlobUrl(recording.blobKey));
  }

  async function handleRecordingDelete() {
    await getRepository().deleteRecording(dayId);
    setRecordingUrl(null);
  }

  /** Live speech-to-text chunks from the main record button, appended as they arrive. */
  function handleTranscriptChunk(chunk: string) {
    const next = transcriptRef.current.trim() ? `${transcriptRef.current.trim()} ${chunk}` : chunk;
    transcriptRef.current = next;
    setTranscriptText(next);
    getRepository().saveTranscript(dayId, next, { source: "stt" });
  }

  /** Recording (and its live transcript) finished — go straight to the blog, matching "speak → story". */
  function handleRecordingFinished() {
    if (transcriptRef.current.trim()) {
      handleGenerate(transcriptRef.current);
    }
  }

  async function handleTranscriptSave(text: string) {
    transcriptRef.current = text;
    await getRepository().saveTranscript(dayId, text, { source: "manual" });
    const d = await getRepository().getDay(dayId);
    setDay(d ?? null);
  }

  async function handleGenerate(text: string) {
    if (!day || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await processDayTranscript(text, day.date, style);
      setProviderName(result.providerName);
      const repo = getRepository();

      const eventsWithIds: JournalEvent[] = result.events.map((e) => ({
        ...e,
        id: newId(),
        dayId,
      }));
      await repo.saveEvents(dayId, eventsWithIds);

      const blogDoc = buildBlogDocument(dayId, result.blog, style);
      const saved = await repo.saveBlog(dayId, blogDoc);

      await repo.saveTranscript(dayId, text, { detectedLanguage: result.detectedLanguage, source: "manual" });

      setEvents(eventsWithIds);
      setBlog(saved);
      const d = await repo.getDay(dayId);
      setDay(d ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story generation failed. Your transcript is safe — try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStyleChange(next: BlogStyle) {
    setStyle(next);
    if (blog) {
      const repo = getRepository();
      const saved = await repo.saveBlog(dayId, { ...blog, style: next });
      setBlog(saved);
    }
  }

  async function handleTitleChange(title: string) {
    if (!blog) return;
    const saved = await getRepository().saveBlog(dayId, { ...blog, title });
    setBlog(saved);
  }

  async function handleSectionTextChange(sectionId: string, heading: string, paragraphs: string[]) {
    const saved = await getRepository().updateBlogSection(dayId, sectionId, { heading, paragraphs });
    setBlog(saved);
  }

  async function handleRegenerateSection(sectionId: string) {
    if (!blog) return;
    const section = blog.sections.find((s) => s.id === sectionId);
    if (!section) return;
    setRegeneratingSectionId(sectionId);
    setError(null);
    try {
      const result = await apiRegenerateSection(events, style, section.heading, section.paragraphs);
      const repo = getRepository();
      const sections = blog.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              heading: result.heading,
              paragraphs: result.paragraphs,
              userEdited: false,
              imagePlacement: result.imageSuggestion
                ? s.imagePlacement
                  ? { ...s.imagePlacement, suggestion: result.imageSuggestion }
                  : { id: newId(), sectionId: s.id, imageId: null, suggestion: result.imageSuggestion, caption: null }
                : s.imagePlacement,
            }
          : s
      );
      const saved = await repo.saveBlog(dayId, { ...blog, sections });
      setBlog(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't regenerate that section — nothing was changed.");
    } finally {
      setRegeneratingSectionId(null);
    }
  }

  async function handleRegenerateAll() {
    if (!day || !transcriptText.trim()) return;
    setRegeneratingAll(true);
    setError(null);
    try {
      const result = await processDayTranscript(transcriptText, day.date, style);
      const blogDoc = buildBlogDocument(dayId, result.blog, style);
      const saved = await getRepository().saveBlog(dayId, blogDoc);
      setBlog(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't regenerate the blog — your previous version is untouched.");
    } finally {
      setRegeneratingAll(false);
    }
  }

  async function handleSectionImageUpload(sectionId: string, file: File) {
    const repo = getRepository();
    const image = await repo.saveImage(dayId, file, file.type || "image/jpeg");
    const saved = await repo.placeImage(dayId, sectionId, image.id);
    setBlog(saved);
    setImages(await repo.listImages(dayId));
    setImageUrls((prev) => ({ ...prev, [image.id]: "" })); // will be filled below
    const url = await repo.getBlobUrl(image.blobKey);
    setImageUrls((prev) => ({ ...prev, [image.id]: url }));
  }

  async function handleSectionImageRemove(sectionId: string) {
    const saved = await getRepository().clearImagePlacement(dayId, sectionId);
    setBlog(saved);
  }

  async function handleImageCaptionChange(imageId: string, caption: string) {
    const repo = getRepository();
    await repo.updateImage(imageId, { caption });
    setImages(await repo.listImages(dayId));
  }

  async function handleGalleryUpload(files: FileList) {
    const repo = getRepository();
    for (const file of Array.from(files)) {
      await repo.saveImage(dayId, file, file.type || "image/jpeg");
    }
    const imgs = await repo.listImages(dayId);
    setImages(imgs);
    const urls: Record<string, string> = {};
    for (const img of imgs) urls[img.id] = await repo.getBlobUrl(img.blobKey);
    setImageUrls(urls);
  }

  async function handleGalleryDelete(imageId: string) {
    const repo = getRepository();
    await repo.deleteImage(imageId);
    setImages(await repo.listImages(dayId));
    if (blog) setBlog(await repo.getBlog(dayId) ?? null);
  }

  async function handleSaveDay() {
    setSaving(true);
    try {
      const d = await getRepository().updateDay(dayId, { status: "final" });
      setDay(d);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="max-w-2xl mx-auto px-5 pt-10"><p className="text-mist text-sm">Loading day…</p></main>;
  }

  if (!day || !trip) {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-10">
        <p className="text-mist">Day not found.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 pt-8 pb-32 sm:pt-14">
      <Link href={`/trips/${tripId}`} className="text-sm text-mist hover:text-ink">← {trip.name}</Link>

      <header className="mt-4 mb-6">
        <p className="text-xs tracking-widest text-mist font-medium">DAY {day.dayNumber}</p>
        <h1 className="text-2xl font-serif font-semibold text-ink">{day.title ?? formatLongDate(day.date)}</h1>
        {day.title && <p className="text-sm text-mist">{formatLongDate(day.date)}</p>}
      </header>

      <div className="space-y-6">
        <AudioRecorder
          existingUrl={recordingUrl}
          onReady={handleRecordingReady}
          onDelete={handleRecordingDelete}
          onTranscriptChunk={handleTranscriptChunk}
          onRecordingFinished={handleRecordingFinished}
        />

        <TranscriptPanel
          initialText={transcriptText}
          onSave={handleTranscriptSave}
          onGenerate={handleGenerate}
          generating={generating}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <EventsList events={events} />

        {blog && (
          <>
            {providerName === "mock" && (
              <p className="text-xs text-mist text-center -mb-2">
                Mock AI is active — add ANTHROPIC_API_KEY for full professional writing.
              </p>
            )}
            <BlogEditor
              blog={blog}
              style={style}
              images={images}
              imageUrls={imageUrls}
              regeneratingSectionId={regeneratingSectionId}
              regeneratingAll={regeneratingAll}
              onStyleChange={handleStyleChange}
              onTitleChange={handleTitleChange}
              onSectionTextChange={handleSectionTextChange}
              onRegenerateSection={handleRegenerateSection}
              onRegenerateAll={handleRegenerateAll}
              onImageUpload={handleSectionImageUpload}
              onImageRemove={handleSectionImageRemove}
              onCaptionChange={handleImageCaptionChange}
            />
            <div className="flex justify-center gap-4 text-xs text-mist">
              <button className="hover:text-clay" onClick={() => downloadTextFile(`${day.dayNumber}-${day.date}.md`, dayBlogToMarkdown(blog), "text/markdown")}>
                Export Markdown
              </button>
              <button className="hover:text-clay" onClick={() => downloadTextFile(`${day.dayNumber}-${day.date}.html`, dayBlogToHtml(blog, trip.name), "text/html")}>
                Export HTML
              </button>
            </div>
          </>
        )}

        <PhotoGallery images={images} urls={imageUrls} onUpload={handleGalleryUpload} onDelete={handleGalleryDelete} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-paper/95 backdrop-blur border-t border-sand px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-mist">{savedFlash ? "Saved ✓" : " "}</span>
          <Button onClick={handleSaveDay} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</Button>
        </div>
      </div>
    </main>
  );
}
