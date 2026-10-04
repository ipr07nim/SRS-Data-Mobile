import { COURSE_TIME_ZONE, HILL_LABELS } from '../config/app.config';
import type { PlanDate, SrsBuggy } from '../services/srs/client';
import type { RollConfig } from './types';
import { hillOrder, rollOrder, sortedRolls } from './srsPlan';
import type { PlanEntry, PlanRoll, PlanState } from './srsPlan';

/** The calendar date on the course (Pittsburgh), not UTC: rolls run before 8am and midnights after 8pm. */
export function courseToday(nowMs: number): PlanDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COURSE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function planDateIso(date: PlanDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function isWeekend(date: PlanDate): boolean {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 || day === 6;
}

/** Same blank entry the plan page renders for a buggy the log has not touched. */
const BLANK_ENTRY: PlanEntry = {
  driver: '', wheels: '', heat: null, bags: null, hill2: 1, tree: '',
  mech_br: '', mech_bl: '', mech_front: '', scratched: false, roll_id: null,
};

/** The buggies the plan page shows as columns: active in SRS and not hidden for the day. */
export function visibleBuggies(buggies: SrsBuggy[], state: PlanState): SrsBuggy[] {
  return buggies.filter((b) => b.active && !state.hiddenBuggies.includes(b.id));
}

export interface PlanColumn {
  buggy: SrsBuggy;
  entry: PlanEntry;
  /** The pusher set shown in this column; sets are numbered slots, not owned by a buggy. */
  slot: number;
  /** Pusher names for hills 1-5 (index 0 is Hill 1). */
  pushers: string[];
}

function rollOrEmpty(state: PlanState, rollNumber: number): PlanRoll {
  return state.rolls[rollNumber] ?? { number: rollNumber, time: null, entries: {}, hills: {} };
}

/**
 * One column per visible buggy, in the plan page's order, paired with the pusher set that page
 * shows (and promotes into the database) for that column.
 */
export function planColumns(state: PlanState, rollNumber: number, visible: SrsBuggy[]): PlanColumn[] {
  const roll = rollOrEmpty(state, rollNumber);
  const ids = visible.map((b) => b.id);
  const order = rollOrder(roll, ids);
  const slots = hillOrder(roll, ids.length);

  return order.flatMap((id, index) => {
    const buggy = visible.find((b) => b.id === id);
    if (!buggy) return [];
    const slot = slots[index] ?? index + 1;
    const hills = roll.hills[slot] ?? {};
    return [{
      buggy,
      entry: roll.entries[id] ?? BLANK_ENTRY,
      slot,
      pushers: HILL_LABELS.map((_, i) => hills[i + 1] ?? ''),
    }];
  });
}

/** Roll numbers worth offering: every planned roll plus the current one. */
export function planRollNumbers(state: PlanState): number[] {
  const numbers = new Set(sortedRolls(state).map((r) => r.number));
  numbers.add(state.currentRoll);
  return [...numbers].sort((a, b) => a - b);
}

export function columnConfig(column: PlanColumn): RollConfig {
  return {
    driver: column.entry.driver,
    buggy: column.buggy.name,
    pushers: [...column.pushers],
  };
}

export interface NextRollPick {
  rollNumber: number;
  buggyId: number;
}

export interface NextRollChoice {
  rollNumber: number;
  columns: PlanColumn[];
  selected: PlanColumn | null;
}

/**
 * The buggy the next opening tap will time. An explicit pick wins; otherwise the first
 * non-scratched column that has not been timed yet for this roll number.
 */
export function chooseNextRoll(params: {
  state: PlanState;
  visible: SrsBuggy[];
  pick: NextRollPick | null;
  timedBuggyIds: (rollNumber: number) => Set<number>;
}): NextRollChoice {
  const { state, visible, pick, timedBuggyIds } = params;
  const rollNumber = pick?.rollNumber ?? state.currentRoll;
  const columns = planColumns(state, rollNumber, visible);
  const eligible = columns.filter((c) => !c.entry.scratched);

  const picked = pick && pick.rollNumber === rollNumber
    ? eligible.find((c) => c.buggy.id === pick.buggyId)
    : undefined;
  if (picked) return { rollNumber, columns, selected: picked };

  const timed = timedBuggyIds(rollNumber);
  const selected = eligible.find((c) => !timed.has(c.buggy.id)) ?? eligible[0] ?? null;
  return { rollNumber, columns, selected };
}
