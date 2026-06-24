ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_error text;
