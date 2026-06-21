-- LoreStudio: full narration MP3 storage + book audio bucket

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS mp3_storage_path text,
  ADD COLUMN IF NOT EXISTS mp3_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp3_status text NOT NULL DEFAULT 'not_started'
    CHECK (mp3_status IN ('not_started', 'generating', 'ready', 'failed'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-audio',
  'book-audio',
  false,
  104857600,
  ARRAY['audio/mpeg', 'audio/mp3']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role manages book audio" ON storage.objects;
CREATE POLICY "Service role manages book audio"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'book-audio')
WITH CHECK (bucket_id = 'book-audio');

DROP POLICY IF EXISTS "No public audio access" ON storage.objects;
CREATE POLICY "No public audio access"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (false);
