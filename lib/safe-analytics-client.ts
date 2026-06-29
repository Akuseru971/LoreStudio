import { track } from "@vercel/analytics";

type SafeAnalyticsValue = string | number | boolean | null | undefined;

export function safeTrackClient(eventName: string, properties?: Record<string, SafeAnalyticsValue>) {
  try {
    track(eventName, properties);
  } catch {
    // Analytics must never block user flows.
  }
}
