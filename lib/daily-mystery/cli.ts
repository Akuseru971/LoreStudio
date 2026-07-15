import { auditDailyMysterySources, cleanDailyMysterySources } from "@/lib/daily-mystery/source-audit";
import { bootstrapMysteryProduction, importVerifiedSeedManifest } from "@/lib/daily-mystery/bootstrap";
import { collectMysteryDiagnostics, logMysteryDiagnostics } from "@/lib/daily-mystery/diagnostics";
import { buildCoverageReport } from "@/lib/daily-mystery/importer/coverage";
import { ensureDailySchedule } from "@/lib/daily-mystery/schedule";

export async function runMysteryCli(command: string | undefined) {
  switch (command) {
    case "seed:verified": {
      const report = await importVerifiedSeedManifest();
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "import:champions": {
      const limit = Number(process.env.MYSTERY_IMPORT_LIMIT ?? "0") || undefined;
      const autoApprove = process.env.MYSTERY_AUTO_APPROVE === "true";
      const result = await bootstrapMysteryProduction({ seed: false, importChampions: limit, autoApproveChampions: autoApprove });
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    case "schedule:today": {
      const schedule = await ensureDailySchedule();
      console.log(JSON.stringify({ command, schedule }, null, 2));
      return;
    }
    case "coverage": {
      const report = await buildCoverageReport();
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "bootstrap": {
      const result = await bootstrapMysteryProduction({
        seed: true,
        importChampions: Number(process.env.MYSTERY_IMPORT_LIMIT ?? "0") || undefined,
        autoApproveChampions: process.env.MYSTERY_AUTO_APPROVE === "true",
      });
      const schedule = await ensureDailySchedule();
      console.log(JSON.stringify({ command, result, schedule }, null, 2));
      return;
    }
    case "diagnostics": {
      const diagnostics = await collectMysteryDiagnostics();
      logMysteryDiagnostics(diagnostics, "cli");
      console.log(JSON.stringify({ command, diagnostics }, null, 2));
      return;
    }
    case "audit:sources": {
      const report = await auditDailyMysterySources();
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "clean:sources": {
      const result = await cleanDailyMysterySources();
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    default:
      console.error(
        "Usage: mystery-cli <seed:verified|import:champions|schedule:today|coverage|bootstrap|diagnostics|audit:sources|clean:sources>",
      );
      process.exitCode = 1;
  }
}
