/**
 * Visual reference lab for Timing chrome. Production Timing lives at `/` (Home)
 * inside Layout — keep this route for side-by-side layout experiments only.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  App,
  Block,
  BlockHeader,
  Card,
  Icon,
  Link,
  List,
  ListItem,
  Navbar,
  Page,
  Segmented,
  SegmentedButton,
  Sheet,
  Tabbar,
  TabbarLink,
  Toggle,
  ToolbarPane,
} from 'konsta/react';
import {
  DropFill,
  GearAlt,
  Thermometer,
  Timer as TimerIcon,
  Wind,
  DocPlaintext,
} from 'framework7-icons/react';
import {
  MdAir,
  MdAssignment,
  MdSettings,
  MdThermostat,
  MdTimer,
  MdWaterDrop,
} from 'react-icons/md';
import { HILL_LABELS } from '../config/app.config';
import { resolveKonstaTheme } from '../lib/platformTheme';

const MOCK = {
  elapsed: '0:42.18',
  driver: 'Jordan Lee',
  buggy: 'Inviscid',
  weather: {
    temp: '54°F',
    wind: '8 mph',
    humidity: '62%',
  },
  pushers: [
    { hill: 'H1', name: 'Sam Chen' },
    { hill: 'H2', name: 'Riley Park' },
    { hill: 'H3', name: 'Casey Morgan' },
    { hill: 'H4', name: 'Avery Quinn' },
    { hill: 'H5', name: 'Jamie Brooks' },
  ],
  recordedHills: ['H1', 'H2'] as readonly string[],
} as const;

type ThemeOption = 'dark' | 'system' | 'light';

const THEME_OPTIONS: { id: ThemeOption; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
];

export default function SandboxHUD() {
  const [searchParams] = useSearchParams();
  const konstaTheme = resolveKonstaTheme(searchParams);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [directToLogs, setDirectToLogs] = useState(true);
  const [activeTab, setActiveTab] = useState<'timing' | 'assign' | 'logs'>('timing');

  return (
    <App theme={konstaTheme} dark safeAreas className="h-dvh overflow-hidden">
      <Page className="bg-black select-none text-white h-dvh overflow-hidden flex flex-col">
        <Navbar
          className="top-0 sticky z-20 shrink-0"
          title="Sandbox HUD"
          right={
            <Link
              iconOnly
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              <Icon
                ios={<GearAlt className="w-6 h-6 text-primary" />}
                material={<MdSettings className="w-6 h-6 text-primary" />}
              />
            </Link>
          }
        />

        <div className="overflow-y-auto flex-1 pb-28">
          <Block className="!mt-4 !mb-0">
            <Card raised className="!m-0 overflow-hidden" contentWrapPadding="p-5">
              <p className="text-sm font-semibold text-primary text-center mb-3">
                Roll progress
              </p>
              <p className="text-sm text-white/55 font-medium text-center mb-3">
                {MOCK.driver} · {MOCK.buggy}
              </p>
              <p className="text-3xl font-mono font-bold text-center tracking-tight">
                {MOCK.elapsed}
              </p>
              <Segmented strong className="w-full mt-6">
                {HILL_LABELS.map((hill) => (
                  <SegmentedButton
                    key={hill}
                    active={MOCK.recordedHills.includes(hill)}
                  >
                    {hill}
                  </SegmentedButton>
                ))}
              </Segmented>
            </Card>
          </Block>

          <BlockHeader className="!mt-8">Weather</BlockHeader>
          <List strong inset>
            <ListItem
              link
              header="Conditions"
              title={`${MOCK.weather.temp} · ${MOCK.weather.wind} · ${MOCK.weather.humidity}`}
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

          <BlockHeader>Roll configuration</BlockHeader>
          <List strong inset>
            <ListItem header="Driver" title={MOCK.driver} />
            <ListItem header="Buggy" title={MOCK.buggy} />
          </List>

          <BlockHeader>Hill pushers (H1–H5)</BlockHeader>
          <List strong inset>
            {MOCK.pushers.map((pusher) => (
              <ListItem
                key={pusher.hill}
                header={`Pusher ${pusher.hill}`}
                title={pusher.name}
              />
            ))}
          </List>
        </div>

        <Tabbar labels icons className="left-0 bottom-0 fixed z-20">
          <ToolbarPane>
            <TabbarLink
              className="flex-1"
              active={activeTab === 'timing'}
              onClick={() => setActiveTab('timing')}
              icon={
                <Icon
                  ios={<TimerIcon className="w-7 h-7" />}
                  material={<MdTimer className="w-6 h-6" />}
                />
              }
              label="Timing"
            />
            <TabbarLink
              className="flex-1"
              active={activeTab === 'assign'}
              onClick={() => setActiveTab('assign')}
              icon={
                <Icon
                  ios={<DocPlaintext className="w-7 h-7" />}
                  material={<MdAssignment className="w-6 h-6" />}
                />
              }
              label="Assign"
            />
            <TabbarLink
              className="flex-1"
              active={activeTab === 'logs'}
              onClick={() => setActiveTab('logs')}
              icon={
                <Icon
                  ios={<DocPlaintext className="w-7 h-7" />}
                  material={<MdAssignment className="w-6 h-6" />}
                />
              }
              label="Logs"
            />
          </ToolbarPane>
        </Tabbar>

        <Sheet
          opened={settingsOpen}
          backdrop
          onBackdropClick={() => setSettingsOpen(false)}
          className="pb-safe max-h-[85vh] flex flex-col"
        >
          <Navbar
            title="Settings"
            right={<Link onClick={() => setSettingsOpen(false)}>Close</Link>}
            className="!relative shrink-0"
          />

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-safe flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-3">
              <BlockHeader className="!my-0 !mx-0 !px-0">Appearance</BlockHeader>
              <Segmented strong rounded>
                {THEME_OPTIONS.map(({ id, label }) => (
                  <SegmentedButton
                    key={id}
                    active={theme === id}
                    onClick={() => setTheme(id)}
                  >
                    {label}
                  </SegmentedButton>
                ))}
              </Segmented>
            </div>

            <List strong className="!my-0 overflow-hidden rounded-2xl">
              <ListItem
                title="Direct to Logs from roll summary"
                after={
                  <Toggle
                    checked={directToLogs}
                    onChange={() => setDirectToLogs((v) => !v)}
                  />
                }
              />
            </List>
          </div>
        </Sheet>
      </Page>
    </App>
  );
}
