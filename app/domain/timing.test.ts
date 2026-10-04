import { describe, expect, it } from 'vitest';
import { JOIN_WINDOW_MS, RESTART_LOCK_MS, STATIONS } from '../config/app.config';
import { MISSING_SPLIT_TIME } from './types';
import {
  computeSplits,
  computeTotalElapsedMs,
  createEmptyRecords,
  formatTime,
  formatTotalElapsed,
  originStationOf,
  splitCount,
  stationAction,
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

  it('leaves a gap for a skipped station instead of merging it into the next hill', () => {
    const records = createEmptyRecords();
    records.start = 1_000;
    records.h1h2 = 9_000;
    // h2h3 skipped
    records.h3h4 = 25_000;
    records.h4h5 = 33_000;

    const splits = computeSplits(records, config);

    expect(splits[0].time).toBe('0:08.00');
    expect(splits[1].time).toBe(MISSING_SPLIT_TIME);
    expect(splits[2].time).toBe(MISSING_SPLIT_TIME);
    expect(splits[3].time).toBe('0:08.00');
    expect(splitCount(records)).toBe(2);
  });

  it('leaves Hill 1 blank when the roll starts at Hill 2', () => {
    const records = createEmptyRecords();
    records.h1h2 = 5_000;
    records.h2h3 = 17_350;
    records.h3h4 = 28_000;

    const splits = computeSplits(records, config);

    expect(splits[0].time).toBe(MISSING_SPLIT_TIME);
    expect(splits[1].time).toBe('0:12.35');
    expect(splits[2].time).toBe('0:10.65');
  });

  it('computes splits from taps stamped by different phones on the shared clock', () => {
    // Phone A's own clock is 3 s fast and phone B's 2 s slow; each adds its measured offset.
    const phoneA = { localMs: 1_003_000, offsetMs: -3_000 };
    const phoneB = { localMs: 1_043_400, offsetMs: 2_000 };
    const records = createEmptyRecords();
    records.start = phoneA.localMs + phoneA.offsetMs;
    records.h1h2 = phoneB.localMs + phoneB.offsetMs;

    expect(computeSplits(records, config)[0].time).toBe('0:45.40');
  });
});

describe('originStationOf', () => {
  it('is the Hill 1 line when start was tapped', () => {
    const records = createEmptyRecords();
    records.start = 1;
    records.h1h2 = 2;
    expect(originStationOf(records)).toBe('start');
  });

  it('is Hill 2 when Hill 1 was skipped', () => {
    const records = createEmptyRecords();
    records.h1h2 = 2;
    expect(originStationOf(records)).toBe('h1h2');
  });

  it('is null before either opener tapped', () => {
    expect(originStationOf(createEmptyRecords())).toBeNull();
  });
});

describe('stationAction', () => {
  const T = 1_000_000;
  const rollFrom = (taps: Partial<Record<keyof ReturnType<typeof createEmptyRecords>, number>>) => ({
    records: { ...createEmptyRecords(), ...taps },
  });

  it('only Hill 1 and Hill 2 can open a roll when none is on the course', () => {
    expect(stationAction('start', null, T)).toBe('open');
    expect(stationAction('h1h2', null, T)).toBe('open');
    for (const id of ['h2h3', 'h3h4', 'h4h5', 'finish'] as const) {
      expect(stationAction(id, null, T)).toBe('wait');
    }
  });

  it('a Hill 2 tap shortly after a Hill 1 start ends Hill 1 on that roll', () => {
    expect(stationAction('h1h2', rollFrom({ start: T }), T + 11_000)).toBe('record');
  });

  it('a Hill 2 tap long after a Hill 1 start opens the next roll', () => {
    expect(stationAction('h1h2', rollFrom({ start: T }), T + JOIN_WINDOW_MS + 1)).toBe('openNext');
  });

  it('later stations log on the active roll and then show recorded', () => {
    expect(stationAction('h3h4', rollFrom({ start: T }), T + 30_000)).toBe('record');
    expect(stationAction('h3h4', rollFrom({ start: T, h3h4: T + 30_000 }), T + 31_000)).toBe('recorded');
  });

  it('Hill 1 is locked right after a Hill 2 start, then can open the next roll', () => {
    const roll = rollFrom({ h1h2: T });
    expect(stationAction('start', roll, T + 5_000)).toBe('busy');
    expect(stationAction('start', roll, T + RESTART_LOCK_MS + 1)).toBe('openNext');
  });

  it('the station that opened a roll cannot reopen within the lock window', () => {
    const roll = rollFrom({ start: T });
    expect(stationAction('start', roll, T + 1_000)).toBe('recorded');
    expect(stationAction('start', roll, T + RESTART_LOCK_MS + 1)).toBe('openNext');
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

  it('counts from the Hill 2 tap when Hill 1 was skipped', () => {
    const records = createEmptyRecords();
    records.h1h2 = 10_000;
    records.finish = 60_250;
    expect(computeTotalElapsedMs(records)).toBe(50_250);
    expect(formatTotalElapsed(records)).toBe('0:50.25');
  });
});
