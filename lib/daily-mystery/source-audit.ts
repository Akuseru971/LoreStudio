import "server-only";

import {
  classifyDisallowedDailyMysterySource,
  isDailyMysterySchedulable,
} from "@/lib/daily-mystery/content-policy";
import { getContentItemById, getScheduleForDate } from "@/lib/daily-mystery/store";
import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import type { MysteryContentItem } from "@/lib/daily-mystery/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type DailyMysterySourceAuditReport = {
  totalRecords: number;
  validOfficialBiographies: number;
  ddragonRecords: number;
  universeRecords: number;
  thirdPartyRecords: number;
  nonEnglishRecords: number;
  nonChampionRecords: number;
  unsupportedRecords: number;
  explicitlyIneligibleRecords: number;
  currentlyScheduledInvalid: boolean;
  currentlyScheduledContentId: string | null;
  currentlyScheduledIssue: string | null;
};

function bucketRecord(
  tallies: Omit<DailyMysterySourceAuditReport, "currentlyScheduledInvalid" | "currentlyScheduledContentId" | "currentlyScheduledIssue">,
  item: MysteryContentItem,
) {
  if (item.hint_metadata?.daily_mystery_ineligible) {
    tallies.explicitlyIneligibleRecords += 1;
  }

  if (isDailyMysterySchedulable(item)) {
    tallies.validOfficialBiographies += 1;
    return;
  }

  const classification = classifyDisallowedDailyMysterySource(item);
  switch (classification) {
    case "ddragon":
      tallies.ddragonRecords += 1;
      break;
    case "universe":
      tallies.universeRecords += 1;
      break;
    case "third_party":
      tallies.thirdPartyRecords += 1;
      break;
    case "non_english":
      tallies.nonEnglishRecords += 1;
      break;
    case "non_champion":
      tallies.nonChampionRecords += 1;
      break;
    default:
      tallies.unsupportedRecords += 1;
      break;
  }
}

export async function auditDailyMysterySources(): Promise<DailyMysterySourceAuditReport> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.from("mystery_content_items").select("*");
  if (error) {
    throw new Error(error.message);
  }

  const tallies = {
    totalRecords: data?.length ?? 0,
    validOfficialBiographies: 0,
    ddragonRecords: 0,
    universeRecords: 0,
    thirdPartyRecords: 0,
    nonEnglishRecords: 0,
    nonChampionRecords: 0,
    unsupportedRecords: 0,
    explicitlyIneligibleRecords: 0,
  };

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    locale: String(row.locale ?? "en_US"),
    target_type: row.target_type,
    canonical_title: String(row.canonical_title),
    protected_terms: (row.protected_terms as string[]) ?? [],
    accepted_solution_aliases: (row.accepted_solution_aliases as string[]) ?? [],
    source_text: String(row.source_text),
    source_url: String(row.source_url),
    source_domain: String(row.source_domain),
    source_type: row.source_type,
    source_hash: String(row.source_hash),
    riot_content_version: row.riot_content_version ? String(row.riot_content_version) : null,
    ddragon_version: row.ddragon_version ? String(row.ddragon_version) : null,
    difficulty: Number(row.difficulty ?? 3),
    region_tags: (row.region_tags as string[]) ?? [],
    related_champion_ids: (row.related_champion_ids as string[]) ?? [],
    hint_metadata: (row.hint_metadata as MysteryContentItem["hint_metadata"]) ?? {},
    review_status: row.review_status,
    imported_at: String(row.imported_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    retired_at: row.retired_at ? String(row.retired_at) : null,
  })) as MysteryContentItem[];

  for (const item of rows) {
    bucketRecord(tallies, item);
  }

  const today = getTodayScheduleDate();
  const schedule = await getScheduleForDate(today);
  let currentlyScheduledInvalid = false;
  let currentlyScheduledContentId: string | null = null;
  let currentlyScheduledIssue: string | null = null;

  if (schedule) {
    currentlyScheduledContentId = schedule.content_item_id;
    const scheduledContent = await getContentItemById(schedule.content_item_id);
    if (!scheduledContent || !isDailyMysterySchedulable(scheduledContent)) {
      currentlyScheduledInvalid = true;
      currentlyScheduledIssue = scheduledContent
        ? classifyDisallowedDailyMysterySource(scheduledContent) ?? "unsupported_source"
        : "missing_content";
    }
  }

  return {
    ...tallies,
    currentlyScheduledInvalid,
    currentlyScheduledContentId,
    currentlyScheduledIssue,
  };
}

export async function cleanDailyMysterySources() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const audit = await auditDailyMysterySources();
  const { data, error } = await supabase.from("mystery_content_items").select("id, target_type, source_type, source_url, locale, hint_metadata");
  if (error) {
    throw new Error(error.message);
  }

  let markedIneligible = 0;
  for (const row of data ?? []) {
    const item = {
      target_type: row.target_type,
      source_type: row.source_type,
      source_url: String(row.source_url),
      locale: String(row.locale ?? "en_US"),
      hint_metadata: (row.hint_metadata as MysteryContentItem["hint_metadata"]) ?? {},
    } as Pick<MysteryContentItem, "target_type" | "source_type" | "source_url" | "locale" | "hint_metadata">;

    if (classifyDisallowedDailyMysterySource(item)) {
      const nextMetadata = {
        ...item.hint_metadata,
        daily_mystery_ineligible: true,
      };
      const { error: updateError } = await supabase
        .from("mystery_content_items")
        .update({
          hint_metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!updateError) {
        markedIneligible += 1;
      }
    }
  }

  return {
    audit,
    markedIneligible,
  };
}
