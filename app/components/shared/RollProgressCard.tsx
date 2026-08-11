import { useState } from 'react';
import { Button, Card } from 'konsta/react';
import { useAppStore } from '../../store';
import { GlobalTimer, CourseProgress } from '../Timer';
import { AnimatedPanelOverlay } from './AnimatedPanelOverlay';

export function RollProgressCard() {
  const { rollActive, config, activeRoleView, resetRoll } = useAppStore();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const showCancelButton = rollActive && activeRoleView === 'pusher';

  const meta =
    rollActive && (config.driver.trim() || config.buggy)
      ? [config.driver.trim(), config.buggy].filter(Boolean).join(' · ')
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
          Cancel this roll?{' '}
          <span className="font-semibold">All recorded times will be lost.</span>
        </p>
      </AnimatedPanelOverlay>

      <Card raised className="!m-0 overflow-hidden" contentWrapPadding="p-5">
        <div className="flex flex-col items-center">
          <p className="text-sm font-semibold text-primary mb-3">Roll progress</p>
          {meta && (
            <p className="text-sm text-[var(--app-fg-muted)] font-medium mb-3 text-center">
              {meta}
            </p>
          )}
          <GlobalTimer />
          <CourseProgress />
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
