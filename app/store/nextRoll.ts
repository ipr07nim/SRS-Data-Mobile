import { courseToday, chooseNextRoll, columnConfig, planDateIso, visibleBuggies } from '../domain/planView';
import type { NextRollChoice, NextRollPick } from '../domain/planView';
import type { SavedRoll } from '../domain/rolls';
import { splitCount } from '../domain/timing';
import type { RollConfig, StationRecords } from '../domain/types';
import type { SrsRollLink } from '../services/supabase/rolls';
import type { PlanStatus } from './planStore';
import type { PlanState } from '../domain/srsPlan';
import type { PlanDate, SrsBuggy } from '../services/srs/client';

export interface NextRoll {
  /** 'plan' when the buggy, driver and pushers come from today's SRS plan; 'manual' otherwise. */
  mode: 'plan' | 'manual';
  choice: NextRollChoice | null;
  config: RollConfig;
  srs: SrsRollLink | null;
}

export interface ActiveRollForPlan {
  srs: SrsRollLink | null;
  records: StationRecords;
}

/**
 * SRS buggy ids already timed in `rollNumber` today. The roll still on the course counts once it
 * has a split, because the next opening tap saves it as completed.
 */
export function timedBuggyIds(
  savedRolls: SavedRoll[],
  active: ActiveRollForPlan | null,
  todayIso: string,
  rollNumber: number,
): Set<number> {
  const ids = new Set(
    savedRolls
      .filter((r) => r.status === 'completed' && r.srsRollDate === todayIso && r.srsRollNumber === rollNumber)
      .map((r) => r.srsBuggyId)
      .filter((id): id is number => id != null),
  );
  if (active?.srs && active.srs.rollDate === todayIso && active.srs.rollNumber === rollNumber
    && splitCount(active.records) > 0) {
    ids.add(active.srs.buggyId);
  }
  return ids;
}

/**
 * What the next opening tap will time. Falls back to the names typed on the phone whenever the
 * SRS plan is unavailable, so timing never depends on the SRS backend being reachable.
 */
export function resolveNextRoll(params: {
  plan: { status: PlanStatus; state: PlanState; buggies: SrsBuggy[]; date: PlanDate };
  pick: NextRollPick | null;
  savedRolls: SavedRoll[];
  active: ActiveRollForPlan | null;
  manualConfig: RollConfig;
  nowMs: number;
}): NextRoll {
  const { plan, pick, savedRolls, active, manualConfig, nowMs } = params;
  const visible = visibleBuggies(plan.buggies, plan.state);
  const todayIso = planDateIso(courseToday(nowMs));

  if (plan.status !== 'ready' || visible.length === 0 || planDateIso(plan.date) !== todayIso) {
    return { mode: 'manual', choice: null, config: manualConfig, srs: null };
  }

  const choice = chooseNextRoll({
    state: plan.state,
    visible,
    pick,
    timedBuggyIds: (rollNumber) => timedBuggyIds(savedRolls, active, todayIso, rollNumber),
  });
  if (!choice.selected) return { mode: 'plan', choice, config: manualConfig, srs: null };

  return {
    mode: 'plan',
    choice,
    config: columnConfig(choice.selected),
    srs: { rollDate: todayIso, rollNumber: choice.rollNumber, buggyId: choice.selected.buggy.id },
  };
}
