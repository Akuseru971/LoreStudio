import { fetchBookStatus, generateNextPremiumImage, retryMissingImages } from "@/lib/client/api";
import { GENERATION_POLL_MS, STALE_GENERATION_MS, isGenerationStale } from "@/lib/generation-progress";

const PREMIUM_IMAGE_WORKERS = 4;
const PREMIUM_GENERATION_POLL_MS = 2500;

const activePremiumLoops = new Set<string>();

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function premiumImageWorker(accessToken: string) {
  while (activePremiumLoops.has(accessToken)) {
    const { response, data } = await generateNextPremiumImage(accessToken);

    if (!response.ok && response.status === 403) {
      return;
    }

    if (!response.ok && !data.retryable) {
      console.warn("[PREMIUM_IMAGE_WORKER_ERROR]", data.error);
      await sleep(PREMIUM_GENERATION_POLL_MS);
      continue;
    }

    if (data.allIllustrationsReady || data.allPremiumImagesReady || (data.done && !data.generated)) {
      return;
    }

    await sleep(500);
  }
}

export async function startPremiumGenerationLoop(accessToken: string) {
  if (activePremiumLoops.has(accessToken)) {
    return;
  }

  activePremiumLoops.add(accessToken);
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

      if (data.allIllustrationsReady) {
        console.log("[PREMIUM_GENERATION_LOOP_STOP]", "all_ready");
        return;
      }

      const updatedAt = data.generationUpdatedAt as string | undefined;
      if (isGenerationStale(updatedAt, STALE_GENERATION_MS)) {
        void retryMissingImages(accessToken);
      }

      await sleep(PREMIUM_GENERATION_POLL_MS);
    }
  } finally {
    activePremiumLoops.delete(accessToken);
    console.log("[PREMIUM_GENERATION_LOOP_STOP]", "finished");
  }
}

export function isPremiumGenerationLoopActive(accessToken: string) {
  return activePremiumLoops.has(accessToken);
}
