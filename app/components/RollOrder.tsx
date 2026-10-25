import { useState } from 'react';
import { Block, BlockHeader, Button } from 'konsta/react';
import { roleCanEditAssignments } from '../config/roles';
import { courseToday, isWeekend, planDateIso } from '../domain/planView';
import {
  clearTeam,
  etaMinutes,
  nextTeam,
  setTeam,
  undoClear,
} from '../domain/srsPlan';
import type { PlanEventDraft } from '../domain/srsPlan';
import { sharedNow } from '../lib/serverClock';
import { useAppStore } from '../store';
import { usePlanStore } from '../store/planStore';

/** Same clock stamp the desktop Clear button writes, local "h:mm". */
function nowLabel(): string {
  const now = new Date();
  return `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function unavailableText(status: string, error: string | null, weekend: boolean): string {
  if (status === 'off') return 'This build is not connected to the SRS backend (VITE_SRS_URL is not set).';
  if (status === 'loading') return 'Loading today’s plan from SRS…';
  if (status === 'error') return error ?? 'SRS plan unavailable.';
  if (!weekend) return 'No weekend roll plan today.';
  return error ?? 'SRS plan unavailable.';
}

/** Team queue and Spirit ETA from the same weekend plan the desktop sidebar uses. */
export default function RollOrder() {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const plan = usePlanStore();
  const [busy, setBusy] = useState(false);

  const canEdit = roleCanEditAssignments(activeRoleView);
  const today = courseToday(sharedNow());
  const todayDisplay = new Date(`${planDateIso(today)}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const header = <BlockHeader className="!mb-2">{`Roll order — ${todayDisplay}`}</BlockHeader>;
  const weekend = isWeekend(plan.date);
  const ready = plan.status === 'ready' && weekend;

  const act = async (drafts: PlanEventDraft[]) => {
    setBusy(true);
    try {
      await plan.append(drafts);
    } catch {
      // plan.error is set by the store
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="py-4 flex flex-col gap-2">
        {header}
        <Block strong inset>
          <p className="text-sm">{unavailableText(plan.status, plan.error, weekend)}</p>
          {plan.status === 'error' && (
            <Button className="mt-3" tonal onClick={() => void plan.refresh()}>
              Try again
            </Button>
          )}
        </Block>
      </div>
    );
  }

  const estimate = etaMinutes(plan.state);
  const upNext = nextTeam(plan.state);
  const etaText = estimate === null ? '—' : `${estimate[0]}–${estimate[1]} min`;
  const etaNote = estimate === null ? 'Spirit not in roll order' : 'Estimated from roll order';

  return (
    <div className="py-4 flex flex-col gap-2">
      {header}
      <Block strong inset className="!my-0">
        <p className="text-xs tracking-wide text-[var(--app-fg-muted)]">Time until Spirit</p>
        <p className="text-4xl font-bold tabular-nums text-primary leading-tight">{etaText}</p>
        <p className="text-sm text-[var(--app-fg-muted)]">{etaNote}</p>
      </Block>

      {plan.error && (
        <p className="px-4 text-sm text-red-500">{plan.error}</p>
      )}

      {plan.state.teamOrder.length === 0 ? (
        <Block strong inset>
          <p className="text-sm text-[var(--app-fg-muted)]">
            No teams in the roll order yet. Set the order on the desktop plan page.
          </p>
        </Block>
      ) : (
        <div className="px-4 flex flex-col gap-2">
          {plan.state.teamOrder.map((name) => {
            const team = plan.state.teams[name] ?? { time: null, scratched: false };
            const rolling = plan.state.rollingTeam === name && !team.scratched;
            const isNext = name === upNext && !team.scratched;
            return (
              <div
                key={name}
                className={`rounded-xl border border-black/10 px-3 py-3 ${rolling ? 'bg-primary/15' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-lg font-semibold min-w-0 truncate ${
                      team.scratched ? 'line-through opacity-50' : ''
                    }`}
                  >
                    {name}
                  </span>
                  <span className="text-xs font-mono shrink-0 text-[var(--app-fg-muted)]">
                    {team.time || ''}
                  </span>
                </div>
                <p className="text-xs text-[var(--app-fg-muted)] min-h-4">
                  {rolling ? 'Rolling now' : isNext ? 'Up next' : team.scratched ? 'Scratched' : ''}
                </p>
                {canEdit && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isNext && (
                      <Button small tonal disabled={busy} onClick={() => void act([clearTeam(name, nowLabel())])}>
                        Clear
                      </Button>
                    )}
                    {rolling && (
                      <Button small tonal disabled={busy} onClick={() => void act([undoClear(name)])}>
                        Undo
                      </Button>
                    )}
                    <Button
                      small
                      tonal
                      disabled={busy}
                      onClick={() => void act([setTeam(name, 'scratched', !team.scratched)])}
                    >
                      {team.scratched ? 'Un-scratch' : 'Scratch'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="px-4 text-xs text-[var(--app-fg-muted)]">
        Clear marks the next team as rolling. The team list itself is edited on the desktop plan page.
      </p>
    </div>
  );
}
