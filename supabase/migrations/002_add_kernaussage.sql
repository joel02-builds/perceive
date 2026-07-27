-- Ergänzt die Spalte "kernaussage" auf public.bloecke.
-- Nötig für api/generate-frage.js und api/bewerte-antwort.js, die pro Block
-- die gespeicherte Kernaussage als Kontext für die Active-Recall-Frage brauchen.
-- Nur ausführen, wenn public.bloecke bereits ohne diese Spalte angelegt wurde
-- (bei einer frischen Installation über supabase/schema.sql ist sie schon enthalten).

alter table public.bloecke
  add column if not exists kernaussage text;
