ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS assets_ready_at timestamptz;
