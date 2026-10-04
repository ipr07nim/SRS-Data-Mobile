import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Block,
  BlockTitle,
  Button,
  Icon,
  List,
  ListItem,
  Navbar,
  NavbarBackLink,
} from 'konsta/react';
import { Thermometer, Wind, DropFill, Cube } from 'framework7-icons/react';
import { MdThermostat, MdAir, MdWaterDrop, MdStorage } from 'react-icons/md';
import { HILL_LABEL_TO_STATION } from '../config/app.config';
import type { HillLabel } from '../config/app.config';
import { computeSplits, formatTotalElapsed, splitCount } from '../domain/timing';
import { useAppStore } from '../store';
import { SummaryRouteGuard } from './guards/RouteGuards';
import { FlaggerNotesSection } from './shared/FlaggerNotesSection';
import { RollNotesSection } from './shared/RollNotesSection';
import { RollDriverSection } from './shared/RollDriverSection';
import { SplitTimeRow } from './shared/SplitTimeRow';
import { WeatherModal } from './shared/WeatherModal';

function RollSummaryContent() {
  const navigate = useNavigate();
  const weather = useAppStore((s) => s.weather);
  const records = useAppStore((s) => s.records);
  const startTime = useAppStore((s) => s.startTime);
  const rollNotes = useAppStore((s) => s.rollNotes);
  const unreliableStations = useAppStore((s) => s.unreliableStations);
  const rollConfigSnapshot = useAppStore((s) => s.rollConfigSnapshot);
  const config = useAppStore((s) => s.config);
  const activeOrigin = useAppStore((s) => s.activeOrigin);
  const syncError = useAppStore((s) => s.syncError);
  const flaggerNotes = useAppStore((s) => s.flaggerNotes);
  const setRollNotes = useAppStore((s) => s.setRollNotes);
  const exportRoll = useAppStore((s) => s.exportRoll);

  const splitConfig = rollConfigSnapshot ?? config;

  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const startDate = startTime ? new Date(startTime) : new Date();
  const splits = computeSplits(records, splitConfig);
  const totalElapsedDisplay = formatTotalElapsed(records);
  const hasFinish = records.finish != null;
  const canExport = hasFinish || splitCount(records) > 0;

  const handleExport = async () => {
    if (isExporting || !canExport) return;
    setIsExporting(true);
    await exportRoll();
    if (useAppStore.getState().rollActive) {
      setIsExporting(false);
      return;
    }
    navigate('/');
  };

  const isSplitFlagged = (label: string) => {
    const stationId = HILL_LABEL_TO_STATION[label as HillLabel];
    return Boolean(stationId && unreliableStations[stationId]);
  };

  const exportButton = (
    <Button
      large
      className="w-full"
      disabled={isExporting || !canExport}
      onClick={() => void handleExport()}
    >
      <Icon
        ios={<Cube className="w-5 h-5 mr-2" />}
        material={<MdStorage className="w-5 h-5 mr-2" />}
      />
      Export to SRS database
    </Button>
  );

  const exportHint = !canExport ? (
    <p className="text-xs text-center text-[var(--app-fg-muted)] mt-2">
      No hill has both of its ends tapped yet, so there is nothing to save.
    </p>
  ) : !hasFinish ? (
    <p className="text-xs text-center text-[var(--app-fg-muted)] mt-2">
      No finish tap: the recorded hill splits are saved without a total time.
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-4 py-2 px-4 relative pb-10">
      <WeatherModal open={showWeatherModal} onClose={() => setShowWeatherModal(false)} />

      <Navbar
        title="Roll summary"
        left={<NavbarBackLink text="Back" onClick={() => navigate('/')} />}
        className="!relative !top-auto sticky top-0 z-10"
      />

      <List strongIos outlineIos insetMaterial>
        <ListItem
          link
          title="Start"
          after={startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          subtitle={startDate.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit',
          })}
          onClick={() => setShowWeatherModal(true)}
        />
        <ListItem
          title="Weather"
          subtitle={`${weather.temp} · ${weather.wind} · ${weather.humidity}`}
          onClick={() => setShowWeatherModal(true)}
          media={
            <span className="flex items-center gap-2">
              <Icon
                ios={<Thermometer className="w-5 h-5 text-red-500" />}
                material={<MdThermostat className="w-5 h-5 text-red-500" />}
              />
              <Icon
                ios={<Wind className="w-5 h-5 opacity-70" />}
                material={<MdAir className="w-5 h-5 opacity-70" />}
              />
              <Icon
                ios={<DropFill className="w-5 h-5 text-blue-500" />}
                material={<MdWaterDrop className="w-5 h-5 text-blue-500" />}
              />
            </span>
          }
        />
      </List>

      <RollNotesSection notes={rollNotes} onChange={setRollNotes} />
      {flaggerNotes.length > 0 && (
        <FlaggerNotesSection notes={flaggerNotes} readOnly />
      )}
      <RollDriverSection driver={splitConfig.driver} buggy={splitConfig.buggy} />

      <Block strong insetMaterial outlineIos className="!my-0 !p-0 overflow-hidden">
        <BlockTitle className="px-4">Split times</BlockTitle>
        <div className="flex flex-col">
          {splits.map((split, i) => (
            <SplitTimeRow
              key={i}
              label={split.label}
              pusher={split.pusher}
              time={split.time}
              flagged={isSplitFlagged(split.label)}
              showAvg
            />
          ))}
          <div className="flex justify-between items-center p-5 bg-primary/10">
            <span className="font-bold text-primary">
              Total elapsed time
              {activeOrigin === 'h1h2' && (
                <span className="block text-xs font-normal">From Hill 2 (Hill 1 skipped)</span>
              )}
            </span>
            <span className="font-mono font-bold text-xl text-primary">{totalElapsedDisplay}</span>
          </div>
        </div>
      </Block>

      <Block strong inset className="!my-0">
        {exportButton}
        {exportHint}
        {syncError && <p className="text-xs text-center text-brand-red mt-2">{syncError}</p>}
      </Block>
    </div>
  );
}

export default function RollSummary() {
  return (
    <SummaryRouteGuard>
      <RollSummaryContent />
    </SummaryRouteGuard>
  );
}
