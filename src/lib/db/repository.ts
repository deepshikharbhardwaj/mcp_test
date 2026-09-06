import type {
  BlogDocument,
  BlogSectionContent,
  Day,
  DayStatus,
  Image,
  ISODate,
  JournalEvent,
  OutputLanguage,
  Recording,
  Transcript,
  Trip,
  TripSummary,
} from "@/types";
import { newId, inferTripEmoji } from "@/lib/utils/id";
import { addDays, todayISO } from "@/lib/utils/date";
import {
  STORES,
  blobDelete,
  blobGet,
  blobPut,
  dbDelete,
  dbGet,
  dbGetAll,
  dbGetAllByIndex,
  dbPut,
} from "./indexeddb";

/**
 * The storage-agnostic contract the rest of the app codes against.
 *
 * Today `IndexedDBRepository` is the only implementation, storing everything
 * (including photo/audio blobs) in the browser. A future `SupabaseRepository`
 * implementing this same interface — Postgres rows for the records below,
 * Supabase Storage for blobs — can be swapped in via `getRepository()`
 * without any UI or AI code changing.
 */
export interface JournalRepository {
  listTripSummaries(): Promise<TripSummary[]>;
  getTrip(tripId: string): Promise<Trip | undefined>;
  createTrip(input: { name: string; startDate: ISODate; endDate?: ISODate | null }): Promise<{ trip: Trip; firstDay: Day }>;
  updateTrip(tripId: string, patch: Partial<Pick<Trip, "name" | "startDate" | "endDate" | "isOpenEnded" | "emoji">>): Promise<Trip>;
  deleteTrip(tripId: string): Promise<void>;

  listDays(tripId: string): Promise<Day[]>;
  getDay(dayId: string): Promise<Day | undefined>;
  addDay(tripId: string, overrideDate?: ISODate): Promise<Day>;
  updateDay(dayId: string, patch: Partial<Pick<Day, "title" | "date" | "status">>): Promise<Day>;
  deleteDay(dayId: string): Promise<void>;

  saveRecording(dayId: string, blob: Blob, mimeType: string, durationSeconds: number | null, source: Recording["source"]): Promise<Recording>;
  getRecording(dayId: string): Promise<Recording | undefined>;
  getBlobUrl(blobKey: string): Promise<string>;
  deleteRecording(dayId: string): Promise<void>;

  saveTranscript(dayId: string, rawText: string, opts?: Partial<Pick<Transcript, "detectedLanguage" | "source" | "recordingId">>): Promise<Transcript>;
  getTranscript(dayId: string): Promise<Transcript | undefined>;

  saveEvents(dayId: string, events: JournalEvent[]): Promise<JournalEvent[]>;
  getEvents(dayId: string): Promise<JournalEvent[]>;

  saveBlog(dayId: string, blog: BlogDocument): Promise<BlogDocument>;
  getBlog(dayId: string): Promise<BlogDocument | undefined>;
  updateBlogTitle(dayId: string, language: OutputLanguage, title: string): Promise<BlogDocument>;
  updateBlogSection(
    dayId: string,
    language: OutputLanguage,
    sectionId: string,
    patch: Partial<Pick<BlogSectionContent, "heading" | "paragraphs">>
  ): Promise<BlogDocument>;
  reorderBlogSections(dayId: string, orderedSectionIds: string[]): Promise<BlogDocument>;

  saveImage(dayId: string, blob: Blob, mimeType: string, caption?: string | null): Promise<Image>;
  listImages(dayId: string): Promise<Image[]>;
  updateImage(imageId: string, patch: Partial<Pick<Image, "caption">>): Promise<Image>;
  deleteImage(imageId: string): Promise<void>;

  placeImage(dayId: string, sectionId: string, imageId: string): Promise<BlogDocument>;
  clearImagePlacement(dayId: string, sectionId: string): Promise<BlogDocument>;
}

function nowIso(): string {
  return new Date().toISOString();
}

const objectUrlCache = new Map<string, string>();

