import { NextResponse } from "next/server";
import { generateSynopsis } from "@/lib/synopsisGeneration";
import { validateBookInput } from "@/lib/utils";

export const runtime = "nodejs";

type GenerateSynopsisBody = {
  name?: string;
  gender?: string;
  characterType?: string;
  runeterraRegion?: string;
  regenerationAttempt?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateSynopsisBody;
    const { input, error } = validateBookInput(body);

    if (!input) {
      return NextResponse.json({ error: error || "Invalid input." }, { status: 400 });
    }

    const regenerationAttempt = Number(body.regenerationAttempt);
    const attempt = Number.isInteger(regenerationAttempt) && regenerationAttempt > 0 ? regenerationAttempt : 0;

    const synopsis = await generateSynopsis(input, attempt);

    return NextResponse.json(synopsis);
  } catch (error) {
    console.error("[GENERATE_SYNOPSIS_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unable to generate synopsis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
