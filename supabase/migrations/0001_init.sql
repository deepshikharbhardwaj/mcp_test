-- Travel Journal — initial schema.
--
-- Every table carries its own `user_id`, denormalized rather than requiring
-- a join up through trips → days for Row Level Security. For a personal,
-- single-account-per-user app this trades strict normalization for much
-- simpler (and faster) RLS policies and queries — a deliberate choice, not
-- an oversight.
--
-- The blog's nested content (three language variants, each with sections,
-- plus shared image placements) is stored as one `data jsonb` column on
-- `blog_documents` rather than four more relational tables — it mirrors
-- `BlogDocument` in src/types/index.ts field-for-field and is only ever
-- read/written as a whole document, so JSONB is the right fit, not a
-- shortcut.
--
-- Binary payloads (audio, photos) are NOT stored here — they live in
-- Supabase Storage buckets ("recordings", "images"), private by default,
-- with paths like {userId}/{dayId}/{uuid}.{ext}. See README "Supabase setup".

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
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  storage_path text not null, -- Supabase Storage object path, "recordings" bucket
  mime_type text not null,
  duration_seconds int,
  source text not null check (source in ('recorded', 'uploaded')),
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  sequence int not null,
  time text,
  location text,
  activity text not null,
  details jsonb not null default '[]',
  is_ambiguous boolean not null default false
);

create table images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  storage_path text not null, -- "images" bucket
  mime_type text not null,
  caption text,
  width int,
  height int,
  placed_in_blog boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per day. `data` holds { variants: {en,hi,hinglish}, imagePlacements }
-- exactly matching BlogDocument in src/types/index.ts.
create table blog_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade unique,
  style text not null default 'professional_travel'
    check (style in ('professional_travel', 'personal_warm', 'editorial', 'minimal')),
  active_language text not null default 'en'
    check (active_language in ('en', 'hi', 'hinglish')),
  data jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  format text not null check (format in ('markdown', 'html', 'pdf', 'docx', 'epub', 'archive_zip')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- indexes for the lookups the repository actually does ------------------

create index days_trip_id_idx on days(trip_id);
create index recordings_day_id_idx on recordings(day_id);
create index transcripts_day_id_idx on transcripts(day_id);
create index events_day_id_idx on events(day_id);
create index images_day_id_idx on images(day_id);

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
-- Single-user today, but every row is scoped to auth.uid() from day one, so
-- nothing needs to change if this ever supports more than one account.

alter table trips enable row level security;
alter table days enable row level security;
alter table recordings enable row level security;
alter table transcripts enable row level security;
alter table events enable row level security;
alter table images enable row level security;
alter table blog_documents enable row level security;
alter table exports enable row level security;

create policy "trips owned by user" on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "days owned by user" on days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recordings owned by user" on recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transcripts owned by user" on transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events owned by user" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "images owned by user" on images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blog_documents owned by user" on blog_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exports owned by user" on exports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage policies ---------------------------------------------------------
-- Object paths are expected to start with the owning user's id, e.g.
-- "{userId}/{dayId}/{uuid}.jpg" — these policies enforce that shape.

create policy "recordings bucket owned by user" on storage.objects
  for all using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "images bucket owned by user" on storage.objects
  for all using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
