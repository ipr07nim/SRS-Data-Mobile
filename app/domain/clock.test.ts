import { describe, expect, it } from 'vitest';
import { bestClockOffset } from './clock';

describe('bestClockOffset', () => {
  it('uses the midpoint of the fastest round trip', () => {
    const best = bestClockOffset([
      { sentMs: 1_000, receivedMs: 1_400, serverMs: 6_300 },
      { sentMs: 2_000, receivedMs: 2_040, serverMs: 7_020 },
      { sentMs: 3_000, receivedMs: 3_200, serverMs: 8_050 },
    ]);
    expect(best).toEqual({ offset: 5_000, rtt: 40 });
  });

  it('gives two phones with different clocks the same shared time', () => {
    // The server reads 10_000 at the midpoint of each phone's round trip.
    const phoneA = bestClockOffset([{ sentMs: 12_990, receivedMs: 13_010, serverMs: 10_000 }])!;
    const phoneB = bestClockOffset([{ sentMs: 4_970, receivedMs: 5_030, serverMs: 10_000 }])!;
    expect(13_000 + 45_400 + phoneA.offset).toBe(5_000 + 45_400 + phoneB.offset);
  });

  it('ignores unusable samples', () => {
    expect(bestClockOffset([])).toBeNull();
    expect(bestClockOffset([{ sentMs: 5, receivedMs: 1, serverMs: 10 }])).toBeNull();
    expect(bestClockOffset([{ sentMs: 1, receivedMs: 5, serverMs: Number.NaN }])).toBeNull();
  });
});
