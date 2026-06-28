import { fetchBookStatus, generateNextPremiumImage, generatePdfIfReady, retryMissingImages } from "@/lib/client/api";
import { STALE_GENERATION_MS, isGenerationStale } from "@/lib/generation-progress";

const PREMIUM_IMAGE_WORKERS = 1;
const PREMIUM_GENERATION_POLL_MS = 2000;

const activePremiumLoops = new Set<string>();
const premiumImageGenerationInFlightRef: { current: Promise<unknown> | null } = { current: null };

export const premiumGenerationLoopRef = {
  current: false,
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function requestNextPremiumImage(accessToken: string) {
  while (premiumImageGenerationInFlightRef.current) {
    await premiumImageGenerationInFlightRef.current;
  }

  const request = generateNextPremiumImage(accessToken);
  premiumImageGenerationInFlightRef.current = request;
  try {
    return await request;
  } finally {
    if (premiumImageGenerationInFlightRef.current === request) {
      premiumImageGenerationInFlightRef.current = null;
    }
  }
}

function isAllPremiumGenerationComplete(status: {
  readyImagesCount?: number;
  missingPremiumPages?: number[];
  allIllustrationsReady?: boolean;
}) {
  const readyImagesCount = status.readyImagesCount ?? 0;
  const missingPremiumPages = status.missingPremiumPages ?? [];
  return Boolean(status.allIllustrationsReady) || (readyImagesCount >= 8 && missingPremiumPages.length === 0);
}

async function premiumImageWorker(accessToken: string) {
  while (activePremiumLoops.has(accessToken)) {
    const { response, data } = await requestNextPremiumImage(accessToken);

    if (!response.ok && response.status === 403) {
      return;
    }

    if (!response.ok && !data.retryable) {
      console.warn("[PREMIUM_IMAGE_WORKER_ERROR]", data.error);
      await sleep(PREMIUM_GENERATION_POLL_MS);
      continue;
    }

    if (isAllPremiumGenerationComplete(data)) {
      console.log("[PREMIUM_GENERATION_LOOP_STOP_ALL_READY]", {
        bookId: accessToken,
      });
      return;
    }

    if (data.shouldContinuePremiumGeneration || (data.missingPremiumPages?.length ?? 0) > 0) {
      console.log("[PREMIUM_GENERATION_LOOP_CONTINUE]", {
        readyImagesCount: data.readyImagesCount,
        missingPremiumPages: data.missingPremiumPages,
      });
    }

    await sleep(800);
  }
}

export async function startPremiumGenerationLoop(accessToken: string) {
  if (activePremiumLoops.has(accessToken)) {
    return;
  }

  activePremiumLoops.add(accessToken);
  premiumGenerationLoopRef.current = true;
  console.log("[PREMIUM_GENERATION_LOOP_START]", accessToken);

  try {
    void Promise.allSettled(
      Array.from({ length: PREMIUM_IMAGE_WORKERS }, () => premiumImageWorker(accessToken)),
    );

    while (activePremiumLoops.has(accessToken)) {
      const { response, data } = await fetchBookStatus(accessToken);

      if (!response.ok) {
        await sleep(PREMIUM_GENERATION_POLL_MS);
        continue;
      }

      if (data.status === "failed" || data.generationStatus === "failed") {
        console.log("[PREMIUM_GENERATION_LOOP_STOP]", "failed");
        return;
      }

      if (isAllPremiumGenerationComplete(data)) {
        console.log("[PREMIUM_GENERATION_LOOP_STOP_ALL_READY]", {
          bookId: accessToken,
        });
        break;
      }

      if (data.shouldContinuePremiumGeneration || (data.missingPremiumPages?.length ?? 0) > 0) {
        console.log("[PREMIUM_GENERATION_LOOP_CONTINUE]", {
          readyImagesCount: data.readyImagesCount,
          missingPremiumPages: data.missingPremiumPages,
        });
      }

      const updatedAt = data.generationUpdatedAt as string | undefined;
      if (isGenerationStale(updatedAt, STALE_GENERATION_MS)) {
        void retryMissingImages(accessToken);
      }

      await sleep(PREMIUM_GENERATION_POLL_MS);
    }

    const { response: pdfResponse, data: pdfData } = await generatePdfIfReady(accessToken);
    if (!pdfResponse.ok) {
      console.warn("[GENERATE_PDF_IF_READY_CLIENT_ERROR]", pdfData);
    }
  } finally {
    activePremiumLoops.delete(accessToken);
    premiumGenerationLoopRef.current = activePremiumLoops.size > 0;
    console.log("[PREMIUM_GENERATION_LOOP_STOP]", "finished");
  }
}

export function isPremiumGenerationLoopActive(accessToken: string) {
  return activePremiumLoops.has(accessToken);
}
