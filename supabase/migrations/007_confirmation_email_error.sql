-- LoreStudio: store confirmation email failure reason

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS confirmation_email_error text;
