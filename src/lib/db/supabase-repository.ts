import type {
  BlogDocument,
  BlogSectionContent,
  Day,
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
import { getSupabaseClient } from "@/lib/supabase/client";
import type { JournalRepository } from "./repository";

/**
 * Cloud-backed implementation of `JournalRepository`. Every method mirrors
 * `IndexedDBRepository` exactly (same interface), so nothing above this
 * layer — components, AI code, pages — needs to know or care which one is
 * active. Selection happens once in `getRepository()`.
 *
 * All reads/writes go through the browser Supabase client authenticated as
 * the signed-in user; Row Level Security (`supabase/migrations/0001_init.sql`)
 * is what actually enforces that a user can only ever see their own rows —
 * this code never uses a service-role key.
 */
export class SupabaseRepository implements JournalRepository {
  private get sb() {
    return getSupabaseClient();
  }

  private async userId(): Promise<string> {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error("Not signed in");
    return data.user.id;
  }

  // ---- trips ----------------------------------------------------------

  async listTripSummaries(): Promise<TripSummary[]> {
    const { data: trips, error } = await this.sb.from("trips").select("*").order("updated_at", { ascending: false });
    if (error) throw error;

    const summaries: TripSummary[] = [];
    for (const row of trips ?? []) {
      const trip = rowToTrip(row);
      const { data: days } = await this.sb
        .from("days")
        .select("id, day_number")
        .eq("trip_id", trip.id)
        .order("day_number", { ascending: true });
      const dayIds: string[] = (days ?? []).map((d: Row) => d.id as string);

      let photoCount = 0;
      let coverImageUrl: string | null = null;
      if (dayIds.length > 0) {
        const { data: images } = await this.sb
          .from("images")
          .select("day_id, storage_path, created_at")
          .in("day_id", dayIds)
          .order("created_at", { ascending: true });
        const imageRows: Row[] = images ?? [];
        photoCount = imageRows.length;
        if (imageRows.length > 0) {
          // earliest image belonging to the earliest day, matching the day order
          const orderOfDay = new Map<string, number>(dayIds.map((id, i) => [id, i]));
          const earliest = [...imageRows].sort((a: Row, b: Row) => {
            const dayDiff = (orderOfDay.get(a.day_id) ?? 0) - (orderOfDay.get(b.day_id) ?? 0);
            if (dayDiff !== 0) return dayDiff;
            return a.created_at < b.created_at ? -1 : 1;
          })[0]!;
          coverImageUrl = await this.getBlobUrl(earliest.storage_path);
        }
      }

      summaries.push({ trip, dayCount: dayIds.length, photoCount, lastUpdated: trip.updatedAt, coverImageUrl });
    }
    return summaries;
  }

  async getTrip(tripId: string): Promise<Trip | undefined> {
    const { data, error } = await this.sb.from("trips").select("*").eq("id", tripId).maybeSingle();
    if (error) throw error;
    return data ? rowToTrip(data) : undefined;
  }

  async createTrip(input: { name: string; startDate: ISODate; endDate?: ISODate | null }): Promise<{ trip: Trip; firstDay: Day }> {
    const userId = await this.userId();
    const { data: tripRow, error } = await this.sb
      .from("trips")
      .insert({
        user_id: userId,
        name: input.name.trim(),
        emoji: inferTripEmoji(input.name),
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        is_open_ended: !input.endDate,
      })
      .select()
      .single();
    if (error) throw error;
    const trip = rowToTrip(tripRow);

    const { data: dayRow, error: dayError } = await this.sb
      .from("days")
      .insert({ user_id: userId, trip_id: trip.id, day_number: 1, date: trip.startDate, status: "not_started" })
      .select()
      .single();
    if (dayError) throw dayError;

    return { trip, firstDay: rowToDay(dayRow) };
  }

  async updateTrip(tripId: string, patch: Partial<Pick<Trip, "name" | "startDate" | "endDate" | "isOpenEnded" | "emoji">>): Promise<Trip> {
    const { data, error } = await this.sb
      .from("trips")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
        ...(patch.endDate !== undefined ? { end_date: patch.endDate } : {}),
        ...(patch.isOpenEnded !== undefined ? { is_open_ended: patch.isOpenEnded } : {}),
        ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
      })
      .eq("id", tripId)
      .select()
      .single();
    if (error) throw error;
    return rowToTrip(data);
  }

  async deleteTrip(tripId: string): Promise<void> {
    const days = await this.listDays(tripId);
    for (const day of days) await this.deleteDay(day.id);
    const { error } = await this.sb.from("trips").delete().eq("id", tripId);
    if (error) throw error;
  }

  // ---- days -------------------------------------------------------------

  async listDays(tripId: string): Promise<Day[]> {
    const { data, error } = await this.sb.from("days").select("*").eq("trip_id", tripId).order("day_number", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToDay);
  }

  async getDay(dayId: string): Promise<Day | undefined> {
    const { data, error } = await this.sb.from("days").select("*").eq("id", dayId).maybeSingle();
    if (error) throw error;
    return data ? rowToDay(data) : undefined;
  }

  async addDay(tripId: string, overrideDate?: ISODate): Promise<Day> {
    const userId = await this.userId();
    const days = await this.listDays(tripId);
    const last = days[days.length - 1];
    const date = overrideDate ?? (last ? addDays(last.date, 1) : todayISO());
    const { data, error } = await this.sb
      .from("days")
      .insert({ user_id: userId, trip_id: tripId, day_number: (last?.dayNumber ?? 0) + 1, date, status: "not_started" })
      .select()
      .single();
    if (error) throw error;
    return rowToDay(data);
  }

  async updateDay(dayId: string, patch: Partial<Pick<Day, "title" | "date" | "status">>): Promise<Day> {
    const { data, error } = await this.sb
      .from("days")
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      })
      .eq("id", dayId)
      .select()
      .single();
    if (error) throw error;
    return rowToDay(data);
  }

  async deleteDay(dayId: string): Promise<void> {
    const images = await this.listImages(dayId);
    for (const img of images) await this.deleteImage(img.id);
    const recording = await this.getRecording(dayId);
    if (recording) await this.deleteRecording(dayId);
    const { error } = await this.sb.from("days").delete().eq("id", dayId);
    if (error) throw error;
  }

  // ---- recordings ---------------------------------------------------------

  async saveRecording(dayId: string, blob: Blob, mimeType: string, durationSeconds: number | null, source: Recording["source"]): Promise<Recording> {
    const existing = await this.getRecording(dayId);
    if (existing) await this.deleteRecording(dayId);

    const userId = await this.userId();
    const ext = extensionForMime(mimeType);
    const path = `${userId}/${dayId}/${newId()}.${ext}`;
    const { error: uploadError } = await this.sb.storage.from("recordings").upload(path, blob, { contentType: mimeType });
    if (uploadError) throw uploadError;

    const { data, error } = await this.sb
      .from("recordings")
      .insert({
        user_id: userId,
        day_id: dayId,
        storage_path: `recordings/${path}`,
        mime_type: mimeType,
        duration_seconds: durationSeconds,
        source,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToRecording(data);
  }

  async getRecording(dayId: string): Promise<Recording | undefined> {
    const { data, error } = await this.sb.from("recordings").select("*").eq("day_id", dayId).maybeSingle();
    if (error) throw error;
    return data ? rowToRecording(data) : undefined;
  }

  async getBlobUrl(blobKey: string): Promise<string> {
    const slash = blobKey.indexOf("/");
    const bucket = blobKey.slice(0, slash);
    const path = blobKey.slice(slash + 1);
    const { data, error } = await this.sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }

  async deleteRecording(dayId: string): Promise<void> {
    const existing = await this.getRecording(dayId);
    if (!existing) return;
    await this.removeBlob(existing.blobKey);
    const { error } = await this.sb.from("recordings").delete().eq("id", existing.id);
    if (error) throw error;
  }

  private async removeBlob(blobKey: string): Promise<void> {
    const slash = blobKey.indexOf("/");
    const bucket = blobKey.slice(0, slash);
    const path = blobKey.slice(slash + 1);
    await this.sb.storage.from(bucket).remove([path]);
  }

  // ---- transcripts --------------------------------------------------------

  async saveTranscript(dayId: string, rawText: string, opts?: Partial<Pick<Transcript, "detectedLanguage" | "source" | "recordingId">>): Promise<Transcript> {
    const userId = await this.userId();
    const existing = await this.getTranscript(dayId);
    const row = {
      user_id: userId,
      day_id: dayId,
      recording_id: opts?.recordingId ?? existing?.recordingId ?? null,
      raw_text: rawText,
      detected_language: opts?.detectedLanguage ?? existing?.detectedLanguage ?? "unknown",
      source: opts?.source ?? existing?.source ?? "manual",
    };
    const { data, error } = existing
      ? await this.sb.from("transcripts").update(row).eq("id", existing.id).select().single()
      : await this.sb.from("transcripts").insert(row).select().single();
    if (error) throw error;

    if (rawText.trim()) {
      const day = await this.getDay(dayId);
      if (day && day.status === "not_started") await this.updateDay(dayId, { status: "draft" });
    }
    return rowToTranscript(data);
  }

  async getTranscript(dayId: string): Promise<Transcript | undefined> {
    const { data, error } = await this.sb.from("transcripts").select("*").eq("day_id", dayId).maybeSingle();
    if (error) throw error;
    return data ? rowToTranscript(data) : undefined;
  }

  // ---- events ---------------------------------------------------------

  async saveEvents(dayId: string, events: JournalEvent[]): Promise<JournalEvent[]> {
    const userId = await this.userId();
    const { error: deleteError } = await this.sb.from("events").delete().eq("day_id", dayId);
    if (deleteError) throw deleteError;
    if (events.length === 0) return events;

    const rows = events.map((e) => ({
      id: e.id,
      user_id: userId,
      day_id: dayId,
      sequence: e.sequence,
      time: e.time,
      location: e.location,
      activity: e.activity,
      details: e.details,
      is_ambiguous: e.isAmbiguous,
    }));
    const { error } = await this.sb.from("events").insert(rows);
    if (error) throw error;
    return events;
  }

  async getEvents(dayId: string): Promise<JournalEvent[]> {
    const { data, error } = await this.sb.from("events").select("*").eq("day_id", dayId).order("sequence", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToEvent);
  }

  // ---- blog -------------------------------------------------------------

  async saveBlog(dayId: string, blog: BlogDocument): Promise<BlogDocument> {
    const userId = await this.userId();
    const existing = await this.getBlog(dayId);
    const row = {
      user_id: userId,
      day_id: dayId,
      style: blog.style,
      active_language: blog.activeLanguage,
      data: { variants: blog.variants, imagePlacements: blog.imagePlacements },
      version: (existing?.version ?? 0) + 1,
    };
    const { data, error } = existing
      ? await this.sb.from("blog_documents").update(row).eq("id", existing.id).select().single()
      : await this.sb.from("blog_documents").insert(row).select().single();
    if (error) throw error;

    const day = await this.getDay(dayId);
    if (day && (day.status === "draft" || day.status === "not_started")) {
      await this.updateDay(dayId, { status: "generated" });
    }
    return rowToBlog(data);
  }

  async getBlog(dayId: string): Promise<BlogDocument | undefined> {
    const { data, error } = await this.sb.from("blog_documents").select("*").eq("day_id", dayId).maybeSingle();
    if (error) throw error;
    return data ? rowToBlog(data) : undefined;
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
    const sections = variant.sections.map((s) => (s.id === sectionId ? { ...s, ...patch, userEdited: true } : s));
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

  // ---- images -----------------------------------------------------------

  async saveImage(dayId: string, blob: Blob, mimeType: string, caption?: string | null): Promise<Image> {
    const userId = await this.userId();
    const ext = extensionForMime(mimeType);
    const path = `${userId}/${dayId}/${newId()}.${ext}`;
    const { error: uploadError } = await this.sb.storage.from("images").upload(path, blob, { contentType: mimeType });
    if (uploadError) throw uploadError;

    const dims = await readImageDimensions(blob).catch(() => null);
    const { data, error } = await this.sb
      .from("images")
      .insert({
        user_id: userId,
        day_id: dayId,
        storage_path: `images/${path}`,
        mime_type: mimeType,
        caption: caption ?? null,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        placed_in_blog: false,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToImage(data);
  }

  async listImages(dayId: string): Promise<Image[]> {
    const { data, error } = await this.sb.from("images").select("*").eq("day_id", dayId).order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToImage);
  }

  async updateImage(imageId: string, patch: Partial<Pick<Image, "caption">>): Promise<Image> {
    const { data, error } = await this.sb.from("images").update({ caption: patch.caption }).eq("id", imageId).select().single();
    if (error) throw error;
    return rowToImage(data);
  }

  async deleteImage(imageId: string): Promise<void> {
    const { data: row, error: fetchError } = await this.sb.from("images").select("*").eq("id", imageId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return;
    const image = rowToImage(row);

    await this.removeBlob(image.blobKey);
    const { error } = await this.sb.from("images").delete().eq("id", imageId);
    if (error) throw error;

    const blog = await this.getBlog(image.dayId);
    if (blog) {
      const imagePlacements = blog.imagePlacements.map((p) => (p.imageId === imageId ? { ...p, imageId: null } : p));
      await this.saveBlog(image.dayId, { ...blog, imagePlacements });
    }
  }

  async placeImage(dayId: string, sectionId: string, imageId: string): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const imagePlacements = blog.imagePlacements.map((p) => (p.sectionId === sectionId ? { ...p, imageId } : p));
    await this.sb.from("images").update({ placed_in_blog: true }).eq("id", imageId);
    return this.saveBlog(dayId, { ...blog, imagePlacements });
  }

  async clearImagePlacement(dayId: string, sectionId: string): Promise<BlogDocument> {
    const blog = await this.getBlog(dayId);
    if (!blog) throw new Error("Blog not found");
    const removedImageId = blog.imagePlacements.find((p) => p.sectionId === sectionId)?.imageId;
    const imagePlacements = blog.imagePlacements.map((p) => (p.sectionId === sectionId ? { ...p, imageId: null } : p));
    if (removedImageId) {
      await this.sb.from("images").update({ placed_in_blog: false }).eq("id", removedImageId);
    }
    return this.saveBlog(dayId, { ...blog, imagePlacements });
  }
}

// ---- row <-> domain type mapping ------------------------------------------

type Row = Record<string, any>;

function rowToTrip(row: Row): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    startDate: row.start_date,
    endDate: row.end_date,
    isOpenEnded: row.is_open_ended,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDay(row: Row): Day {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayNumber: row.day_number,
    date: row.date,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRecording(row: Row): Recording {
  return {
    id: row.id,
    dayId: row.day_id,
    blobKey: row.storage_path,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    source: row.source,
    createdAt: row.created_at,
  };
}

function rowToTranscript(row: Row): Transcript {
  return {
    id: row.id,
    dayId: row.day_id,
    recordingId: row.recording_id,
    rawText: row.raw_text,
    detectedLanguage: row.detected_language,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: Row): JournalEvent {
  return {
    id: row.id,
    dayId: row.day_id,
    sequence: row.sequence,
    time: row.time,
    location: row.location,
    activity: row.activity,
    details: row.details ?? [],
    isAmbiguous: row.is_ambiguous,
  };
}

function rowToImage(row: Row): Image {
  return {
    id: row.id,
    dayId: row.day_id,
    blobKey: row.storage_path,
    mimeType: row.mime_type,
    caption: row.caption,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    placedInBlog: row.placed_in_blog,
  };
}

function rowToBlog(row: Row): BlogDocument {
  return {
    id: row.id,
    dayId: row.day_id,
    style: row.style,
    activeLanguage: row.active_language,
    variants: row.data.variants,
    imagePlacements: row.data.imagePlacements,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mimeType] ?? mimeType.split("/")[1] ?? "bin";
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
