-- LoreStudio: private storage bucket for book images and narration audio

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-assets',
  'book-assets',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/mp3']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role manages book assets" ON storage.objects;
CREATE POLICY "Service role manages book assets"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'book-assets')
WITH CHECK (bucket_id = 'book-assets');

DROP POLICY IF EXISTS "No public book asset access" ON storage.objects;
CREATE POLICY "No public book asset access"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'book-assets' AND false);
