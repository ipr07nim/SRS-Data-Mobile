import { useState } from 'react';
import { Navigate } from 'react-router';
import { Block, BlockFooter, BlockHeader, Button, Card } from 'konsta/react';
import { HILL_LABELS } from '../config/app.config';
import { roleCanEditAssignments, roleShowsAssignTab } from '../config/roles';
import {
  courseToday,
  isWeekend,
  planColumns,
  planDateIso,
  planRollNumbers,
  visibleBuggies,
} from '../domain/planView';
import { setPusher } from '../domain/srsPlan';
import { sharedNow } from '../lib/serverClock';
import { useAppStore } from '../store';
import { usePlanStore } from '../store/planStore';

const PUSHER_LIST_ID = 'srs-pusher-names';

function draftKey(rollNumber: number, slot: number, hill: number) {
  return `${rollNumber}:${slot}:${hill}`;
}

/** Today's pusher assignments, read from and written to the SRS roll-day plan. */
export default function Assign() {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const plan = usePlanStore();
  const [chosenRoll, setChosenRoll] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!roleShowsAssignTab(activeRoleView)) {
    return <Navigate to="/" replace />;
  }

  const canEdit = roleCanEditAssignments(activeRoleView);
  const today = courseToday(sharedNow());
  const todayDisplay = new Date(`${planDateIso(today)}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const header = <BlockHeader className="!mb-2">{`Pusher assignments — ${todayDisplay}`}</BlockHeader>;

  if (plan.status !== 'ready') {
    const text =
      plan.status === 'off'
        ? 'This build is not connected to the SRS backend (VITE_SRS_URL is not set).'
        : plan.status === 'loading'
          ? 'Loading today\u2019s plan from SRS\u2026'
          : plan.error ?? 'SRS plan unavailable.';
    return (
      <div className="py-4 flex flex-col gap-2">
        {header}
        <Block strong inset>
          <p className="text-sm">{text}</p>
          {plan.status === 'error' && (
            <Button className="mt-3" tonal onClick={() => void plan.refresh()}>
              Try again
            </Button>
          )}
        </Block>
      </div>
    );
  }

  const visible = visibleBuggies(plan.buggies, plan.state);
  const rollNumbers = planRollNumbers(plan.state);
  const rollNumber = chosenRoll != null && rollNumbers.includes(chosenRoll) ? chosenRoll : plan.state.currentRoll;
  const index = rollNumbers.indexOf(rollNumber);
  const columns = planColumns(plan.state, rollNumber, visible);

  const commit = (slot: number, hill: number, current: string) => {
    const key = draftKey(rollNumber, slot, hill);
    const draft = drafts[key];
    if (draft === undefined) return;
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    const value = draft.trim();
    if (value === current) return;
    void plan.append([setPusher(rollNumber, slot, hill, value)]).catch(() => {});
  };

  return (
    <div className="py-4 flex flex-col gap-2">
      {header}

      {!isWeekend(today) && (
        <p className="px-4 text-xs text-[var(--app-fg-muted)]">
          Today is not a weekend roll day; this is today&apos;s (likely empty) weekend plan.
        </p>
      )}

      <div className="px-4 flex items-center justify-between gap-2">
        <Button
          small
          tonal
          inline
          disabled={index <= 0}
          onClick={() => setChosenRoll(rollNumbers[index - 1])}
          aria-label="Previous roll"
        >
          ‹
        </Button>
        <span className="text-sm font-semibold">
          Roll {rollNumber}
          {rollNumber === plan.state.currentRoll ? ' (current)' : ''}
        </span>
        <Button
          small
          tonal
          inline
          disabled={index < 0 || index >= rollNumbers.length - 1}
          onClick={() => setChosenRoll(rollNumbers[index + 1])}
          aria-label="Next roll"
        >
          ›
        </Button>
      </div>

      {plan.error && <p className="px-4 text-xs text-brand-red">{plan.error}</p>}

      {columns.length === 0 && (
        <Block strong inset>
          <p className="text-sm">No buggies are on today&apos;s plan yet.</p>
        </Block>
      )}

      <datalist id={PUSHER_LIST_ID}>
        {plan.pusherNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {columns.map((column) => (
        <Card key={column.buggy.id} raised className="!mx-4 !my-2" contentWrapPadding="p-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <span className={`text-base font-bold ${column.entry.scratched ? 'line-through opacity-50' : ''}`}>
              {column.buggy.name}
            </span>
            <span className="text-xs text-[var(--app-fg-muted)]">
              {column.entry.scratched ? 'Scratched · ' : ''}
              {column.entry.driver || 'No driver'}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {HILL_LABELS.map((label, i) => {
              const hill = i + 1;
              const current = column.pushers[i];
              const key = draftKey(rollNumber, column.slot, hill);
              const value = drafts[key] ?? current;
              return (
                <label key={label} className="flex items-center gap-3">
                  <span className="w-8 text-sm font-semibold text-[var(--app-fg-muted)]">{label}</span>
                  {canEdit ? (
                    <input
                      type="text"
                      list={PUSHER_LIST_ID}
                      autoComplete="off"
                      autoCapitalize="words"
                      enterKeyHint="done"
                      placeholder="Pusher"
                      value={value}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDrafts((d) => ({ ...d, [key]: next }));
                      }}
                      onBlur={() => commit(column.slot, hill, current)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-[var(--app-border)] bg-transparent px-3 py-2 text-base"
                    />
                  ) : (
                    <span className="flex-1 text-base">{current || '—'}</span>
                  )}
                </label>
              );
            })}
          </div>
        </Card>
      ))}

      <BlockFooter className="!mt-2">
        {canEdit
          ? 'Changes go straight to the SRS roll-day plan and show up on the desktop plan page and on every phone within a few seconds.'
          : 'Switch to the Pushers or Mechanics role to edit assignments.'}
      </BlockFooter>
    </div>
  );
}
