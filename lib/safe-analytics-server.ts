import "server-only";

import { track } from "@vercel/analytics/server";

type SafeAnalyticsValue = string | number | boolean | null | undefined;

export function safeTrackServer(eventName: string, properties?: Record<string, SafeAnalyticsValue>) {
  void track(eventName, properties).catch(() => {
    // Analytics must never block server flows.
  });
}
