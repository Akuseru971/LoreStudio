-- LoreStudio: per-page image generation status

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS image_status jsonb NOT NULL DEFAULT '{}'::jsonb;
