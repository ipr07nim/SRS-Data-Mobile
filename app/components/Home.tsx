import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Block,
  BlockHeader,
  BlockTitle,
  Icon,
  List,
  ListItem,
} from 'konsta/react';
import { Thermometer, Wind, DropFill, Checkmark } from 'framework7-icons/react';
import { MdThermostat, MdAir, MdWaterDrop, MdCheck } from 'react-icons/md';
import { WEATHER } from '../config/app.config';
import { useAppStore, STATIONS } from '../store';
import { computeSplits, formatTime, parseFormattedTime } from '../domain/timing';
import { HILL_AVERAGES } from '../config/app.config';
import type { HillLabel } from '../config/app.config';
import { RollProgressCard } from './shared/RollProgressCard';
import { FlaggerNotesSection } from './shared/FlaggerNotesSection';
import { NextRollPicker } from './shared/NextRollPicker';
import { WeatherModal } from './shared/WeatherModal';
import { VideoUploadButton } from './shared/VideoUploadButton';
import type { RoleView } from '../config/roles';

function PusherHome() {
  const navigate = useNavigate();
  const weather = useAppStore((s) => s.weather);
  const records = useAppStore((s) => s.records);
  const fetchWeather = useAppStore((s) => s.fetchWeather);
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  useEffect(() => {
    void fetchWeather();
    const interval = setInterval(() => {
      void fetchWeather();
    }, WEATHER.pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return (
    <div className="relative">
      <WeatherModal open={showWeatherModal} onClose={() => setShowWeatherModal(false)} />

      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      <BlockHeader className="!mt-8">Weather</BlockHeader>
      <List strong inset>
        <ListItem
          link
          header="Conditions"
          title={`${weather.temp} · ${weather.wind} · ${weather.humidity}`}
          onClick={() => setShowWeatherModal(true)}
          media={
            <Icon
              ios={<Thermometer className="w-6 h-6 text-red-500" />}
              material={<MdThermostat className="w-6 h-6 text-red-500" />}
            />
          }
          after={
            <span className="flex items-center gap-3">
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

      <NextRollPicker />

      <BlockHeader>Select your location</BlockHeader>
      <List strong inset>
        {STATIONS.map((station) => {
          const isRecorded = records[station.id] != null;
          return (
            <ListItem
              key={station.id}
              link
              title={station.name}
              subtitle={station.label}
              onClick={() => navigate(`/timing/${station.id}`)}
              media={
                isRecorded ? (
                  <Icon
                    ios={<Checkmark className="w-5 h-5 text-primary" />}
                    material={<MdCheck className="w-5 h-5 text-primary" />}
                  />
                ) : undefined
              }
              className={isRecorded ? 'text-primary' : undefined}
            />
          );
        })}
      </List>

      <Block>
        <VideoUploadButton />
      </Block>
    </div>
  );
}

function MechanicHome() {
  const rollActive = useAppStore((s) => s.rollActive);
  const snapshot = useAppStore((s) => s.rollConfigSnapshot);
  const rollNotes = useAppStore((s) => s.rollNotes);

  return (
    <div className="relative">
      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      {rollActive && snapshot && (
        <>
          <BlockHeader className="!mt-8">On the course</BlockHeader>
          <List strong inset>
            <ListItem title="Driver" after={snapshot.driver || 'Not set'} />
            <ListItem title="Buggy" after={snapshot.buggy || 'Not set'} />
            {snapshot.pushers.map((p, i) => (
              <ListItem key={i} title={`Pusher H${i + 1}`} after={p || 'Not set'} />
            ))}
          </List>
        </>
      )}

      <NextRollPicker />

      {rollActive && rollNotes ? (
        <>
          <BlockHeader>Roll notes</BlockHeader>
          <Block strong inset>
            <p className="text-sm">{rollNotes}</p>
          </Block>
        </>
      ) : null}
    </div>
  );
}

function TrendSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="var(--k-color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DriverHome() {
  const navigate = useNavigate();
  const rollActive = useAppStore((s) => s.rollActive);
  const isFinished = useAppStore((s) => s.isFinished);
  const records = useAppStore((s) => s.records);
  const config = useAppStore((s) => s.rollConfigSnapshot ?? s.config);
  const displayName = useAppStore((s) => s.displayName);
  const savedRolls = useAppStore((s) => s.savedRolls);

  const splits = (rollActive && isFinished) ? computeSplits(records, config) : [];

  const myRolls = savedRolls
    .filter((r) =>
      r.driver.toLowerCase() === displayName.toLowerCase()
      && r.totalMs > 0
      && r.originStation !== 'h1h2')
    .sort((a, b) => b.startTimeMs - a.startTimeMs)
    .slice(0, 10);

  const recentTwo = myRolls.slice(0, 2);
  const trendValues = myRolls.map((r) => r.totalMs).reverse();

  return (
    <div className="relative">
      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      <BlockTitle className="!mt-6">
        <span className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">View only</span>
      </BlockTitle>

      {splits.length > 0 && (
        <>
          <BlockHeader className="!mt-4">Split times</BlockHeader>
          <List strong inset>
            {splits.map((s, i) => (
              <ListItem
                key={i}
                title={s.label}
                subtitle={s.pusher}
                after={<span className="font-mono">{s.time}</span>}
              />
            ))}
          </List>
        </>
      )}

      {myRolls.length > 0 && (
        <>
          <BlockHeader className="!mt-6">My recent rolls</BlockHeader>
          <List strong inset>
            {myRolls.slice(0, 5).map((r) => (
              <ListItem
                key={r.id}
                link
                title={`${r.buggy} · ${r.dateDisplay}`}
                after={<span className="font-mono text-primary">{r.total}</span>}
                onClick={() => navigate(`/history/${r.id}`)}
              />
            ))}
          </List>
        </>
      )}

      {recentTwo.length === 2 && (
        <>
          <BlockHeader className="!mt-4">Last vs. previous</BlockHeader>
          <Block strong inset className="!p-0 overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold text-[var(--app-fg-muted)] px-4 pt-3 pb-1">
              <span>Hill</span>
              <span className="text-center">{recentTwo[0].dateDisplay}</span>
              <span className="text-right">{recentTwo[1].dateDisplay}</span>
            </div>
            {recentTwo[0].splits.map((s, i) => {
              const prev = recentTwo[1].splits[i];
              const delta = s.splitMs > 0 && prev?.splitMs > 0 ? s.splitMs - prev.splitMs : null;
              return (
                <div key={i} className="grid grid-cols-3 px-4 py-2 border-t border-[var(--app-border)]">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-center font-mono text-sm">{s.time}</span>
                  <span className="text-right">
                    <span className="font-mono text-sm">{prev?.time ?? '--'}</span>
                    {delta !== null && (
                      <span className={`ml-1 text-xs ${delta < 0 ? 'text-green-500' : delta > 0 ? 'text-red-400' : ''}`}>
                        {delta > 0 ? '+' : ''}{formatTime(Math.abs(delta))}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </Block>
        </>
      )}

      {trendValues.length >= 2 && (
        <>
          <BlockHeader className="!mt-4">Total time trend</BlockHeader>
          <Block strong inset>
            <TrendSparkline values={trendValues} />
            <div className="flex justify-between text-xs text-[var(--app-fg-muted)] mt-1">
              <span>{formatTime(trendValues[0])}</span>
              <span>{formatTime(trendValues[trendValues.length - 1])}</span>
            </div>
          </Block>
        </>
      )}
    </div>
  );
}

function FlaggerHome() {
  const navigate = useNavigate();
  const records = useAppStore((s) => s.records);
  const rollActive = useAppStore((s) => s.rollActive);
  const flaggerNotes = useAppStore((s) => s.flaggerNotes);
  const addFlaggerNote = useAppStore((s) => s.addFlaggerNote);

  return (
    <div className="relative">
      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      <BlockHeader className="!mt-8">Stations</BlockHeader>
      <List strong inset>
        {STATIONS.map((station) => {
          const isRecorded = records[station.id] != null;
          return (
            <ListItem
              key={station.id}
              link
              title={station.name}
              subtitle={station.label}
              onClick={() => navigate(`/timing/${station.id}`)}
              media={
                isRecorded ? (
                  <Icon
                    ios={<Checkmark className="w-5 h-5 text-primary" />}
                    material={<MdCheck className="w-5 h-5 text-primary" />}
                  />
                ) : undefined
              }
              className={isRecorded ? 'text-primary' : undefined}
            />
          );
        })}
      </List>

      <Block className="!mt-4">
        <FlaggerNotesSection
          notes={flaggerNotes}
          onAdd={rollActive ? addFlaggerNote : undefined}
          readOnly={!rollActive}
        />
      </Block>
    </div>
  );
}

function GeneralHome() {
  return (
    <div className="relative">
      <Block className="!mt-4 !mb-0">
        <RollProgressCard />
      </Block>

      <BlockTitle className="!mt-6">
        <span className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">View only</span>
      </BlockTitle>
    </div>
  );
}

const HOME_BY_ROLE: Record<RoleView, React.ComponentType> = {
  pusher: PusherHome,
  mechanic: MechanicHome,
  driver: DriverHome,
  flagger: FlaggerHome,
  general: GeneralHome,
};

export default function Home() {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const HomeView = HOME_BY_ROLE[activeRoleView] ?? GeneralHome;
  return <HomeView />;
}
