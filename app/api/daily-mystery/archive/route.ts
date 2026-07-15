import { NextResponse } from "next/server";
import { listArchiveContent } from "@/lib/daily-mystery/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatArchiveLabel(targetType: string, scheduleDate: string) {
  const label = targetType.replace(/_/g, " ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} Chronicle · ${scheduleDate}`;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const targetType = params.get("targetType") || undefined;
    const region = params.get("region") || undefined;
    const difficulty = params.get("difficulty") ? Number(params.get("difficulty")) : undefined;

    const entries = await listArchiveContent({ targetType, region, difficulty, limit: 40 });

    return NextResponse.json({
      entries: entries.map((entry) => ({
        slug: entry.slug,
        puzzlePublicId: entry.puzzlePublicId,
        scheduleDate: entry.scheduleDate,
        displayLabel: formatArchiveLabel(entry.targetType, entry.scheduleDate),
        targetType: entry.targetType,
        difficulty: entry.difficulty,
        regionTags: entry.regionTags,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load archive.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
