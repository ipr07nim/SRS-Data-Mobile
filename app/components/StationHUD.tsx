import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router';
import {
  Block,
  Button,
  Card,
  Fab,
  Icon,
  useTheme,
} from 'konsta/react';
import { DocText } from 'framework7-icons/react';
import { MdDescription } from 'react-icons/md';
import { UNDO_WINDOW_MS, isStationId } from '../config/app.config';
import type { StationId } from '../config/app.config';
import { isOpenerStation, stationAction } from '../domain/timing';
import type { StationActionKind } from '../domain/timing';
import { sharedNow } from '../lib/serverClock';
import { useWakeLock } from '../hooks/useWakeLock';
import { useAppStore, STATIONS } from '../store';
import { TimingRouteGuard } from './guards/RouteGuards';
import { RollProgressCard } from './shared/RollProgressCard';
import { StationCornerActions } from './shared/StationCornerActions';
import { NextRollPicker } from './shared/NextRollPicker';

export default function StationHUD() {
  return (
    <TimingRouteGuard>
      <StationHUDContent />
    </TimingRouteGuard>
  );
}

function primaryLabelFor(action: StationActionKind, stationId: StationId, name: string, opening: boolean) {
  if (opening) return 'Starting…';
  const atHill2 = stationId === 'h1h2';
  switch (action) {
    case 'open':
      return atHill2 ? 'Start roll at Hill 2' : 'Start roll';
    case 'openNext':
      return atHill2 ? 'Start next roll at Hill 2' : 'Start next roll';
    case 'record':
      return `Log ${name}`;
    case 'recorded':
      return 'Recorded';
    case 'busy':
      return 'Roll on course';
    case 'wait':
      return 'Waiting for start';
  }
}

function StationHUDContent() {
  const theme = useTheme();
  const isIOS = theme === 'ios';
  const { stationId } = useParams();
  const navigate = useNavigate();
  const {
    rollActive,
    activeRoleView,
    tapStation,
    undoRecord,
    records,
    opening,
    toggleStationUnreliable,
    unreliableStations,
  } = useAppStore();

  const validId = stationId && isStationId(stationId) ? stationId : null;
  const station = validId ? STATIONS.find((s) => s.id === validId) : undefined;

  const [pressedAnim, setPressedAnim] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [now, setNow] = useState(() => sharedNow());

  const isFlagOnly = activeRoleView === 'flagger';
  useWakeLock(Boolean(station) && !isFlagOnly);

  useEffect(() => {
    setShowUndo(false);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, [stationId]);

  // Opener stations unlock a minute after a roll starts; re-evaluate as time passes.
  useEffect(() => {
    const timer = setInterval(() => setNow(sharedNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isFinish = station?.id === 'finish';
  const sid = validId;
  const isRecorded = sid ? records[sid] != null : false;
  const finishRecorded = records.finish != null;
  const action: StationActionKind = sid
    ? stationAction(sid, rollActive ? { records } : null, now)
    : 'wait';
  const canTap = action === 'open' || action === 'openNext' || action === 'record';
  const isDisabled = isFlagOnly || !station || opening || !canTap;
  const isOpener = sid ? isOpenerStation(sid) : false;

  useEffect(() => {
    if (!station || !isRecorded || !showUndo) return;

    const timeout = setTimeout(() => {
      setShowUndo(false);
      if (isFinish) navigate('/summary');
    }, UNDO_WINDOW_MS);

    return () => clearTimeout(timeout);
  }, [isRecorded, showUndo, isFinish, navigate, station]);

  if (!validId || !station) {
    return <Navigate to="/" replace />;
  }

  const handleAction = () => {
    const tapMs = sharedNow();
    if (isDisabled) return;

    setPressedAnim(true);
    setShowUndo(true);
    setTimeout(() => setPressedAnim(false), 400);
    void tapStation(station.id, tapMs);
  };

  const handleUndo = () => {
    void undoRecord(station.id);
    setShowUndo(false);
  };

  const isFlagged = Boolean(validId && unreliableStations[validId]);

  const handleFlag = () => {
    toggleStationUnreliable(station.id);
  };

  const primaryLabel = primaryLabelFor(action, station.id, station.name, opening);
  const subLabel =
    action === 'wait'
      ? 'Rolls start at Start, or at H1-H2 when Hill 1 is skipped'
      : action === 'busy'
        ? 'A roll just started. This station unlocks in a moment.'
        : station.label;

  const summaryButton =
    isFinish && finishRecorded && !showUndo ? (
      <Button
        large
        tonal
        className="mt-4 w-full"
        onClick={() => navigate('/summary')}
      >
        <Icon
          ios={<DocText className="w-5 h-5 mr-2" />}
          material={<MdDescription className="w-5 h-5 mr-2" />}
        />
        View roll summary
      </Button>
    ) : null;

  return (
    <div className={`relative min-h-[60vh] ${isIOS ? 'pb-24' : 'pb-32'}`}>
      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      <Block className="!mt-8">
      <Card
        raised
        className="!m-0 overflow-hidden"
        contentWrapPadding="p-5"
      >
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re at {station.name}</h1>
        <p className="text-sm text-[var(--app-fg-muted)] mt-1 mb-4">{station.label}</p>

        {isIOS ? (
          <div className="flex flex-col items-center justify-center py-6">
            <Button
              large
              rounded
              disabled={isDisabled || pressedAnim}
              onClick={handleAction}
              className="!w-56 !h-56 !rounded-full flex-col"
            >
              <span className="text-xl font-bold text-center px-2">{primaryLabel}</span>
              {canTap && action !== 'record' ? null : (
                <span className="text-xs opacity-80 max-w-[160px] text-center mt-1">
                  {subLabel}
                </span>
              )}
            </Button>
          </div>
        ) : (
          <>
            {!canTap && (
              <p className="text-sm text-[var(--app-fg-muted)] mb-2">
                Status: {primaryLabel}. {action === 'recorded' ? '' : subLabel}
              </p>
            )}
            <Fab
              className={`fixed right-4 bottom-24 z-50 ${
                isDisabled || pressedAnim ? 'opacity-50 pointer-events-none' : ''
              }`}
              text={primaryLabel}
              textPosition="after"
              onClick={handleAction}
            />
          </>
        )}

        {summaryButton}
      </Card>
      </Block>

      {isOpener && !isFlagOnly && (action === 'open' || action === 'openNext') && (
        <NextRollPicker compact />
      )}

      <StationCornerActions
        showUndo={isRecorded && showUndo && !opening}
        showFlag={isRecorded && action !== 'openNext' && !opening}
        isFlagged={isFlagged}
        onUndo={handleUndo}
        onFlag={handleFlag}
      />
    </div>
  );
}
