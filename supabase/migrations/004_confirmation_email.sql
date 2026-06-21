-- LoreStudio: payment confirmation email tracking

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_status text NOT NULL DEFAULT 'not_started'
    CHECK (confirmation_email_status IN ('not_started', 'sending', 'sent', 'failed', 'skipped'));
