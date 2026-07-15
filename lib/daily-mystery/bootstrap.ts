import "server-only";

import { verifiedSeedManifest } from "@/content/daily-mystery/seed-manifest";
import { collectMysteryDiagnostics, logMysteryDiagnostics } from "@/lib/daily-mystery/diagnostics";
import type { ManualManifestEntry } from "@/lib/daily-mystery/importer/ddragon";
import { importOfficialChampionCatalog } from "@/lib/daily-mystery/importer/official-champion-page";
import { precomputeContentEmbeddings } from "@/lib/daily-mystery/semantic";
import { getUniqueLemmas, tokenizePassage } from "@/lib/daily-mystery/tokenize";
import { insertSeedContentIfMissing } from "@/lib/daily-mystery/store";

export type VerifiedSeedReport = {
  inserted: string[];
  skipped: string[];
  rejected: string[];
};

export async function importVerifiedSeedManifest(
  entries: ManualManifestEntry[] = verifiedSeedManifest,
): Promise<VerifiedSeedReport> {
  const report: VerifiedSeedReport = {
    inserted: [],
    skipped: [],
    rejected: [],
  };

  for (const entry of entries) {
    try {
      const result = await insertSeedContentIfMissing(entry);
      if (result.status === "inserted") {
        report.inserted.push(entry.slug);
        const { tokens } = tokenizePassage(result.item.source_text, result.item.protected_terms);
        await precomputeContentEmbeddings(result.item.id, getUniqueLemmas(tokens));
      } else {
        report.skipped.push(entry.slug);
      }
    } catch (error) {
      report.rejected.push(`${entry.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

export async function ensureVerifiedSeedContent() {
  if (process.env.MYSTERY_DISABLE_AUTO_BOOTSTRAP === "true") {
    return { inserted: [], skipped: verifiedSeedManifest.map((entry) => entry.slug), rejected: [] };
  }

  return importVerifiedSeedManifest();
}

export async function bootstrapMysteryProduction({
  seed = true,
  importChampions,
  autoApproveChampions = false,
}: {
  seed?: boolean;
  importChampions?: number;
  autoApproveChampions?: boolean;
} = {}) {
  const results: Record<string, unknown> = {};

  if (seed) {
    results.seed = await importVerifiedSeedManifest();
  }

  if (typeof importChampions === "number" && importChampions > 0) {
    results.champions = await importOfficialChampionCatalog({
      limit: importChampions,
      autoApprove: autoApproveChampions,
    });
  }

  results.diagnostics = await collectMysteryDiagnostics();
  logMysteryDiagnostics(results.diagnostics as Awaited<ReturnType<typeof collectMysteryDiagnostics>>, "bootstrap");

  return results;
}
