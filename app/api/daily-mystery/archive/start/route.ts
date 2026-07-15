import { NextResponse } from "next/server";
import { buildPuzzlePayload, resolveArchivePuzzle } from "@/lib/daily-mystery/service";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { safeTrackServer } from "@/lib/safe-analytics-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArchiveBody = {
  slug?: string;
};

export async function POST(request: Request) {
  try {
    const playerId = await getOrCreatePlayerId();
    const body = (await request.json()) as ArchiveBody;
    const slug = body.slug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "Missing archive slug." }, { status: 400 });
    }

    const { schedule, content, mode } = await resolveArchivePuzzle(slug);
    const payload = await buildPuzzlePayload({ playerId, schedule, content, mode });
    safeTrackServer("archive_puzzle_started", { slug });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open archive Chronicle.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
