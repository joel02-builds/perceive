-- Perceive: Supabase Schema
-- Führe dieses Skript im Supabase SQL Editor aus (Projekt > SQL Editor > New query)

-- ============================================================
-- Tabellen
-- ============================================================

-- Fächer/Module
create table public.faecher (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  pruefungsdatum date,
  farbe text default '#3D6B8E',
  created_at timestamptz default now()
);

-- Lernblöcke (aus hochgeladenen Unterlagen)
create table public.bloecke (
  id uuid primary key default gen_random_uuid(),
  fach_id uuid not null references public.faecher(id) on delete cascade,
  titel text not null,
  inhalt text not null,
  kernaussage text,
  reihenfolge integer not null,
  schwierigkeit integer default 3,
  created_at timestamptz default now()
);

-- Lernfortschritt pro Block pro User
create table public.fortschritt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid not null references public.bloecke(id) on delete cascade,
  status text not null default 'neu', -- 'neu', 'gelernt', 'wiederholen', 'beherrscht'
  letzte_wiederholung timestamptz,
  naechste_wiederholung timestamptz,
  versuche integer default 0,
  created_at timestamptz default now(),
  unique(user_id, block_id)
);

-- Tägliche Lernplan-Einträge
create table public.lernplan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  block_id uuid references public.bloecke(id),
  erledigt boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Indizes
-- ============================================================

create index faecher_user_id_idx on public.faecher(user_id);
create index bloecke_fach_id_idx on public.bloecke(fach_id);
create index fortschritt_user_id_idx on public.fortschritt(user_id);
create index fortschritt_block_id_idx on public.fortschritt(block_id);
create index lernplan_user_id_datum_idx on public.lernplan(user_id, datum);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.faecher enable row level security;
alter table public.bloecke enable row level security;
alter table public.fortschritt enable row level security;
alter table public.lernplan enable row level security;

-- faecher: direkter user_id-Bezug
create policy "faecher_select_own" on public.faecher
  for select using (auth.uid() = user_id);

create policy "faecher_insert_own" on public.faecher
  for insert with check (auth.uid() = user_id);

create policy "faecher_update_own" on public.faecher
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "faecher_delete_own" on public.faecher
  for delete using (auth.uid() = user_id);

-- bloecke: kein eigener user_id, Zugriff über das übergeordnete Fach
create policy "bloecke_select_own" on public.bloecke
  for select using (
    exists (
      select 1 from public.faecher f
      where f.id = bloecke.fach_id and f.user_id = auth.uid()
    )
  );

create policy "bloecke_insert_own" on public.bloecke
  for insert with check (
    exists (
      select 1 from public.faecher f
      where f.id = bloecke.fach_id and f.user_id = auth.uid()
    )
  );

create policy "bloecke_update_own" on public.bloecke
  for update using (
    exists (
      select 1 from public.faecher f
      where f.id = bloecke.fach_id and f.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.faecher f
      where f.id = bloecke.fach_id and f.user_id = auth.uid()
    )
  );

create policy "bloecke_delete_own" on public.bloecke
  for delete using (
    exists (
      select 1 from public.faecher f
      where f.id = bloecke.fach_id and f.user_id = auth.uid()
    )
  );

-- fortschritt: direkter user_id-Bezug
create policy "fortschritt_select_own" on public.fortschritt
  for select using (auth.uid() = user_id);

create policy "fortschritt_insert_own" on public.fortschritt
  for insert with check (auth.uid() = user_id);

create policy "fortschritt_update_own" on public.fortschritt
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fortschritt_delete_own" on public.fortschritt
  for delete using (auth.uid() = user_id);

-- lernplan: direkter user_id-Bezug
create policy "lernplan_select_own" on public.lernplan
  for select using (auth.uid() = user_id);

create policy "lernplan_insert_own" on public.lernplan
  for insert with check (auth.uid() = user_id);

create policy "lernplan_update_own" on public.lernplan
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "lernplan_delete_own" on public.lernplan
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Storage: Bucket für PDF-Uploads
-- ============================================================

insert into storage.buckets (id, name, public)
values ('unterlagen', 'unterlagen', false)
on conflict (id) do nothing;

create policy "unterlagen_select_own" on storage.objects
  for select using (
    bucket_id = 'unterlagen' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "unterlagen_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'unterlagen' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "unterlagen_delete_own" on storage.objects
  for delete using (
    bucket_id = 'unterlagen' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Hinweis: Dateien sollten unter dem Pfad `<user_id>/<dateiname>` abgelegt werden,
-- damit obige Policies greifen (storage.foldername liest das erste Pfadsegment).
