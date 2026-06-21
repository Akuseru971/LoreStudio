import type { ApprovedSynopsis, BookFormInput } from "@/lib/types";
import { sanitizeText } from "@/lib/sanitize-text";

export function validateSynopsisPayload(payload: unknown): ApprovedSynopsis | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Partial<ApprovedSynopsis> & {
    championConnection?: { championName?: unknown; connectionSummary?: unknown };
  };

  const synopsis = sanitizeText(source.synopsis, 1200);
  const legendaryTitle = sanitizeText(source.legendaryTitle, 120);
  const region = sanitizeText(source.region, 80);
  const specificRole = sanitizeText(source.specificRole, 120);
  const coreConflict = sanitizeText(source.coreConflict, 240);
  const championName = sanitizeText(source.championConnection?.championName, 80);
  const connectionSummary = sanitizeText(source.championConnection?.connectionSummary, 400);

  if (!synopsis || !legendaryTitle || !region || !specificRole || !coreConflict || !championName || !connectionSummary) {
    return null;
  }

  const wordCount = synopsis.split(/\s+/).filter(Boolean).length;
  if (wordCount < 40 || wordCount > 160) {
    return null;
  }

  return {
    synopsis,
    legendaryTitle,
    region,
    specificRole,
    championConnection: {
      championName,
      connectionSummary,
    },
    coreConflict,
  };
}

export function validateApprovedSynopsis(body: unknown): ApprovedSynopsis | null {
  return validateSynopsisPayload(body);
}

type ApprovedSynopsisSource = {
  approved_synopsis?: ApprovedSynopsis | null;
  form_input?: (BookFormInput & {
    approvedSynopsis?: unknown;
    approved_synopsis?: unknown;
  }) | null;
};

export function resolveApprovedSynopsis(source: ApprovedSynopsisSource | null | undefined): ApprovedSynopsis | null {
  if (!source) {
    return null;
  }

  const direct = validateApprovedSynopsis(source.approved_synopsis);
  if (direct) {
    return direct;
  }

  const formInput = source.form_input;
  if (!formInput || typeof formInput !== "object") {
    return null;
  }

  const legacy = formInput.approvedSynopsis ?? formInput.approved_synopsis;
  return validateApprovedSynopsis(legacy);
}
