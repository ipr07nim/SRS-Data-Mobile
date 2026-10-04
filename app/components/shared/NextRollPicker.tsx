import { useMemo } from 'react';
import { BlockHeader, Button, Chip, List, ListItem } from 'konsta/react';
import { HILL_LABELS } from '../../config/app.config';
import { courseToday, isWeekend, planDateIso, planRollNumbers } from '../../domain/planView';
import { sharedNow } from '../../lib/serverClock';
import { useAppStore } from '../../store';
import { usePlanStore } from '../../store/planStore';
import { resolveNextRoll, timedBuggyIds } from '../../store/nextRoll';
import { StartConfigPanel } from './StartConfigPanel';

function manualReason(status: string, error: string | null, hasBuggies: boolean): string {
  if (status === 'off') return 'SRS plan not connected for this app.';
  if (status === 'loading') return 'Loading today\u2019s SRS plan\u2026';
  if (status === 'error') return error ?? 'SRS plan unavailable.';
  if (!isWeekend(courseToday(sharedNow()))) return 'No weekend roll plan today.';
  if (!hasBuggies) return 'Today\u2019s SRS plan has no buggies yet.';
  return 'SRS plan unavailable.';
}

/** Which buggy, driver and pushers the next opening tap will attach to the roll. */
export function NextRollPicker({ compact = false }: { compact?: boolean }) {
  const plan = usePlanStore();
  const pick = useAppStore((s) => s.nextRollPick);
  const setPick = useAppStore((s) => s.setNextRollPick);
  const savedRolls = useAppStore((s) => s.savedRolls);
  const manualConfig = useAppStore((s) => s.config);
  const rollActive = useAppStore((s) => s.rollActive);
  const activeSrs = useAppStore((s) => s.activeSrs);
  const records = useAppStore((s) => s.records);

  const active = useMemo(
    () => (rollActive ? { srs: activeSrs, records } : null),
    [rollActive, activeSrs, records],
  );
  const next = useMemo(
    () => resolveNextRoll({ plan, pick, savedRolls, active, manualConfig, nowMs: sharedNow() }),
    [plan, pick, savedRolls, active, manualConfig],
  );

  if (next.mode === 'manual') {
    return (
      <>
        <BlockHeader className="!mt-6 !mb-2">Next roll</BlockHeader>
        <p className="px-4 text-xs text-[var(--app-fg-muted)]">
          {manualReason(plan.status, plan.error, plan.buggies.length > 0)} Type the roll in below.
        </p>
        <StartConfigPanel title="Next roll (typed in)" />
      </>
    );
  }

  const choice = next.choice!;
  const rollNumbers = planRollNumbers(plan.state);
  const index = rollNumbers.indexOf(choice.rollNumber);
  const todayIso = planDateIso(courseToday(sharedNow()));
  const timed = timedBuggyIds(savedRolls, active, todayIso, choice.rollNumber);

  const goToRoll = (rollNumber: number) => {
    setPick(rollNumber === plan.state.currentRoll ? null : { rollNumber, buggyId: -1 });
  };

  const selected = choice.selected;
  const eligible = choice.columns.filter((c) => !c.entry.scratched);
  const pickedBuggy = pick?.rollNumber === choice.rollNumber && pick.buggyId >= 0;
  const allTimed = !pickedBuggy && eligible.length > 0 && eligible.every((c) => timed.has(c.buggy.id));

  return (
    <>
      <BlockHeader className="!mt-6 !mb-2">Next roll (from SRS plan)</BlockHeader>
      <div className="px-4 flex items-center justify-between gap-2">
        <Button
          small
          tonal
          inline
          disabled={index <= 0}
          onClick={() => goToRoll(rollNumbers[index - 1])}
          aria-label="Previous roll"
        >
          ‹
        </Button>
        <span className="text-sm font-semibold">
          Roll {choice.rollNumber}
          {choice.rollNumber === plan.state.currentRoll ? ' (current)' : ''}
        </span>
        <Button
          small
          tonal
          inline
          disabled={index < 0 || index >= rollNumbers.length - 1}
          onClick={() => goToRoll(rollNumbers[index + 1])}
          aria-label="Next roll"
        >
          ›
        </Button>
      </div>

      <div className="px-4 mt-3 flex flex-wrap gap-2">
        {choice.columns.map((column) => {
          const isSelected = selected?.buggy.id === column.buggy.id;
          const scratched = column.entry.scratched;
          return (
            <Chip
              key={column.buggy.id}
              component="button"
              outline={!isSelected}
              className={`${scratched ? 'opacity-40 line-through' : 'cursor-pointer'} ${
                isSelected ? '!bg-primary !text-black font-semibold' : ''
              }`}
              onClick={
                scratched
                  ? undefined
                  : () => setPick({ rollNumber: choice.rollNumber, buggyId: column.buggy.id })
              }
            >
              {timed.has(column.buggy.id) ? '✓ ' : ''}
              {column.buggy.name}
            </Chip>
          );
        })}
      </div>

      {selected ? (
        <List strong inset>
          <ListItem title="Buggy" after={selected.buggy.name} />
          <ListItem title="Driver" after={selected.entry.driver || 'Not set'} />
          {!compact &&
            HILL_LABELS.map((label, i) => (
              <ListItem key={label} title={`Pusher ${label}`} after={selected.pushers[i] || 'Not set'} />
            ))}
        </List>
      ) : (
        <p className="px-4 mt-3 text-xs text-[var(--app-fg-muted)]">
          Every buggy in this roll is scratched.
        </p>
      )}
      {allTimed && (
        <p className="px-4 text-xs text-[var(--app-fg-muted)]">
          Every buggy in Roll {choice.rollNumber} is timed. Use › for the next roll, or pick a buggy to roll it again.
        </p>
      )}
      <p className="px-4 text-xs text-[var(--app-fg-muted)]">
        The next tap at Start (or at H1-H2 when Hill 1 is skipped) times this buggy.
      </p>
    </>
  );
}
