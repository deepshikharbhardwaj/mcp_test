/**
 * Core data model.
 *
 * This mirrors the relational schema in `supabase/migrations/0001_init.sql`
 * on purpose: today these records live in the browser's IndexedDB (see
 * `src/lib/db`), but the shapes are the same ones a future Supabase-backed
 * `JournalRepository` implementation would return, so swapping storage
 * layers later never means rewriting UI or AI code.
 */

export type ISODate = string; // "2026-11-20"
export type ISODateTime = string; // full ISO timestamp

export type DayStatus = "not_started" | "draft" | "generated" | "final";

export interface Trip {
  id: string;
  userId: string;
  name: string;
  emoji: string | null;
  startDate: ISODate;
  endDate: ISODate | null;
  isOpenEnded: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Day {
  id: string;
  tripId: string;
  dayNumber: number;
  date: ISODate;
  title: string | null;
  status: DayStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Recording {
  id: string;
  dayId: string;
  blobKey: string; // key into the blob store (IndexedDB today, object storage later)
  mimeType: string;
  durationSeconds: number | null;
  source: "recorded" | "uploaded";
  createdAt: ISODateTime;
}

export interface Transcript {
  id: string;
  dayId: string;
  recordingId: string | null;
  rawText: string;
  detectedLanguage: "en" | "hi" | "hinglish" | "mixed" | "unknown";
  source: "stt" | "manual";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface JournalEvent {
  id: string;
  dayId: string;
  sequence: number;
  time: string | null; // "11:00" free-form as spoken, not necessarily normalized
  location: string | null;
  activity: string;
  details: string[];
  isAmbiguous: boolean; // AI flagged this as an interpretation, not a stated fact
}

export type BlogStyle =
  | "professional_travel"
  | "personal_warm"
  | "editorial"
  | "minimal";

/** Output language for the generated blog text — independent of the language the transcript was spoken in. */
export type OutputLanguage = "en" | "hi" | "hinglish";

/**
 * An image placement is a language-independent "slot" in the blog — the
 * same slot (and the same uploaded photo, once placed) applies no matter
 * which of the three language variants is being viewed. `sectionId` matches
 * the `id` on the corresponding `BlogSectionContent` in every variant, since
 * all three variants share the same section structure by construction (see
 * `translate-blog.ts`).
 */
export interface ImagePlacement {
  id: string;
  sectionId: string;
  imageId: string | null; // null until the user uploads a photo here
  suggestion: string; // AI's short label, e.g. "Delhi Airport" — always English, it's an internal search label
  caption: string | null;
}

/** The text content of one section, in one language. */
export interface BlogSectionContent {
  id: string; // shared across all three variants — this is the slot ImagePlacement.sectionId points to
  order: number;
  heading: string;
  paragraphs: string[];
  userEdited: boolean; // true once the user has hand-edited this section, in this language
}

export interface BlogLanguageVariant {
  title: string;
  sections: BlogSectionContent[];
  titleUserEdited: boolean;
}

export interface BlogDocument {
  id: string;
  dayId: string;
  style: BlogStyle;
  /** Which language is currently being viewed/edited — purely a display preference, all three always exist together. */
  activeLanguage: OutputLanguage;
  variants: Record<OutputLanguage, BlogLanguageVariant>;
  imagePlacements: ImagePlacement[];
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Image {
  id: string;
  dayId: string;
  blobKey: string;
  mimeType: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: ISODateTime;
  /** true if placed into a blog section rather than only living in the day gallery */
  placedInBlog: boolean;
}

export interface TripSummary {
  trip: Trip;
  dayCount: number;
  photoCount: number;
  lastUpdated: ISODateTime;
  /** Blob URL of the earliest uploaded photo in the trip, for the dashboard card backdrop. */
  coverImageUrl: string | null;
}
