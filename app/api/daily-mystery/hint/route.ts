import { NextResponse } from "next/server";
import { buildHintResponse, getNextHintType } from "@/lib/daily-mystery/hints";
import { getOrCreatePlayerId } from "@/lib/daily-mystery/player";
import { buildPublicPuzzleView, buildPuzzleFromContent } from "@/lib/daily-mystery/puzzle";
import { resolvePuzzleByPublicId } from "@/lib/daily-mystery/service";
import { getOrCreateSession, updateSession } from "@/lib/daily-mystery/store";
import { safeTrackServer } from "@/lib/safe-analytics-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HintBody = {
  puzzlePublicId?: string;
};

export async function POST(request: Request) {
  try {
    const playerId = await getOrCreatePlayerId();
    const body = (await request.json()) as HintBody;
    const puzzlePublicId = body.puzzlePublicId?.trim();
    if (!puzzlePublicId) {
      return NextResponse.json({ error: "Missing puzzle id." }, { status: 400 });
    }

    const { content, mode } = await resolvePuzzleByPublicId(puzzlePublicId);
    const session = await getOrCreateSession(playerId, puzzlePublicId, mode);
    if (session.is_solved) {
      return NextResponse.json({ error: "Chronicle already solved." }, { status: 400 });
    }

    const nextHint = getNextHintType(session.hints_used);
    if (!nextHint) {
      return NextResponse.json({ error: "No hints remain." }, { status: 400 });
    }

    const { tokens } = buildPuzzleFromContent(content);
    const revealed = new Set(session.revealed_token_ids);
    const hint = buildHintResponse({
      hintType: nextHint,
      content,
      tokens,
      revealed,
    });

    if ("revealedTokenIds" in hint && hint.revealedTokenIds) {
      for (const tokenId of hint.revealedTokenIds) {
        revealed.add(tokenId);
      }
    }

    const updated = await updateSession(session.id, {
      ...session,
      hints_used: [...session.hints_used, nextHint],
      revealed_token_ids: [...revealed],
    });

    safeTrackServer("mystery_hint_used", { mode, hintType: nextHint });

    const { publicTokens, paragraphTokenIds } = buildPublicPuzzleView(
      content,
      updated.revealed_token_ids,
      updated.token_proximity,
    );

    return NextResponse.json({
      ...hint,
      hintsUsed: updated.hints_used.length,
      tokens: publicTokens,
      paragraphTokenIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to provide hint.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
