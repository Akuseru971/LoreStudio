import "server-only";

import { getTodayScheduleDate } from "@/lib/daily-mystery/schedule-date";
import { getScheduleForDate, getMysteryContentDiagnostics } from "@/lib/daily-mystery/store";

export type MysteryDiagnosticsSnapshot = Awaited<ReturnType<typeof getMysteryContentDiagnostics>> & {
  todayScheduleDate: string;
  todayScheduled: boolean;
  databaseHost: string | null;
  runtimeEnvironment: string;
};

export async function collectMysteryDiagnostics(): Promise<MysteryDiagnosticsSnapshot> {
  const todayScheduleDate = getTodayScheduleDate();
  const todaySchedule = await getScheduleForDate(todayScheduleDate).catch(() => null);
  const content = await getMysteryContentDiagnostics();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  let databaseHost: string | null = null;
  if (supabaseUrl) {
    try {
      databaseHost = new URL(supabaseUrl).hostname;
    } catch {
      databaseHost = "invalid-url";
    }
  }

  return {
    ...content,
    todayScheduleDate,
    todayScheduled: Boolean(todaySchedule),
    databaseHost,
    runtimeEnvironment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
  };
}

export function logMysteryDiagnostics(snapshot: MysteryDiagnosticsSnapshot, context: string) {
  console.info("[MYSTERY_DIAGNOSTICS]", {
    context,
    runtimeEnvironment: snapshot.runtimeEnvironment,
    databaseHost: snapshot.databaseHost,
    totalContent: snapshot.totalContent,
    byStatus: snapshot.byStatus,
    byLocale: snapshot.byLocale,
    eligibleForScheduling: snapshot.eligibleForScheduling,
    todayScheduleDate: snapshot.todayScheduleDate,
    todayScheduled: snapshot.todayScheduled,
  });
}
