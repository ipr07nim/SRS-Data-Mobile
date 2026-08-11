import { describe, expect, it } from 'vitest';
import { STATIONS } from '../config/app.config';
import { MISSING_SPLIT_TIME } from './types';
import {
  computeSplits,
  computeTotalElapsedMs,
  createEmptyRecords,
  formatTime,
  formatTotalElapsed,
} from './timing';

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00.00');
  });

  it('clamps negative values to zero', () => {
    expect(formatTime(-500)).toBe('0:00.00');
  });

  it('formats minutes, seconds, and centiseconds', () => {
    // 1m 2s 340ms -> centiseconds 34
    expect(formatTime(62_340)).toBe('1:02.34');
  });

  it('pads seconds and centiseconds', () => {
    expect(formatTime(5_050)).toBe('0:05.05');
  });
});

describe('createEmptyRecords', () => {
  it('has a null entry for every station', () => {
    const records = createEmptyRecords();
    for (const station of STATIONS) {
      expect(records[station.id]).toBeNull();
    }
  });
});

describe('computeSplits', () => {
  const config = {
    driver: 'Alex',
    buggy: 'Inviscid',
    pushers: ['P1', 'P2', 'P3', 'P4', 'P5'],
  };

  it('returns five hill splits with correct labels and pushers', () => {
    const records = createEmptyRecords();
    records.start = 1_000;
    records.h1h2 = 9_000;
    records.h2h3 = 17_000;
    records.h3h4 = 25_000;
    records.h4h5 = 33_000;
    records.finish = 41_000;

    const splits = computeSplits(records, config);

    expect(splits).toHaveLength(5);
    expect(splits.map((s) => s.label)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
    expect(splits.map((s) => s.pusher)).toEqual(config.pushers);
    expect(splits.map((s) => s.time)).toEqual([
      '0:08.00',
      '0:08.00',
      '0:08.00',
      '0:08.00',
      '0:08.00',
    ]);
  });

  it('uses Unknown when pusher name is empty', () => {
    const records = createEmptyRecords();
    records.start = 0;
    records.h1h2 = 8_000;

    const splits = computeSplits(records, {
      ...config,
      pushers: ['', '', '', '', ''],
    });

    expect(splits[0].pusher).toBe('Unknown');
    expect(splits[0].time).toBe('0:08.00');
    expect(splits[1].time).toBe(MISSING_SPLIT_TIME);
  });

  it('does not advance previousTime when segment is missing', () => {
    const records = createEmptyRecords();
    records.start = 1_000;
    records.h1h2 = 9_000;
    // h2h3 skipped
    records.h3h4 = 25_000;

    const splits = computeSplits(records, config);

    expect(splits[0].time).toBe('0:08.00');
    expect(splits[1].time).toBe(MISSING_SPLIT_TIME);
    // h3h4 still compared to h1h2 (previousTime not advanced past gap)
    expect(splits[2].time).toBe('0:16.00');
  });
});

describe('computeTotalElapsedMs / formatTotalElapsed', () => {
  it('returns zero when finish or start is missing', () => {
    const records = createEmptyRecords();
    records.start = 1_000;
    expect(computeTotalElapsedMs(records)).toBe(0);
    expect(formatTotalElapsed(records)).toBe(MISSING_SPLIT_TIME);
  });

  it('returns finish minus start when both exist', () => {
    const records = createEmptyRecords();
    records.start = 1_000;
    records.finish = 42_150;
    expect(computeTotalElapsedMs(records)).toBe(41_150);
    expect(formatTotalElapsed(records)).toBe('0:41.15');
  });
});