export class IndexedDBRepository implements JournalRepository {
  async listTripSummaries(): Promise<TripSummary[]> {
    const trips = await dbGetAll<Trip>(STORES.trips);
    const summaries: TripSummary[] = [];
    for (const trip of trips) {
      const days = await dbGetAllByIndex<Day>(STORES.days, "tripId", trip.id);
      const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
      let photoCount = 0;
      let coverImageUrl: string | null = null;
      for (const day of sortedDays) {
        const images = await dbGetAllByIndex<Image>(STORES.images, "dayId", day.id);
        photoCount += images.length;
        if (!coverImageUrl && images.length > 0) {
          const earliest = [...images].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]!;
          coverImageUrl = await this.getBlobUrl(earliest.blobKey);
        }
      }
      summaries.push({
        trip,
        dayCount: days.length,
        photoCount,
        lastUpdated: trip.updatedAt,
        coverImageUrl,
      });
    }
    summaries.sort((a, b) => (a.lastUpdated < b.lastUpdated ? 1 : -1));
    return summaries;
  }

  async getTrip(tripId: string): Promise<Trip | undefined> {
    return dbGet<Trip>(STORES.trips, tripId);
  }

  async createTrip(input: { name: string; startDate: ISODate; endDate?: ISODate | null }): Promise<{ trip: Trip; firstDay: Day }> {
    const ts = nowIso();
    const trip: Trip = {
      id: newId(),
      userId: "local-user",
      name: input.name.trim(),
      emoji: inferTripEmoji(input.name),
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      isOpenEnded: !input.endDate,
      createdAt: ts,
      updatedAt: ts,
    };
    await dbPut(STORES.trips, trip);

    const firstDay: Day = {
      id: newId(),
      tripId: trip.id,
      dayNumber: 1,
      date: trip.startDate,
      title: null,
      status: "not_started",
      createdAt: ts,
      updatedAt: ts,
    };
    await dbPut(STORES.days, firstDay);

    return { trip, firstDay };
  }

  async updateTrip(tripId: string, patch: Partial<Pick<Trip, "name" | "startDate" | "endDate" | "isOpenEnded" | "emoji">>): Promise<Trip> {
    const trip = await this.getTrip(tripId);
    if (!trip) throw new Error("Trip not found");
    const updated: Trip = { ...trip, ...patch, updatedAt: nowIso() };
    await dbPut(STORES.trips, updated);
    return updated;
  }

  async deleteTrip(tripId: string): Promise<void> {
    const days = await this.listDays(tripId);
    for (const day of days) {
      await this.deleteDay(day.id);
    }
    await dbDelete(STORES.trips, tripId);
  }

  async listDays(tripId: string): Promise<Day[]> {
    const days = await dbGetAllByIndex<Day>(STORES.days, "tripId", tripId);
    return days.sort((a, b) => a.dayNumber - b.dayNumber);
  }

  async getDay(dayId: string): Promise<Day | undefined> {
    return dbGet<Day>(STORES.days, dayId);
  }

  async addDay(tripId: string, overrideDate?: ISODate): Promise<Day> {
    const days = await this.listDays(tripId);
    const last = days[days.length - 1];
    const ts = nowIso();
    const date = overrideDate ?? (last ? addDays(last.date, 1) : todayISO());
    const day: Day = {
      id: newId(),
      tripId,
      dayNumber: (last?.dayNumber ?? 0) + 1,
      date,
      title: null,
      status: "not_started",
      createdAt: ts,
      updatedAt: ts,
    };
    await dbPut(STORES.days, day);
    await this.updateTrip(tripId, {});
    return day;
  }

  async updateDay(dayId: string, patch: Partial<Pick<Day, "title" | "date" | "status">>): Promise<Day> {
    const day = await this.getDay(dayId);
    if (!day) throw new Error("Day not found");
    const updated: Day = { ...day, ...patch, updatedAt: nowIso() };
    await dbPut(STORES.days, updated);
    await this.updateTrip(day.tripId, {});
    return updated;
  }

  async deleteDay(dayId: string): Promise<void> {
    const recording = await this.getRecording(dayId);
    if (recording) await this.deleteRecording(dayId);
    const images = await this.listImages(dayId);
    for (const img of images) await this.deleteImage(img.id);
    const events = await this.getEvents(dayId);
    for (const ev of events) await dbDelete(STORES.events, ev.id);
    const transcript = await this.getTranscript(dayId);
    if (transcript) await dbDelete(STORES.transcripts, transcript.id);
    const blog = await this.getBlog(dayId);
    if (blog) await dbDelete(STORES.blogs, blog.id);
    await dbDelete(STORES.days, dayId);
  }

  async saveRecording(dayId: string, blob: Blob, mimeType: string, durationSeconds: number | null, source: Recording["source"]): Promise<Recording> {
    const existing = await this.getRecording(dayId);
    if (existing) await this.deleteRecording(dayId);

    const blobKey = `recording:${newId()}`;
    await blobPut(blobKey, blob);
    const recording: Recording = {
      id: newId(),
      dayId,
      blobKey,
      mimeType,
      durationSeconds,
      source,
      createdAt: nowIso(),
    };
    await dbPut(STORES.recordings, recording);
    return recording;
  }

  async getRecording(dayId: string): Promise<Recording | undefined> {
    const list = await dbGetAllByIndex<Recording>(STORES.recordings, "dayId", dayId);
    return list[0];
  }

  async getBlobUrl(blobKey: string): Promise<string> {
    const cached = objectUrlCache.get(blobKey);
    if (cached) return cached;
    const blob = await blobGet(blobKey);
    if (!blob) throw new Error("Blob not found: " + blobKey);
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(blobKey, url);
    return url;
  }

  async deleteRecording(dayId: string): Promise<void> {
    const existing = await this.getRecording(dayId);
    if (!existing) return;
    await blobDelete(existing.blobKey);
    objectUrlCache.delete(existing.blobKey);
    await dbDelete(STORES.recordings, existing.id);
  }

  async saveTranscript(dayId: string, rawText: string, opts?: Partial<Pick<Transcript, "detectedLanguage" | "source" | "recordingId">>): Promise<Transcript> {
    const existing = await this.getTranscript(dayId);
    const ts = nowIso();
    const transcript: Transcript = {
      id: existing?.id ?? newId(),
      dayId,
      recordingId: opts?.recordingId ?? existing?.recordingId ?? null,
      rawText,
      detectedLanguage: opts?.detectedLanguage ?? existing?.detectedLanguage ?? "unknown",
      source: opts?.source ?? existing?.source ?? "manual",
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    await dbPut(STORES.transcripts, transcript);
    if (rawText.trim()) {
      const day = await this.getDay(dayId);
      if (day && day.status === "not_started") {
        await this.updateDay(dayId, { status: "draft" });
      }
    }
    return transcript;
  }

  async getTranscript(dayId: string): Promise<Transcript | undefined> {
    const list = await dbGetAllByIndex<Transcript>(STORES.transcripts, "dayId", dayId);
    return list[0];
  }

  async saveEvents(dayId: string, events: JournalEvent[]): Promise<JournalEvent[]> {
    const existing = await dbGetAllByIndex<JournalEvent>(STORES.events, "dayId", dayId);
    for (const ev of existing) await dbDelete(STORES.events, ev.id);
    for (const ev of events) await dbPut(STORES.events, ev);
    return events;
  }

  async getEvents(dayId: string): Promise<JournalEvent[]> {
    const list = await dbGetAllByIndex<JournalEvent>(STORES.events, "dayId", dayId);
    return list.sort((a, b) => a.sequence - b.sequence);
  }

  async saveBlog(dayId: string, blog: BlogDocument): Promise<BlogDocument> {
    const ts = nowIso();
    const existing = await this.getBlog(dayId);
    const toSave: BlogDocument = {
      ...blog,
      id: existing?.id ?? blog.id ?? newId(),
      dayId,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    await dbPut(STORES.blogs, toSave);
    const day = await this.getDay(dayId);
    if (day && (day.status === "draft" || day.status === "not_started")) {
      await this.updateDay(dayId, { status: "generated" });
    }
    return toSave;
  }

  async getBlog(dayId: string): Promise<BlogDocument | undefined> {
    const list = await dbGetAllByIndex<BlogDocument>(STORES.blogs, "dayId", dayId);
    return list[0];
  }

  async updateBlogTitle(dayId: string, language: OutputLanguage, title: string): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const variant = blog.variants[language];
    const variants = { ...blog.variants, [language]: { ...variant, title, titleUserEdited: true } };
    return this.saveBlog(dayId, { ...blog, variants });
  }

  async updateBlogSection(
    dayId: string,
    language: OutputLanguage,
    sectionId: string,
    patch: Partial<Pick<BlogSectionContent, "heading" | "paragraphs">>
  ): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const variant = blog.variants[language];
    const sections = variant.sections.map((s) =>
      s.id === sectionId ? { ...s, ...patch, userEdited: true } : s
    );
    const variants = { ...blog.variants, [language]: { ...variant, sections } };
    return this.saveBlog(dayId, { ...blog, variants });
  }

  async reorderBlogSections(dayId: string, orderedSectionIds: string[]): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const orderOf = new Map(orderedSectionIds.map((id, i) => [id, i]));

    const variants = { ...blog.variants };
    for (const lang of Object.keys(variants) as OutputLanguage[]) {
      const variant = variants[lang];
      const sections = [...variant.sections]
        .filter((s) => orderOf.has(s.id))
        .sort((a, b) => orderOf.get(a.id)! - orderOf.get(b.id)!)
        .map((s, i) => ({ ...s, order: i }));
      variants[lang] = { ...variant, sections };
    }

    return this.saveBlog(dayId, { ...blog, variants });
  }

  async saveImage(dayId: string, blob: Blob, mimeType: string, caption?: string | null): Promise<Image> {
    const blobKey = `image:${newId()}`;
    await blobPut(blobKey, blob);
    const dims = await readImageDimensions(blob).catch(() => null);
    const image: Image = {
      id: newId(),
      dayId,
      blobKey,
      mimeType,
      caption: caption ?? null,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      createdAt: nowIso(),
      placedInBlog: false,
    };
    await dbPut(STORES.images, image);
    return image;
  }

  async listImages(dayId: string): Promise<Image[]> {
    const list = await dbGetAllByIndex<Image>(STORES.images, "dayId", dayId);
    return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async updateImage(imageId: string, patch: Partial<Pick<Image, "caption">>): Promise<Image> {
    const image = await dbGet<Image>(STORES.images, imageId);
    if (!image) throw new Error("Image not found");
    const updated = { ...image, ...patch };
    await dbPut(STORES.images, updated);
    return updated;
  }

  async deleteImage(imageId: string): Promise<void> {
    const image = await dbGet<Image>(STORES.images, imageId);
    if (!image) return;
    await blobDelete(image.blobKey);
    objectUrlCache.delete(image.blobKey);
    await dbDelete(STORES.images, imageId);

    const blog = await this.getBlog(image.dayId);
    if (blog) {
      const imagePlacements = blog.imagePlacements.map((p) =>
        p.imageId === imageId ? { ...p, imageId: null } : p
      );
      await this.saveBlog(image.dayId, { ...blog, imagePlacements });
    }
  }

  async placeImage(dayId: string, sectionId: string, imageId: string): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const imagePlacements = blog.imagePlacements.map((p) =>
      p.sectionId === sectionId ? { ...p, imageId } : p
    );
    const image = await dbGet<Image>(STORES.images, imageId);
    if (image) await dbPut(STORES.images, { ...image, placedInBlog: true });
    return this.saveBlog(dayId, { ...blog, imagePlacements });
  }

  async clearImagePlacement(dayId: string, sectionId: string): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const removedImageId = blog.imagePlacements.find((p) => p.sectionId === sectionId)?.imageId;
    const imagePlacements = blog.imagePlacements.map((p) =>
      p.sectionId === sectionId ? { ...p, imageId: null } : p
    );
    if (removedImageId) {
      const image = await dbGet<Image>(STORES.images, removedImageId);
      if (image) await dbPut(STORES.images, { ...image, placedInBlog: false });
    }
    return this.saveBlog(dayId, { ...blog, imagePlacements });
  }
}

function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

let repositoryInstance: JournalRepository | null = null;

export function getRepository(): JournalRepository {
  if (!repositoryInstance) {
    repositoryInstance = new IndexedDBRepository();
  }
  return repositoryInstance;
}

export type { DayStatus };
