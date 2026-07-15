import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import type {
  MysteryContentItem,
  MysteryDailySchedule,
  MysteryHintType,
  MysteryPlayerSession,
  MysteryPlayerStreak,
  MysteryReviewStatus,
} from "@/lib/daily-mystery/types";

const CONTENT_TABLE = "mystery_content_items";
const SCHEDULE_TABLE = "mystery_daily_schedule";
const SESSION_TABLE = "mystery_player_sessions";
const STREAK_TABLE = "mystery_player_streaks";
const EMBEDDING_TABLE = "mystery_content_embeddings";
const GUESS_EMBEDDING_TABLE = "mystery_guess_embedding_cache";

function requireSupabase() {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }
  return client;
}

function mapContentRow(row: Record<string, unknown>): MysteryContentItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    locale: String(row.locale ?? "en_US"),
    target_type: row.target_type as MysteryContentItem["target_type"],
    canonical_title: String(row.canonical_title),
    protected_terms: (row.protected_terms as string[]) ?? [],
    accepted_solution_aliases: (row.accepted_solution_aliases as string[]) ?? [],
    source_text: String(row.source_text),
    source_url: String(row.source_url),
    source_domain: String(row.source_domain),
    source_type: row.source_type as MysteryContentItem["source_type"],
    source_hash: String(row.source_hash),
    riot_content_version: row.riot_content_version ? String(row.riot_content_version) : null,
    ddragon_version: row.ddragon_version ? String(row.ddragon_version) : null,
    difficulty: Number(row.difficulty ?? 3),
    region_tags: (row.region_tags as string[]) ?? [],
    related_champion_ids: (row.related_champion_ids as string[]) ?? [],
    hint_metadata: (row.hint_metadata as MysteryContentItem["hint_metadata"]) ?? {},
    review_status: row.review_status as MysteryReviewStatus,
    imported_at: String(row.imported_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    retired_at: row.retired_at ? String(row.retired_at) : null,
  };
}

function mapSessionRow(row: Record<string, unknown>): MysteryPlayerSession {
  return {
    id: String(row.id),
    player_id: String(row.player_id),
    puzzle_public_id: String(row.puzzle_public_id),
    mode: row.mode as MysteryPlayerSession["mode"],
    revealed_token_ids: (row.revealed_token_ids as string[]) ?? [],
    token_proximity: (row.token_proximity as MysteryPlayerSession["token_proximity"]) ?? {},
    hints_used: (row.hints_used as MysteryHintType[]) ?? [],
    guess_count: Number(row.guess_count ?? 0),
    started_at: String(row.started_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    completion_time_ms: row.completion_time_ms != null ? Number(row.completion_time_ms) : null,
    is_solved: Boolean(row.is_solved),
  };
}

export async function getApprovedContentItems() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(CONTENT_TABLE)
    .select("*")
    .eq("review_status", "approved")
    .order("canonical_title", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => mapContentRow(row));
}

