ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS payment_email_status text NOT NULL DEFAULT 'not_started'
    CHECK (payment_email_status IN ('not_started', 'sending', 'sent', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS payment_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_email_error text;

CREATE INDEX IF NOT EXISTS books_payment_email_status_idx
  ON public.books (payment_email_status);
