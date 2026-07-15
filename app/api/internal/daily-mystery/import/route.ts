import { NextResponse } from "next/server";
import { bootstrapMysteryProduction } from "@/lib/daily-mystery/bootstrap";
import { buildCoverageReport } from "@/lib/daily-mystery/importer/coverage";
import { ensureDailySchedule } from "@/lib/daily-mystery/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ImportBody = {
  action?: "seed" | "seed-verified" | "ddragon" | "schedule-today" | "coverage" | "bootstrap";
  limit?: number;
  autoApprove?: boolean;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  const secret = request.headers.get("x-internal-fulfillment-secret");
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody = {};
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    body = {};
  }

  try {
    if (body.action === "ddragon") {
      const report = await bootstrapMysteryProduction({
        seed: false,
        importChampions: body.limit,
        autoApproveChampions: body.autoApprove ?? false,
      });
      return NextResponse.json({ report: report.champions });
    }

    if (body.action === "schedule-today") {
      const schedule = await ensureDailySchedule();
      return NextResponse.json({ schedule });
    }

    if (body.action === "coverage") {
      const report = await buildCoverageReport();
      return NextResponse.json({ report });
    }

    if (body.action === "bootstrap") {
      const result = await bootstrapMysteryProduction({
        seed: true,
        importChampions: body.limit,
        autoApproveChampions: body.autoApprove ?? false,
      });
      const schedule = await ensureDailySchedule();
      return NextResponse.json({ result, schedule });
    }

    const result = await bootstrapMysteryProduction({ seed: true });
    const schedule = await ensureDailySchedule();
    return NextResponse.json({
      seed: result.seed,
      schedule,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
