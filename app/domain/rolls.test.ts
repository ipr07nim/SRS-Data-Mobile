import { describe, expect, it } from 'vitest';
import { createEmptyRecords } from './timing';
import {
  buildLeaderboardFromRolls,
  buildSavedRollFromActive,
  filterAndSortRolls,
  formatDriverBuggy,
  formatPusherDriver,
  SEED_ROLLS,
} from './rolls';

describe('formatDriverBuggy', () => {
  it('joins driver and buggy with middle dot', () => {
    expect(formatDriverBuggy('Alex Chen', 'Inviscid')).toBe('Alex Chen · Inviscid');
    expect(formatDriverBuggy('', 'Seraph')).toBe('Unknown · Seraph');
  });
});

describe('formatPusherDriver', () => {
  it('joins pusher and driver with middle dot', () => {
    expect(formatPusherDriver('Chris', 'Alex')).toBe('Chris · Alex');
    expect(formatPusherDriver('', '')).toBe('Unknown · Unknown');
  });
});

describe('buildSavedRollFromActive', () => {
  it('captures notes and unreliable stations', () => {
    const records = createEmptyRecords();
    const start = 1_000_000;
    records.start = start;
    records.h1h2 = start + 8_000;
    records.finish = start + 41_150;

    const roll = buildSavedRollFromActive({
      startTime: start,
      config: {
        driver: 'Alex',
        buggy: 'Inviscid',
        pushers: ['P1', 'P2', 'P3', 'P4', 'P5'],
      },
      records,
      weather: { temp: '60°F', wind: '5 mph', humidity: '50%' },
      notes: 'Test note',
      unreliableStations: ['h2h3'],
    });

    expect(roll.driver).toBe('Alex');
    expect(roll.notes).toBe('Test note');
    expect(roll.unreliableStations).toContain('h2h3');
    expect(roll.totalMs).toBe(41_150);
    expect(roll.splits).toHaveLength(5);
    expect(roll.splits[0].splitMs).toBeGreaterThan(0);
  });
});

describe('buildLeaderboardFromRolls', () => {
  it('returns top 5 fastest splits for a hill', () => {
    const entries = buildLeaderboardFromRolls(SEED_ROLLS, 'H1', 'all');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].timeMs).toBeLessThanOrEqual(entries[i].timeMs);
    }
    expect(entries[0].rank).toBe(1);
    expect(entries[0].rollId).toBeTruthy();
    expect(entries[0].driver).toBeTruthy();
    expect(entries[0].buggy).toBeTruthy();
  });

  it('sorts unknown split times after valid times', () => {
    const rolls = [
      {
        ...SEED_ROLLS[0],
        id: 'unknown-roll',
        splits: SEED_ROLLS[0].splits.map((s) =>
          s.label === 'H1' ? { ...s, time: '--:--.--', splitMs: -1 } : s,
        ),
      },
      ...SEED_ROLLS,
    ];
    const entries = buildLeaderboardFromRolls(rolls, 'H1', 'all');
    const unknownIdx = entries.findIndex((e) => e.time === '--:--.--');
    if (unknownIdx >= 0) {
      expect(unknownIdx).toBe(entries.length - 1);
    }
  });

  it('filters by buggy', () => {
    const all = buildLeaderboardFromRolls(SEED_ROLLS, 'H2', 'all');
    const filtered = buildLeaderboardFromRolls(SEED_ROLLS, 'H2', 'Inviscid');
    expect(filtered.every((e) => e.buggy === 'Inviscid')).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
  });

  it('returns top 5 full rolls by total time when hill is all', () => {
    const entries = buildLeaderboardFromRolls(SEED_ROLLS, 'all', 'all');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].timeMs).toBeLessThanOrEqual(entries[i].timeMs);
    }
    expect(entries[0].name).toBe('');
    expect(entries.every((e) => e.time === SEED_ROLLS.find((r) => r.id === e.rollId)?.total)).toBe(
      true,
    );
  });
});

describe('filterAndSortRolls', () => {
  const rolls = SEED_ROLLS;

  it('filters by driver query', () => {
    const result = filterAndSortRolls(rolls, {
      driverQuery: 'Alex',
      buggy: 'all',
      sortBy: 'date',
    });
    expect(result.every((r) => r.driver.toLowerCase().includes('alex'))).toBe(true);
  });

  it('filters by buggy', () => {
    const result = filterAndSortRolls(rolls, {
      driverQuery: '',
      buggy: 'Seraph',
      sortBy: 'date',
    });
    expect(result.every((r) => r.buggy === 'Seraph')).toBe(true);
  });

  it('sorts by date newest first', () => {
    const result = filterAndSortRolls(rolls, {
      driverQuery: '',
      buggy: 'all',
      sortBy: 'date',
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].startTimeMs).toBeGreaterThanOrEqual(result[i].startTimeMs);
    }
  });

  it('sorts by total time ascending', () => {
    const result = filterAndSortRolls(rolls, {
      driverQuery: '',
      buggy: 'all',
      sortBy: 'total',
    });
    const withTotals = result.filter((r) => r.totalMs > 0);
    for (let i = 1; i < withTotals.length; i++) {
      expect(withTotals[i - 1].totalMs).toBeLessThanOrEqual(withTotals[i].totalMs);
    }
  });
});
