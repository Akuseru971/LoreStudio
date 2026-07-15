import { auditDailyMysterySources, cleanDailyMysterySources } from "@/lib/daily-mystery/source-audit";
import {
  auditDailyMysteryOfficialSources,
  cleanDailyMysteryOfficialSources,
  importOfficialChampionBiographies,
  refreshDailyMysteryOfficialSources,
  removeInvalidDailyMysterySchedules,
  rescheduleInvalidTodayOfficialPuzzle,
  verifyDailyMysteryProductionSource,
} from "@/lib/daily-mystery/source-refresh";
import { bootstrapMysteryProduction, importVerifiedSeedManifest } from "@/lib/daily-mystery/bootstrap";
import { collectMysteryDiagnostics, logMysteryDiagnostics } from "@/lib/daily-mystery/diagnostics";
import { buildCoverageReport } from "@/lib/daily-mystery/importer/coverage";
import { ensureDailySchedule } from "@/lib/daily-mystery/schedule";

function cliArgs() {
  return process.argv.slice(3);
}

export async function runMysteryCli(command: string | undefined) {
  const args = cliArgs();
  const forceReplaceInvalidToday = args.includes("--force-replace-invalid-today");

  switch (command) {
    case "seed:verified": {
      const report = await importVerifiedSeedManifest();
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "import:champions":
    case "import:official-champion-biographies": {
      const limit = Number(process.env.MYSTERY_IMPORT_LIMIT ?? "0") || undefined;
      const report = await importOfficialChampionBiographies({ limit });
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "schedule:today":
    case "schedule:daily-mystery": {
      const schedule = forceReplaceInvalidToday
        ? (await rescheduleInvalidTodayOfficialPuzzle({ forceReplaceInvalidToday: true })).schedule
        : await ensureDailySchedule();
      console.log(JSON.stringify({ command, schedule, forceReplaceInvalidToday }, null, 2));
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
    case "audit:official-sources": {
      const report = await auditDailyMysteryOfficialSources();
      console.log(JSON.stringify({ command, report }, null, 2));
      return;
    }
    case "clean:sources": {
      const result = await cleanDailyMysterySources();
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    case "clean:official-sources": {
      const result = await cleanDailyMysteryOfficialSources();
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    case "remove:invalid-schedules": {
      const result = await removeInvalidDailyMysterySchedules();
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    case "verify:production-source": {
      const result = await verifyDailyMysteryProductionSource();
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    case "refresh:official-sources": {
      const limit = Number(process.env.MYSTERY_IMPORT_LIMIT ?? "0") || undefined;
      const result = await refreshDailyMysteryOfficialSources({
        limit,
        forceReplaceInvalidToday,
      });
      console.log(JSON.stringify({ command, result }, null, 2));
      return;
    }
    default:
      console.error(
        "Usage: mystery-cli <seed:verified|import:official-champion-biographies|schedule:daily-mystery|coverage|bootstrap|diagnostics|audit:official-sources|clean:official-sources|remove:invalid-schedules|verify:production-source|refresh:official-sources> [--force-replace-invalid-today]",
      );
      process.exitCode = 1;
  }
}
