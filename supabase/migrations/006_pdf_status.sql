ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS pdf_status text NOT NULL DEFAULT 'not_started'
    CHECK (pdf_status IN ('not_started', 'waiting_for_images', 'generating', 'ready', 'failed'));

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;
