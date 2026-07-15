-- Allow official champion biography pages from leagueoflegends.com

ALTER TABLE public.mystery_content_items
  DROP CONSTRAINT IF EXISTS mystery_content_items_source_type_check;

ALTER TABLE public.mystery_content_items
  ADD CONSTRAINT mystery_content_items_source_type_check
  CHECK (
    source_type IN (
      'full_biography',
      'official_blurb',
      'official_page',
      'manual_manifest',
      'official_champion_biography'
    )
  );
