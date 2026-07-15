import { NextResponse } from "next/server";
import { importChampionCatalog, importFromManualManifest } from "@/lib/daily-mystery/importer/ddragon";
import { buildCoverageReport } from "@/lib/daily-mystery/importer/coverage";
import { seedManifest } from "@/content/daily-mystery/seed-manifest";
import { ensureDailySchedule } from "@/lib/daily-mystery/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ImportBody = {
  action?: "seed" | "ddragon" | "schedule-today" | "coverage";
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
      const report = await importChampionCatalog({
        limit: body.limit,
        autoApprove: body.autoApprove ?? false,
      });
      return NextResponse.json({ report });
    }

    if (body.action === "schedule-today") {
      const schedule = await ensureDailySchedule();
      return NextResponse.json({ schedule });
    }

    if (body.action === "coverage") {
      const report = await buildCoverageReport();
      return NextResponse.json({ report });
    }

    const imported = await importFromManualManifest(seedManifest);
    const schedule = await ensureDailySchedule();
    return NextResponse.json({
      imported: imported.map((item) => ({ slug: item.slug, id: item.id, review_status: item.review_status })),
      schedule,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
