export interface ClockSample {
  /** Local monotonic time when the request was sent and when the reply arrived. */
  sentMs: number;
  receivedMs: number;
  serverMs: number;
}

/**
 * The server read its clock somewhere inside the round trip; assuming the midpoint, the error is
 * at most half the round trip, so the fastest sample gives the tightest offset.
 */
export function bestClockOffset(samples: ClockSample[]): { offset: number; rtt: number } | null {
  let best: { offset: number; rtt: number } | null = null;
  for (const { sentMs, receivedMs, serverMs } of samples) {
    const rtt = receivedMs - sentMs;
    if (rtt < 0 || !Number.isFinite(serverMs)) continue;
    const offset = serverMs - (sentMs + receivedMs) / 2;
    if (!best || rtt < best.rtt) best = { offset, rtt };
  }
  return best;
}
