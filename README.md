# My Travel Journal

A private, single-user, AI-assisted travel journal.

**The workflow:** you travel → at the end of the day you speak naturally for
1–5 minutes (English, Hindi, Hinglish, or mixed) → the app turns that into a
chronologically-organized, professional travel blog with photo placeholders
→ you upload your own photos and edit the text → the day is saved.

The AI never invents facts. It only organizes, translates, and improves the
wording of what you actually said. See [How AI processing works](#how-ai-processing-works).

This is explicitly **not** a multi-user SaaS product. It's built to feel
like a calm, private, premium journal for one person.

---

## 1. What exists today (V1 / Phase 1)

- Full UI/UX for the entire workflow: dashboard → create trip → auto-created
  Day 1 → `+ Add Day` (auto-dated) → day page (record/upload audio → transcript →
  generate → structured events → editable blog with image placeholders → day
  photo gallery) → Save.
- **Local-first persistence.** Everything (trips, days, transcripts, events,
  blog documents, photos, audio) is stored in the browser's IndexedDB via a
  single `JournalRepository` interface (`src/lib/db/repository.ts`). Nothing
  is lost on refresh. This is intentional: it lets the whole product be built
  and used today, before any backend account/credentials exist.
- **Real AI pipeline, provider-swappable.** If you set `GEMINI_API_KEY` or
  `ANTHROPIC_API_KEY`, event extraction and blog writing use a real model,
  following the strict anti-hallucination prompts in `src/prompts/`. With no
  key set, an offline mock provider runs instead (see
  [AI providers](#ai-providers)) so the whole app works with zero
  configuration.
- **All three languages generated together.** One "Generate Story" (or
  "Regenerate entire blog") produces English, Hindi, and Hinglish editions
  in the same pass — an English structural pass decides section count,
  headings, and photo slots, then Hindi/Hinglish are translated from that
  same structure in parallel (`src/prompts/translate-blog.ts`). The language
  toggle just switches which one you're looking at; it never calls the AI.
  Photo placements stay aligned across all three since they share the same
  underlying section ids. "Regenerate this section" only touches whichever
  language you're currently viewing.
- **Catchy, story-driven writing.** The generation prompt explicitly asks
  for magazine-style headlines (not restated location names) and a
  narrative throughline connecting events, rather than a flat "then this
  happened" recap — still bound by the same anti-hallucination rules.
  Hinglish specifically aims for a Gen-Z-cool, English-forward voice with
  natural Hindi seasoning, not a heavy 50/50 mix.
- **Speech-to-text noise correction.** Automatic speech recognition often
  mangles proper nouns (a city name transcribed as gibberish). The event
  extraction prompt is instructed to recognize an obviously-garbled but
  phonetically-close real place/name and correct it — flagged as an
  interpretation (`isAmbiguous: true`), never invented outright, and only
  when genuinely confident.
- Trip-level "Generate Complete Trip Story" across all days.
- Markdown + HTML export for a day's blog and for the trip story.
- Installable PWA (manifest + icons); mobile-first responsive layout.
- **Free, zero-config live speech-to-text** (`src/components/LiveTranscribe.tsx`,
  and built into the main record button via `AudioRecorder.tsx`) using the
  browser's built-in `SpeechRecognition` (Chrome/Edge). Recording the day's
  story transcribes live and auto-generates the blog the moment you stop —
  no API key, no server round trip for the transcription itself. Feature-
  detected and hides itself in unsupported browsers (Safari, Firefox),
  where typing/pasting the transcript still works exactly as before.
- **Editable everything**, with visible affordances (hover/focus highlight
  + a pencil icon) so it's obvious the title, headings, and paragraphs are
  live text fields, not static content.

### Not yet wired up (by design — see phased plan below)

- Supabase (auth / Postgres / Storage) — schema is ready in
  `supabase/migrations/0001_init.sql`, but the app currently uses IndexedDB.
- Server-side speech-to-text (e.g. Whisper) for higher accuracy than the
  browser's built-in recognizer, and for browsers that don't support it at all.
- GitHub archival/versioning of saved days.
- PDF/DOCX/EPUB export, full offline sync, section drag-reordering.

None of this blocks daily use. Everything above can be added behind the
existing `JournalRepository` / `AiProvider` interfaces without rewriting the
app.

---

## 2. Architecture

```
Audio ─▶ Speech-to-text ─▶ Raw transcript ─▶ Language detection
       ─▶ Event extraction (LLM #1) ─▶ Structured events (JSON)
       ─▶ Blog generation (LLM #2) ─▶ Sectioned blog + image suggestions
       ─▶ Editable blog (your edits are preserved, never overwritten by
          "regenerate section" on OTHER sections)
```

Every stage is stored separately and never destroyed:
`Recording → Transcript → JournalEvent[] → BlogDocument (AI) → BlogDocument (edited)`.
You can always get back to the original recording/transcript.

```
src/
  app/                    Next.js App Router pages + API routes
    trips/[tripId]/                  trip page
    trips/[tripId]/days/[dayId]/     the day page (core experience)
    trips/[tripId]/story/            trip-level story generation
    api/ai/...                       server-only AI route handlers
  components/             UI components (editorial, mobile-first)
  lib/
    db/                   IndexedDB wrapper + JournalRepository
    ai/                   AiProvider abstraction (mock + Anthropic)
    export.ts             Markdown/HTML export
    utils/                date + id helpers
  prompts/                every AI prompt, kept out of application code
  types/                  the entity model (mirrors the SQL schema)
supabase/migrations/      future Postgres schema + RLS (not yet connected)
scripts/generate-icons.mjs  regenerates the placeholder PWA icons
```

### Data model

`Trip → Day → { Recording, Transcript, JournalEvent[], BlogDocument →
BlogSection[] → ImagePlacement }`, plus a per-day `Image[]` gallery. See
`src/types/index.ts` for exact shapes — they mirror
`supabase/migrations/0001_init.sql` field-for-field on purpose, so migrating
storage later doesn't change any UI or AI code, only
`src/lib/db/repository.ts`.

### Why IndexedDB before Supabase

Phase 1's job (per the build plan) was a fully working, polished product
using local/mock data, without waiting on backend credentials. Rather than
literally mocking the UI with fake data, `IndexedDBRepository` is a real,
working persistence layer behind the same `JournalRepository` interface a
`SupabaseRepository` will later implement — so this isn't throwaway
scaffolding, it's the actual V1 storage engine for a single-device personal
journal. Binary blobs (audio, photos) live in an IndexedDB object store
today; they'll move to Supabase Storage later behind the same repository
calls.

---

## 3. How AI processing works

Per day, this runs: extract → generate (English) → translate (Hindi +
Hinglish, in parallel) — never one call asked to "just write a blog":

1. **Extract events** (`src/prompts/extract-events.ts`) — turns the raw
   transcript into strict JSON: `{ sequence, time, location, activity,
   details[], isAmbiguous }[]`. Rules baked into the prompt: never invent a
   time/location that wasn't said, preserve ambiguity instead of resolving
   it, don't merge or split events incorrectly. It's also told the
   transcript came from speech-to-text and may contain phonetically-garbled
   proper nouns — it may correct an obviously-mangled but confidently
   recognizable real place name, always flagging the correction as
   `isAmbiguous: true` rather than silently treating it as fact.
2. **Generate blog (English)** (`src/prompts/generate-blog.ts`) — takes ONLY
   the structured events (never the raw transcript) and writes a sectioned,
   editorial-quality blog with a catchy headline-style heading per section, a
   narrative throughline connecting events, and an image suggestion where a
   photo would make sense. This pass also fixes the section structure (count,
   order, photo slots) for the whole day. Same anti-hallucination rules
   apply, plus: no purple prose, no invented sensory detail, no generic AI
   travel clichés.
3. **Translate to Hindi and Hinglish** (`src/prompts/translate-blog.ts`),
   run in parallel — rewrites the same section structure into each
   language/voice rather than re-deciding it, which is what keeps photo
   placements aligned across all three editions with zero extra bookkeeping.
   Hindi aims for natural, everyday Devanagari; Hinglish for a Gen-Z-cool,
   English-forward voice seasoned with Hindi, not a stiff literal
   translation.

Switching the language toggle afterward is instant and free — all three
editions already exist, stored together in one `BlogDocument`
(`src/types/index.ts`: `variants.en / .hi / .hinglish`, sharing one
`imagePlacements` array keyed by section id).

"Regenerate this section" (`src/prompts/regenerate-section.ts`) rewrites one
section, in whichever language is currently active, in isolation — it never
touches the rest of the document, the other two languages, your other
edits, or your uploaded photos. "Generate Complete Trip Story"
(`src/prompts/generate-trip-story.ts`) composes already-finalized per-day
blogs (in whichever language each day is currently showing) into one longer
piece — it never sees raw transcripts, so it inherits the same factual
guarantees.

### AI providers

`src/lib/ai/types.ts` defines the `AiProvider` interface.
`src/lib/ai/index.ts` → `getAiProvider()` picks one, server-side only, in
this order:

1. **`GeminiAiProvider`** — used automatically if `GEMINI_API_KEY` is set.
   Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   Defaults to `gemini-3.6-flash`; override with `GEMINI_MODEL` if Google
   moves the goalposts again (they deprecate model names fairly often —
   check the error message, it names the current replacement directly).
2. **`AnthropicAiProvider`** — used if `ANTHROPIC_API_KEY` is set instead.
   Note this requires separate paid API credits at
   [console.anthropic.com](https://console.anthropic.com) — a Claude
   Pro/Max subscription does not cover API usage.
3. **`MockAiProvider`** (default, zero config) — offline heuristics: splits
   the transcript into clauses, detects times/locations with regex, groups
   events into sections. It does **not** translate Hindi/Hinglish into
   polished English — that genuinely needs a language model. It exists so
   the full pipeline is usable and demoable with no API key at all.

Only one key is needed — set whichever you have in `.env.local`. Every
provider is only ever instantiated server-side, inside Next.js route
handlers under `src/app/api/ai/`; keys never reach the browser.

To add another provider, implement `AiProvider` and add it to
`getAiProvider()`. Nothing above that layer needs to change.

---

## 4. Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required to use
the full app (mock AI + local storage). Add `ANTHROPIC_API_KEY` to
`.env.local` (copy from `.env.example`) to switch on real AI writing.

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
```

---

## 5. Environment variables

See `.env.example` for the full list with comments. Everything is optional
today:

| Variable | Used for | Required in V1? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Real event extraction + blog writing | No — falls back to offline mock |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Future Supabase auth/DB | No — not wired up yet |
| `SUPABASE_SERVICE_ROLE_KEY` | Future server-side Supabase access | No, and **never** expose this to the browser when it is added |
| `OPENAI_API_KEY` | Future real speech-to-text | No — manual transcript entry for now |
| `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` | Future GitHub archival | No |

Never commit `.env` or `.env.local`. `.gitignore` already excludes them.

---

## 6. Supabase setup (when you're ready to move off IndexedDB)

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` against it (Supabase SQL editor,
   or `supabase db push` with the CLI). It creates every table plus Row
   Level Security policies scoped to `auth.uid()`, so even though this is a
   single-user app, data is already isolated per account.
3. Create two private Storage buckets: `recordings` and `images`. Keep
   "Public" off for both.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`.
5. Implement `SupabaseRepository implements JournalRepository`
   (`src/lib/db/repository.ts`) alongside `IndexedDBRepository`, and switch
   `getRepository()` to return it. No component or AI code needs to change —
   they only ever call the `JournalRepository` interface.

## 7. AI provider setup

Add `ANTHROPIC_API_KEY` to `.env.local`. That's it — `getAiProvider()`
(`src/lib/ai/index.ts`) picks `AnthropicAiProvider` automatically whenever
the key is present, both for day-level generation and the trip story.

## 8. GitHub archival setup (future)

Not implemented yet. The intended design (per the product spec this app was
built from): a server-side export service that, on "Save & Archive to
GitHub", commits a Markdown/JSON snapshot of a day
(`Day-01-20-Nov/{journal.json, transcript.txt, blog.md, blog.html,
images-manifest.json}`) to a private repo using `GITHUB_TOKEN`. It should
never block the core save — if GitHub is unreachable, the local save still
succeeds and archival can be retried later. Photos/audio stay in object
storage, not Git.

## 9. Deployment

Designed for a no-server-to-run-forever setup:

- **Frontend + API routes:** any Next.js-compatible static/edge host
  (Cloudflare Pages, Vercel, etc.). The `/api/ai/*` route handlers run as
  serverless functions — no long-running process needed.
- **Database/Storage (once migrated off IndexedDB):** Supabase free tier.
- No Docker/Kubernetes — deliberately avoided for a personal project this size.

## 10. Database schema

See `supabase/migrations/0001_init.sql` (future) and `src/types/index.ts`
(current, source of truth for the app as it runs today). Entities: `Trip →
Day → {Recording, Transcript, JournalEvent[], BlogDocument → BlogSection[] →
ImagePlacement, Image[] gallery}`.

## 11. Backup strategy

Use the **Export Markdown / Export HTML** buttons on any generated day blog
or trip story (bottom of the article) to get a durable, app-independent copy
of your writing. A full trip export (transcripts + structured events +
photos + audio, not just the blog text) is planned — see §36 of the original
product spec kept in mind for this feature — and will be a straightforward
addition once Supabase Storage holds the binary files, since it's just
zipping what's already there per the same `JournalRepository` interface.
The underlying principle: **you should be able to read your travel memories
in ten years even if this app no longer exists**, so every export is plain
Markdown/HTML/JSON, never a proprietary format.

## 12. Security considerations

- No public trip URLs, no analytics, no indexing (`robots: noindex` is set
  in the root layout).
- `ANTHROPIC_API_KEY` (and, later, `SUPABASE_SERVICE_ROLE_KEY`,
  `GITHUB_TOKEN`) are read only in server-side route handlers
  (`src/app/api/**/route.ts`), never in a `"use client"` component, and
  never sent to the browser.
- All photo/audio blobs currently live in the browser's own IndexedDB — they
  never leave the device unless you explicitly export them.
- When Supabase is added, Row Level Security (already written into the
  migration) ensures every row is scoped to the owning user, and Storage
  buckets should stay private (no public read access).
