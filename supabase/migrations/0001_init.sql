-- Travel Journal — initial schema.
--
-- NOT YET WIRED UP in V1 (the app currently persists to browser IndexedDB —
-- see src/lib/db/repository.ts). This migration exists so the future
-- SupabaseRepository implementation has a schema ready that mirrors
-- src/types/index.ts exactly, and so Row Level Security is designed in from
-- the start rather than bolted on later.
--
-- Binary payloads (audio, photos) are NOT stored here — they belong in
-- Supabase Storage buckets ("recordings", "images"), private by default,
-- with paths like trips/{tripId}/days/{dayId}/audio/... per the README.

create extension if not exists "pgcrypto";

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  start_date date not null,
  end_date date,
  is_open_ended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_number int not null,
  date date not null,
  title text,
  status text not null default 'not_started' check (status in ('not_started', 'draft', 'generated', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  storage_path text not null, -- Supabase Storage object path
  mime_type text not null,
  duration_seconds int,
  source text not null check (source in ('recorded', 'uploaded')),
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  recording_id uuid references recordings(id) on delete set null,
  raw_text text not null,
  detected_language text not null default 'unknown' check (detected_language in ('en', 'hi', 'hinglish', 'mixed', 'unknown')),
  source text not null default 'manual' check (source in ('stt', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  sequence int not null,
  time text,
  location text,
  activity text not null,
  details jsonb not null default '[]',
  is_ambiguous boolean not null default false
);

create table blog_documents (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  title text not null,
  style text not null default 'professional_travel'
    check (style in ('professional_travel', 'personal_warm', 'editorial', 'minimal')),
  output_language text not null default 'en'
    check (output_language in ('en', 'hi', 'hinglish')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blog_sections (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references blog_documents(id) on delete cascade,
  "order" int not null,
  heading text not null,
  paragraphs jsonb not null default '[]',
  user_edited boolean not null default false
);

create table images (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  caption text,
  width int,
  height int,
  placed_in_blog boolean not null default false,
  created_at timestamptz not null default now()
);

create table image_placements (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references blog_sections(id) on delete cascade,
  image_id uuid references images(id) on delete set null,
  suggestion text not null,
  caption text,
  unique (section_id)
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  format text not null check (format in ('markdown', 'html', 'pdf', 'docx', 'epub', 'archive_zip')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- updated_at maintenance -----------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_set_updated_at before update on trips
  for each row execute function set_updated_at();
create trigger days_set_updated_at before update on days
  for each row execute function set_updated_at();
create trigger transcripts_set_updated_at before update on transcripts
  for each row execute function set_updated_at();
create trigger blog_documents_set_updated_at before update on blog_documents
  for each row execute function set_updated_at();

-- Row Level Security ------------------------------------------------------
-- Single-user today, but modeled as proper per-row ownership from day one so
-- nothing needs to change if this ever supports more than one account.

alter table trips enable row level security;
alter table days enable row level security;
alter table recordings enable row level security;
alter table transcripts enable row level security;
alter table events enable row level security;
alter table blog_documents enable row level security;
alter table blog_sections enable row level security;
alter table images enable row level security;
alter table image_placements enable row level security;
alter table exports enable row level security;

create policy "trips owned by user" on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "days via owned trip" on days
  for all using (exists (select 1 from trips where trips.id = days.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = days.trip_id and trips.user_id = auth.uid()));

create policy "recordings via owned day" on recordings
  for all using (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = recordings.day_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = recordings.day_id and trips.user_id = auth.uid()));

create policy "transcripts via owned day" on transcripts
  for all using (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = transcripts.day_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = transcripts.day_id and trips.user_id = auth.uid()));

create policy "events via owned day" on events
  for all using (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = events.day_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = events.day_id and trips.user_id = auth.uid()));

create policy "blog_documents via owned day" on blog_documents
  for all using (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = blog_documents.day_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = blog_documents.day_id and trips.user_id = auth.uid()));

create policy "blog_sections via owned blog" on blog_sections
  for all using (exists (
    select 1 from blog_documents
    join days on days.id = blog_documents.day_id
    join trips on trips.id = days.trip_id
    where blog_documents.id = blog_sections.blog_id and trips.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from blog_documents
    join days on days.id = blog_documents.day_id
    join trips on trips.id = days.trip_id
    where blog_documents.id = blog_sections.blog_id and trips.user_id = auth.uid()
  ));

create policy "images via owned day" on images
  for all using (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = images.day_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from days join trips on trips.id = days.trip_id where days.id = images.day_id and trips.user_id = auth.uid()));

create policy "image_placements via owned section" on image_placements
  for all using (exists (
    select 1 from blog_sections
    join blog_documents on blog_documents.id = blog_sections.blog_id
    join days on days.id = blog_documents.day_id
    join trips on trips.id = days.trip_id
    where blog_sections.id = image_placements.section_id and trips.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from blog_sections
    join blog_documents on blog_documents.id = blog_sections.blog_id
    join days on days.id = blog_documents.day_id
    join trips on trips.id = days.trip_id
    where blog_sections.id = image_placements.section_id and trips.user_id = auth.uid()
  ));

create policy "exports via owned trip" on exports
  for all using (exists (select 1 from trips where trips.id = exports.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = exports.trip_id and trips.user_id = auth.uid()));
