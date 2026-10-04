import { describe, expect, it } from 'vitest';
import type { SavedRoll } from '../domain/rolls';
import type { StationRecords } from '../domain/types';
import { timedBuggyIds } from './nextRoll';

const TODAY = '2026-10-03';

function records(partial: Partial<StationRecords>): StationRecords {
  return { start: null, h1h2: null, h2h3: null, h3h4: null, h4h5: null, finish: null, ...partial };
}

function saved(buggyId: number, status: SavedRoll['status'], rollNumber = 1): SavedRoll {
  return { status, srsRollDate: TODAY, srsRollNumber: rollNumber, srsBuggyId: buggyId } as SavedRoll;
}

describe('timedBuggyIds', () => {
  it('counts completed rolls for the same roll number only', () => {
    const rolls = [saved(1, 'completed'), saved(2, 'cancelled'), saved(3, 'completed', 2)];
    expect([...timedBuggyIds(rolls, null, TODAY, 1)]).toEqual([1]);
  });

  it('counts the roll on the course once it has a split, since the next start saves it', () => {
    const active = {
      srs: { rollDate: TODAY, rollNumber: 1, buggyId: 2 },
      records: records({ h1h2: 1_000, h2h3: 35_000 }),
    };
    expect(timedBuggyIds([saved(1, 'completed')], active, TODAY, 1)).toEqual(new Set([1, 2]));
  });

  it('keeps a roll with no split up next, since replacing it cancels it', () => {
    const active = {
      srs: { rollDate: TODAY, rollNumber: 1, buggyId: 2 },
      records: records({ start: 1_000 }),
    };
    expect(timedBuggyIds([], active, TODAY, 1).has(2)).toBe(false);
  });
});
