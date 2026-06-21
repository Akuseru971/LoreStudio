-- LoreStudio: PDF and MP3 status columns, error tracking, and indexes

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS pdf_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_error text,
  ADD COLUMN IF NOT EXISTS mp3_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS mp3_storage_path text,
  ADD COLUMN IF NOT EXISTS mp3_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp3_error text;

CREATE INDEX IF NOT EXISTS books_pdf_status_idx
  ON public.books (pdf_status);

CREATE INDEX IF NOT EXISTS books_mp3_status_idx
  ON public.books (mp3_status);
