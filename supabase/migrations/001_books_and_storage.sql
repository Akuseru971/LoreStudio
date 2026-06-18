-- LoreStudio: books table + PDF storage bucket
-- Run this entire script in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- 1. Books table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text UNIQUE NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'checkout_started', 'paid', 'generating', 'ready', 'failed')),
  form_input jsonb NOT NULL,
  free_book jsonb,
  full_book jsonb,
  free_pages jsonb,
  premium_pages jsonb,
  images jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_url text,
  pdf_storage_path text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_access_token_idx ON public.books (access_token);
CREATE INDEX IF NOT EXISTS books_stripe_session_id_idx ON public.books (stripe_session_id);
CREATE INDEX IF NOT EXISTS books_email_idx ON public.books (email);

CREATE OR REPLACE FUNCTION public.set_books_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_set_updated_at ON public.books;
CREATE TRIGGER books_set_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.set_books_updated_at();

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all access goes through the service role on the server.

-- ---------------------------------------------------------------------------
-- 2. Private PDF storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-pdfs',
  'book-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Storage policies (service role bypasses RLS; these guard direct client use)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role manages book PDFs" ON storage.objects;
CREATE POLICY "Service role manages book PDFs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'book-pdfs')
WITH CHECK (bucket_id = 'book-pdfs');

-- Optional: deny all direct access for anon/authenticated users on this bucket.
DROP POLICY IF EXISTS "No public PDF access" ON storage.objects;
CREATE POLICY "No public PDF access"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (false);
