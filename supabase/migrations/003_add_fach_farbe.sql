-- Ergänzt die Spalte "farbe" auf public.faecher für die wählbare Fach-Akzentfarbe.
-- Nur ausführen, wenn public.faecher bereits ohne diese Spalte angelegt wurde
-- (bei einer frischen Installation über supabase/schema.sql ist sie schon enthalten).

alter table public.faecher
  add column if not exists farbe text default '#3D6B8E';
