const guessBuckets = new Map<string, number[]>();

export function checkGuessRateLimit(playerId: string, maxPerMinute: number) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const history = (guessBuckets.get(playerId) ?? []).filter((timestamp) => timestamp >= windowStart);
  if (history.length >= maxPerMinute) {
    return false;
  }
  history.push(now);
  guessBuckets.set(playerId, history);
  return true;
}
