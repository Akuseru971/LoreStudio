-- LoreStudio: store user-approved synopsis before full book generation

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS approved_synopsis jsonb;
