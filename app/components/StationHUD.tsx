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
import { useAppStore, STATIONS } from '../store';
import { TimingRouteGuard } from './guards/RouteGuards';
import { RollProgressCard } from './shared/RollProgressCard';
import { StationCornerActions } from './shared/StationCornerActions';

export default function StationHUD() {
  return (
    <TimingRouteGuard>
      <StationHUDContent />
    </TimingRouteGuard>
  );
}

function StationHUDContent() {
  const theme = useTheme();
  const isIOS = theme === 'ios';
  const { stationId } = useParams();
  const navigate = useNavigate();
  const {
    rollActive,
    activeRoleView,
    startRoll,
    recordStation,
    undoRecord,
    records,
    config,
    toggleStationUnreliable,
    unreliableStations,
  } = useAppStore();

  const validId = stationId && isStationId(stationId) ? stationId : null;
  const station = validId ? STATIONS.find((s) => s.id === validId) : undefined;

  const [pressedAnim, setPressedAnim] = useState(false);
  const [showUndo, setShowUndo] = useState(false);

  const isFlagOnly = activeRoleView === 'flagger';

  useEffect(() => {
    setShowUndo(false);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, [stationId]);

  const isStart = station?.id === 'start';
  const isFinish = station?.id === 'finish';
  const sid = validId;
  const isRecorded = sid ? records[sid] !== null : false;
  const finishRecorded = records.finish !== null;
  const isDisabled = isFlagOnly || !station || (!isStart && !rollActive) || isRecorded;

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
    if (isDisabled) return;

    setPressedAnim(true);
    const now = Date.now();

    if (isStart && !rollActive) {
      void startRoll(config);
    } else {
      void recordStation(station.id, now);
    }

    setShowUndo(true);
    setTimeout(() => setPressedAnim(false), 400);
  };

  const handleUndo = () => {
    void undoRecord(station.id);
    setShowUndo(false);
  };

  const isFlagged = Boolean(validId && unreliableStations[validId]);

  const handleFlag = () => {
    toggleStationUnreliable(station.id);
  };

  const primaryLabel = isRecorded
    ? 'Recorded'
    : isStart && !rollActive
      ? 'Start roll'
      : `Log ${station.name}`;

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
              {!isRecorded && (
                <span className="text-xs opacity-80 max-w-[140px] text-center mt-1">
                  {station.label}
                </span>
              )}
            </Button>
          </div>
        ) : (
          <>
            {isRecorded && (
              <p className="text-sm text-[var(--app-fg-muted)] mb-2">Status: Recorded</p>
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

      <StationCornerActions
        showUndo={isRecorded && showUndo}
        showFlag={isRecorded}
        isFlagged={isFlagged}
        onUndo={handleUndo}
        onFlag={handleFlag}
      />
    </div>
  );
}
