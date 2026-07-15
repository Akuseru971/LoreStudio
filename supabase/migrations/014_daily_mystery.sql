-- The Hidden Chronicle — daily mystery deduction game

CREATE TABLE IF NOT EXISTS public.mystery_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  locale text NOT NULL DEFAULT 'en_US',
  target_type text NOT NULL CHECK (
    target_type IN (
      'champion',
      'region',
      'place',
      'event',
      'faction',
      'artifact',
      'species',
      'legendary_npc',
      'other'
    )
  ),
  canonical_title text NOT NULL,
  protected_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_solution_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_text text NOT NULL,
  source_url text NOT NULL,
  source_domain text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('full_biography', 'official_blurb', 'official_page', 'manual_manifest')),
  source_hash text NOT NULL,
  riot_content_version text,
  ddragon_version text,
  difficulty smallint NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  region_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_champion_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  hint_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'needs_review', 'approved', 'retired')),
  imported_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mystery_content_items_review_status_idx
  ON public.mystery_content_items (review_status);

CREATE INDEX IF NOT EXISTS mystery_content_items_target_type_idx
  ON public.mystery_content_items (target_type);

CREATE TABLE IF NOT EXISTS public.mystery_content_embeddings (
  content_item_id uuid NOT NULL REFERENCES public.mystery_content_items (id) ON DELETE CASCADE,
  normalized_lemma text NOT NULL,
  embedding jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_item_id, normalized_lemma)
);

CREATE TABLE IF NOT EXISTS public.mystery_guess_embedding_cache (
  normalized_guess text PRIMARY KEY,
  embedding jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mystery_daily_schedule (
  schedule_date date PRIMARY KEY,
  content_item_id uuid NOT NULL REFERENCES public.mystery_content_items (id),
  puzzle_public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  difficulty smallint NOT NULL DEFAULT 3,
  admin_override boolean NOT NULL DEFAULT false,
  locked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mystery_daily_schedule_content_item_idx
  ON public.mystery_daily_schedule (content_item_id);

CREATE TABLE IF NOT EXISTS public.mystery_player_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  puzzle_public_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('daily', 'archive')),
  revealed_token_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_proximity jsonb NOT NULL DEFAULT '{}'::jsonb,
  hints_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  guess_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completion_time_ms integer,
  is_solved boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, puzzle_public_id)
);

CREATE INDEX IF NOT EXISTS mystery_player_sessions_player_idx
  ON public.mystery_player_sessions (player_id);

CREATE INDEX IF NOT EXISTS mystery_player_sessions_puzzle_idx
  ON public.mystery_player_sessions (puzzle_public_id);

CREATE TABLE IF NOT EXISTS public.mystery_player_streaks (
  player_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_completed_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mystery_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_guess_embedding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_daily_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_player_streaks ENABLE ROW LEVEL SECURITY;
