-- LoreStudio: PDF finalized email tracking

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS pdf_ready_email_status text NOT NULL DEFAULT 'not_started'
    CHECK (pdf_ready_email_status IN ('not_started', 'sending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS pdf_ready_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_ready_email_error text;

CREATE INDEX IF NOT EXISTS books_pdf_ready_email_status_idx
  ON public.books (pdf_ready_email_status);
