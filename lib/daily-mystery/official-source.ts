import { OFFICIAL_SOURCE_DOMAINS } from "@/lib/daily-mystery/types";

export function isOfficialDomain(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return OFFICIAL_SOURCE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
