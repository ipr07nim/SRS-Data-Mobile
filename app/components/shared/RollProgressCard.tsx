import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card } from 'konsta/react';
import { useAppStore } from '../../store';
import { splitCount } from '../../domain/timing';
import { useClockState } from '../../lib/serverClock';
import { GlobalTimer, CourseProgress } from '../Timer';
import { AnimatedPanelOverlay } from './AnimatedPanelOverlay';

export function ClockStatusLine() {
  const clock = useClockState();
  const text =
    clock.status === 'synced'
      ? `Shared clock synced (±${clock.uncertaintyMs ?? 0} ms)`
      : clock.status === 'unavailable'
        ? 'Server clock unavailable: using this phone\u2019s clock'
        : 'Syncing shared clock\u2026';
  const tone = clock.status === 'unavailable' ? 'text-brand-red' : 'text-[var(--app-fg-muted)]';
  return <p className={`text-xs ${tone} text-center`}>{text}</p>;
}

export function SyncStatusLine() {
  const syncError = useAppStore((s) => s.syncError);
  const pending = useAppStore((s) => s.pendingTaps.length);
  const opening = useAppStore((s) => s.opening);

  if (!syncError && !pending && !opening) return null;
  return (
    <div className="mt-2 text-xs text-center space-y-0.5">
      {opening && <p className="text-primary">Starting roll…</p>}
      {pending > 0 && (
        <p className="text-[var(--app-fg-muted)]">
          {pending} tap{pending === 1 ? '' : 's'} waiting to send
        </p>
      )}
      {syncError && <p className="text-brand-red">{syncError}</p>}
    </div>
  );
}

export function RollProgressCard() {
  const { rollActive, activeRoleView, resetRoll, activeOrigin, activeSrs, records, isFinished } =
    useAppStore();
  const config = useAppStore((s) => s.rollConfigSnapshot ?? s.config);
  const navigate = useNavigate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isPusher = activeRoleView === 'pusher';
  const showCancelButton = rollActive && isPusher;
  const canSaveEarly = rollActive && isPusher && !isFinished && splitCount(records) > 0;

  const meta =
    rollActive && (config.driver.trim() || config.buggy)
      ? [
          activeSrs ? `Roll ${activeSrs.rollNumber}` : null,
          config.driver.trim(),
          config.buggy,
        ].filter(Boolean).join(' · ')
      : null;

  const handleConfirmCancel = () => {
    void resetRoll();
    setShowCancelConfirm(false);
  };

  return (
    <>
      <AnimatedPanelOverlay
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        origin="top"
        title="Cancel roll"
        footer={
          <>
            <Button large tonal className="k-color-brand-red w-full" onClick={handleConfirmCancel}>
              Cancel roll
            </Button>
            <Button large className="w-full" onClick={() => setShowCancelConfirm(false)}>
              Keep rolling
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-center">
          Cancel this roll for every phone?{' '}
          <span className="font-semibold">All recorded times will be lost.</span>
        </p>
      </AnimatedPanelOverlay>

      <Card raised className="!m-0 overflow-hidden" contentWrapPadding="p-5">
        <div className="flex flex-col items-center">
          <p className="text-sm font-semibold text-primary mb-3">Roll progress</p>
          {meta && (
            <p className="text-sm text-[var(--app-fg-muted)] font-medium mb-1 text-center">
              {meta}
            </p>
          )}
          {rollActive && activeOrigin === 'h1h2' && (
            <p className="text-xs text-[var(--app-fg-muted)] mb-2 text-center">
              Started at Hill 2 (Hill 1 skipped)
            </p>
          )}
          <GlobalTimer />
          <CourseProgress />
          <div className="mt-3">
            <ClockStatusLine />
          </div>
          <SyncStatusLine />
          {canSaveEarly && (
            <Button large tonal className="mt-4 w-full" onClick={() => navigate('/summary')}>
              Save roll without a finish
            </Button>
          )}
          {showCancelButton && (
            <Button
              large
              tonal
              className="k-color-brand-red mt-4 w-full"
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancel this roll
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}
