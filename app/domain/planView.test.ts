import { describe, expect, it } from 'vitest';
import type { SrsBuggy } from '../services/srs/client';
import {
  chooseNextRoll,
  columnConfig,
  courseToday,
  isWeekend,
  planColumns,
  planDateIso,
  planRollNumbers,
  visibleBuggies,
} from './planView';
import { reducePlan, setDay, setEntry, setPusher, setRoll } from './srsPlan';
import type { PlanEvent, PlanEventDraft } from './srsPlan';

const buggies: SrsBuggy[] = [
  { id: 10, name: 'Inviscid', abbreviation: 'INV', active: true },
  { id: 11, name: 'Kingpin', abbreviation: 'KNG', active: true },
  { id: 12, name: 'Seraph', abbreviation: 'SER', active: false },
  { id: 13, name: 'Zuke', abbreviation: 'ZUK', active: true },
];

function stateFrom(drafts: PlanEventDraft[]) {
  const events: PlanEvent[] = drafts.map((d, i) => ({ ...d, seq: i + 1, client_id: 'test' }));
  return reducePlan(events);
}

describe('courseToday', () => {
  it('uses the Pittsburgh date, not UTC', () => {
    // 02:30 UTC on Sunday is still Saturday evening in Pittsburgh (EDT).
    const ms = Date.UTC(2026, 9, 4, 2, 30);
    expect(planDateIso(courseToday(ms))).toBe('2026-10-03');
  });

  it('recognises weekend days', () => {
    expect(isWeekend({ year: 2026, month: 10, day: 3 })).toBe(true);
    expect(isWeekend({ year: 2026, month: 10, day: 4 })).toBe(true);
    expect(isWeekend({ year: 2026, month: 10, day: 5 })).toBe(false);
  });
});

describe('visibleBuggies', () => {
  it('keeps active buggies in SRS order and drops hidden ones', () => {
    const state = stateFrom([setDay('hidden_buggies', [11])]);
    expect(visibleBuggies(buggies, state).map((b) => b.id)).toEqual([10, 13]);
  });
});

describe('planColumns', () => {
  it('pairs each column with the pusher set the plan page shows for it', () => {
    const state = stateFrom([
      setPusher(1, 1, 1, 'Ana'),
      setPusher(1, 1, 5, 'Eve'),
      setPusher(1, 2, 1, 'Bo'),
      setPusher(1, 3, 2, 'Cy'),
      setEntry(1, 13, 'driver', 'Zoe'),
    ]);
    const columns = planColumns(state, 1, visibleBuggies(buggies, state));

    expect(columns.map((c) => [c.buggy.id, c.slot])).toEqual([[10, 1], [11, 2], [13, 3]]);
    expect(columns[0].pushers).toEqual(['Ana', '', '', '', 'Eve']);
    expect(columns[2].pushers).toEqual(['', 'Cy', '', '', '']);
    expect(columnConfig(columns[2])).toEqual({
      driver: 'Zoe',
      buggy: 'Zuke',
      pushers: ['', 'Cy', '', '', ''],
    });
  });

  it('follows reordered buggies and pusher sets independently', () => {
    const state = stateFrom([
      setPusher(2, 1, 1, 'Ana'),
      setPusher(2, 2, 1, 'Bo'),
      setRoll(2, 'order', [13, 10]),
      setRoll(2, 'hills_order', [2, 1]),
    ]);
    const columns = planColumns(state, 2, visibleBuggies(buggies, state));

    expect(columns.map((c) => [c.buggy.id, c.slot, c.pushers[0]])).toEqual([
      [13, 2, 'Bo'],
      [10, 1, 'Ana'],
      [11, 3, ''],
    ]);
  });
});

describe('chooseNextRoll', () => {
  const none = () => new Set<number>();

  it('defaults to the first untimed, non-scratched buggy of the current roll', () => {
    const state = stateFrom([
      setDay('current_roll', 3),
      setEntry(3, 10, 'scratched', true),
    ]);
    const visible = visibleBuggies(buggies, state);

    expect(chooseNextRoll({ state, visible, pick: null, timedBuggyIds: none }).selected?.buggy.id).toBe(11);
    expect(
      chooseNextRoll({ state, visible, pick: null, timedBuggyIds: () => new Set([11]) }).selected?.buggy.id,
    ).toBe(13);
  });

  it('honours an explicit pick unless that buggy is scratched', () => {
    const state = stateFrom([setEntry(1, 13, 'scratched', true)]);
    const visible = visibleBuggies(buggies, state);

    expect(chooseNextRoll({ state, visible, pick: { rollNumber: 1, buggyId: 11 }, timedBuggyIds: none })
      .selected?.buggy.id).toBe(11);
    expect(chooseNextRoll({ state, visible, pick: { rollNumber: 1, buggyId: 13 }, timedBuggyIds: none })
      .selected?.buggy.id).toBe(10);
  });

  it('lists planned rolls plus the current roll', () => {
    const state = stateFrom([setPusher(4, 1, 1, 'Ana'), setPusher(2, 1, 1, 'Bo'), setDay('current_roll', 1)]);
    expect(planRollNumbers(state)).toEqual([1, 2, 4]);
  });
});
