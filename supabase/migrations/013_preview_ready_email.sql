-- LoreStudio: free preview ready notification email tracking

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS preview_notify_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_notification_email text,
  ADD COLUMN IF NOT EXISTS preview_ready_email_status text NOT NULL DEFAULT 'not_started'
    CHECK (preview_ready_email_status IN ('not_started', 'sending', 'sent', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS preview_ready_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS preview_ready_email_error text;

CREATE INDEX IF NOT EXISTS books_preview_ready_email_status_idx
  ON public.books (preview_ready_email_status);