export async function getContentItemById(id: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from(CONTENT_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapContentRow(data) : null;
}

export async function getContentItemBySlug(slug: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from(CONTENT_TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapContentRow(data) : null;
}

export async function upsertContentItem(item: Omit<MysteryContentItem, "id" | "imported_at" | "approved_at" | "retired_at"> & { id?: string }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(CONTENT_TABLE)
    .upsert(
      {
        ...item,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to upsert mystery content.");
  }

  return mapContentRow(data);
}

export async function getScheduleForDate(scheduleDate: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(SCHEDULE_TABLE)
    .select("*")
    .eq("schedule_date", scheduleDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    schedule_date: String(data.schedule_date),
    content_item_id: String(data.content_item_id),
    puzzle_public_id: String(data.puzzle_public_id),
    difficulty: Number(data.difficulty),
    admin_override: Boolean(data.admin_override),
    locked_at: String(data.locked_at),
  } satisfies MysteryDailySchedule;
}

export async function saveDailySchedule(schedule: {
  schedule_date: string;
  content_item_id: string;
  difficulty: number;
  admin_override?: boolean;
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(SCHEDULE_TABLE)
    .upsert(
      {
        schedule_date: schedule.schedule_date,
        content_item_id: schedule.content_item_id,
        difficulty: schedule.difficulty,
        admin_override: schedule.admin_override ?? false,
        locked_at: new Date().toISOString(),
      },
      { onConflict: "schedule_date" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save daily schedule.");
  }

  return {
    schedule_date: String(data.schedule_date),
    content_item_id: String(data.content_item_id),
    puzzle_public_id: String(data.puzzle_public_id),
    difficulty: Number(data.difficulty),
    admin_override: Boolean(data.admin_override),
    locked_at: String(data.locked_at),
  } satisfies MysteryDailySchedule;
}

export async function getScheduleByPublicId(puzzlePublicId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(SCHEDULE_TABLE)
    .select("*")
    .eq("puzzle_public_id", puzzlePublicId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    schedule_date: String(data.schedule_date),
    content_item_id: String(data.content_item_id),
    puzzle_public_id: String(data.puzzle_public_id),
    difficulty: Number(data.difficulty),
    admin_override: Boolean(data.admin_override),
    locked_at: String(data.locked_at),
  } satisfies MysteryDailySchedule;
}

export async function listArchiveContent({
  targetType,
  region,
  difficulty,
  limit = 40,
}: {
  targetType?: string;
  region?: string;
  difficulty?: number;
  limit?: number;
}) {
  const approved = await getApprovedContentItems();
  const today = getTodayScheduleDate();
  const todaysSchedule = await getScheduleForDate(today);

  return approved
    .filter((item) => item.id !== todaysSchedule?.content_item_id)
    .filter((item) => (targetType ? item.target_type === targetType : true))
    .filter((item) => (region ? item.region_tags.includes(region) : true))
    .filter((item) => (difficulty ? item.difficulty === difficulty : true))
    .slice(0, limit)
    .map((content) => ({
      slug: content.slug,
      puzzlePublicId: `archive-${content.slug}`,
      scheduleDate: content.approved_at?.slice(0, 10) || content.imported_at.slice(0, 10),
      canonicalTitle: content.canonical_title,
      targetType: content.target_type,
      difficulty: content.difficulty,
      regionTags: content.region_tags,
      content,
    }));
}

export async function getOrCreateSession(playerId: string, puzzlePublicId: string, mode: "daily" | "archive") {
  const supabase = requireSupabase();
  const { data: existing, error: existingError } = await supabase
    .from(SESSION_TABLE)
    .select("*")
    .eq("player_id", playerId)
    .eq("puzzle_public_id", puzzlePublicId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return mapSessionRow(existing);
  }

  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .insert({
      player_id: playerId,
      puzzle_public_id: puzzlePublicId,
      mode,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create mystery session.");
  }

  return mapSessionRow(data);
}

export async function updateSession(sessionId: string, patch: Partial<MysteryPlayerSession>) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update({
      revealed_token_ids: patch.revealed_token_ids,
      token_proximity: patch.token_proximity,
      hints_used: patch.hints_used,
      guess_count: patch.guess_count,
      completed_at: patch.completed_at,
      completion_time_ms: patch.completion_time_ms,
      is_solved: patch.is_solved,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update mystery session.");
  }

  return mapSessionRow(data);
}

export async function getPlayerStreak(playerId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from(STREAK_TABLE).select("*").eq("player_id", playerId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      player_id: playerId,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
    } satisfies MysteryPlayerStreak;
  }

  return {
    player_id: String(data.player_id),
    current_streak: Number(data.current_streak ?? 0),
    longest_streak: Number(data.longest_streak ?? 0),
    last_completed_date: data.last_completed_date ? String(data.last_completed_date) : null,
  };
}

export async function savePlayerStreak(streak: MysteryPlayerStreak) {
  const supabase = requireSupabase();
  const { error } = await supabase.from(STREAK_TABLE).upsert({
    player_id: streak.player_id,
    current_streak: streak.current_streak,
    longest_streak: streak.longest_streak,
    last_completed_date: streak.last_completed_date,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getContentEmbeddings(contentItemId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(EMBEDDING_TABLE)
    .select("normalized_lemma, embedding")
    .eq("content_item_id", contentItemId);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, number[]>();
  for (const row of data || []) {
    map.set(String(row.normalized_lemma), row.embedding as number[]);
  }
  return map;
}

export async function saveContentEmbeddings(contentItemId: string, embeddings: Record<string, number[]>) {
  const supabase = requireSupabase();
  const rows = Object.entries(embeddings).map(([lemma, embedding]) => ({
    content_item_id: contentItemId,
    normalized_lemma: lemma,
    embedding,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from(EMBEDDING_TABLE).upsert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCachedGuessEmbedding(normalizedGuess: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(GUESS_EMBEDDING_TABLE)
    .select("embedding")
    .eq("normalized_guess", normalizedGuess)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? (data.embedding as number[]) : null;
}

export async function saveCachedGuessEmbedding(normalizedGuess: string, embedding: number[]) {
  const supabase = requireSupabase();
  const { error } = await supabase.from(GUESS_EMBEDDING_TABLE).upsert({
    normalized_guess: normalizedGuess,
    embedding,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listRecentScheduleContentIds(days = 180) {
  const supabase = requireSupabase();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const { data, error } = await supabase
    .from(SCHEDULE_TABLE)
    .select("content_item_id, schedule_date")
    .gte("schedule_date", cutoff.toISOString().slice(0, 10));

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    content_item_id: String(row.content_item_id),
    schedule_date: String(row.schedule_date),
  }));
}
