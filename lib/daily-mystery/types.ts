export type MysteryTargetType =
  | "champion"
  | "region"
  | "place"
  | "event"
  | "faction"
  | "artifact"
  | "species"
  | "legendary_npc"
  | "other";

export type MysteryReviewStatus = "draft" | "needs_review" | "approved" | "retired";

export type MysterySourceType =
  | "full_biography"
  | "official_blurb"
  | "official_page"
  | "manual_manifest"
  | "official_champion_biography";

export type MysteryProximityLevel = "close" | "warm" | "very_close" | null;

export type MysteryTokenType = "word" | "punctuation" | "whitespace";

export type MysteryHintType =
  | "category"
  | "region"
  | "period"
  | "reveal_word"
  | "multiple_choice";

export type MysteryContentItem = {
  id: string;
  slug: string;
  locale: string;
  target_type: MysteryTargetType;
  canonical_title: string;
  protected_terms: string[];
  accepted_solution_aliases: string[];
  source_text: string;
  source_url: string;
  source_domain: string;
  source_type: MysterySourceType;
  source_hash: string;
  riot_content_version: string | null;
  ddragon_version: string | null;
  difficulty: number;
  region_tags: string[];
  related_champion_ids: string[];
  hint_metadata: MysteryHintMetadata;
  review_status: MysteryReviewStatus;
  imported_at: string;
  approved_at: string | null;
  retired_at: string | null;
};

export type MysteryHintMetadata = {
  category_label?: string;
  region_label?: string;
  period_label?: string;
  multiple_choice_options?: string[];
  daily_mystery_ineligible?: boolean;
};

export type MysteryPuzzleToken = {
  id: string;
  type: MysteryTokenType;
  paragraphIndex: number;
  /** Visible text for punctuation / whitespace; omitted for hidden words pre-victory */
  text?: string;
  /** Original word text — server only */
  wordText?: string;
  normalized?: string;
  lemma?: string;
  isProtected: boolean;
  placeholderWidth?: number;
};

export type MysteryPublicToken = {
  id: string;
  type: MysteryTokenType;
  paragraphIndex: number;
  text?: string;
  placeholderWidth?: number;
  proximity?: MysteryProximityLevel;
  revealed?: boolean;
};

export type MysteryDailySchedule = {
  schedule_date: string;
  content_item_id: string;
  puzzle_public_id: string;
  difficulty: number;
  admin_override: boolean;
  locked_at: string;
};

export type MysteryPlayerSession = {
  id: string;
  player_id: string;
  puzzle_public_id: string;
  mode: "daily" | "archive";
  revealed_token_ids: string[];
  token_proximity: Record<string, MysteryProximityLevel>;
  hints_used: MysteryHintType[];
  guess_count: number;
  started_at: string;
  completed_at: string | null;
  completion_time_ms: number | null;
  is_solved: boolean;
};

export type MysteryPlayerStreak = {
  player_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
};

export const OFFICIAL_SOURCE_DOMAINS = [
  "ddragon.leagueoflegends.com",
  "universe.leagueoflegends.com",
  "leagueoflegends.com",
  "riotgames.com",
] as const;

export const CATEGORY_WEIGHTS: Record<MysteryTargetType, number> = {
  champion: 35,
  event: 15,
  region: 8,
  place: 7,
  faction: 10,
  artifact: 5,
  species: 5,
  legendary_npc: 5,
  other: 10,
};

export const SEMANTIC_THRESHOLDS = {
  very_close: Number(process.env.MYSTERY_SEMANTIC_VERY_CLOSE ?? 0.82),
  warm: Number(process.env.MYSTERY_SEMANTIC_WARM ?? 0.7),
  close: Number(process.env.MYSTERY_SEMANTIC_CLOSE ?? 0.58),
} as const;

export const MYSTERY_DAILY_TIMEZONE = process.env.MYSTERY_DAILY_TIMEZONE ?? "UTC";
export const MYSTERY_MIN_REPEAT_DAYS = Number(process.env.MYSTERY_MIN_REPEAT_DAYS ?? 180);
export const MYSTERY_MAX_GUESSES_PER_MINUTE = Number(process.env.MYSTERY_MAX_GUESSES_PER_MINUTE ?? 40);
