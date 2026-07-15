import type { MysteryReviewStatus } from "@/lib/daily-mystery/types";
import { localesMatch, normalizeLocale } from "@/lib/daily-mystery/locale";

export function isScheduleEligibleItem({
  review_status,
  retired_at,
  locale,
}: {
  review_status: MysteryReviewStatus | string;
  retired_at: string | null;
  locale: string;
}) {
  return review_status === "approved" && retired_at == null && localesMatch(locale, "en_US");
}

export function filterScheduleEligibleItems<
  T extends { review_status: MysteryReviewStatus | string; retired_at: string | null; locale: string },
>(items: T[]) {
  return items.filter((item) => isScheduleEligibleItem(item));
}

export { normalizeLocale };
