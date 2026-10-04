import type { HillLabel, OriginStation, StationId } from '../config/app.config';

export type LeaderboardHill = HillLabel | 'all';
import type { FlaggerNote, RollConfig, RollVideoAttachment, StationRecords } from './types';
import { computeSplits, computeTotalElapsedMs, formatTime, parseFormattedTime } from './timing';
import type { WeatherSnapshot } from './weather';

export interface SavedRollSplit {
  label: string;
  time: string;
  pusher: string;
  splitMs: number;
}

export interface LeaderboardEntry {
  rank: number;
  rollId: string;
  /** Hill pusher for this split */
  name: string;
  driver: string;
  buggy: string;
  time: string;
  timeMs: number;
  date: string;
  timeDisplay: string;
}

export function formatDriverBuggy(driver: string, buggy: string): string {
  const d = driver.trim() || 'Unknown';
  return `${d} · ${buggy}`;
}

export function formatPusherDriver(pusher: string, driver: string): string {
  const p = pusher.trim() || 'Unknown';
  const d = driver.trim() || 'Unknown';
  return `${p} · ${d}`;
}

export interface SavedRoll {
  id: string;
  startTimeMs: number;
  dateDisplay: string;
  timeDisplay: string;
  driver: string;
  buggy: string;
  total: string;
  totalMs: number;
  weather: WeatherSnapshot;
  splits: SavedRollSplit[];
  notes: string;
  flaggerNotes: FlaggerNote[];
  unreliableStations: StationId[];
  exportedAt: number;
  video?: RollVideoAttachment | null;
  videoUrl?: string | null;
  /** Omitted for legacy rows; set when loaded from Supabase. */
  status?: 'active' | 'completed' | 'cancelled';
  /** 'h1h2' when Hill 1 was skipped; the total then covers Hills 2-5 only. */
  originStation?: OriginStation;
  /** The SRS plan entry this roll was timed for, when known. */
  srsRollDate?: string | null;
  srsRollNumber?: number | null;
  srsBuggyId?: number | null;
}

export type RollSortField = 'date' | 'total';

export interface RollListFilters {
  driverQuery: string;
  buggy: string;
  sortBy: RollSortField;
}

function formatDateDisplay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

function formatTimeDisplay(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSavedRollFromActive(params: {
  startTime: number;
  config: RollConfig;
  records: StationRecords;
  weather: WeatherSnapshot;
  notes: string;
  flaggerNotes?: FlaggerNote[];
  unreliableStations: StationId[];
  video?: RollVideoAttachment | null;
}): SavedRoll {
  const { startTime, config, records, weather, notes, flaggerNotes, unreliableStations, video } = params;
  const splits = computeSplits(records, config);
  const totalMs = computeTotalElapsedMs(records);

  return {
    id: `roll-${startTime}-${Date.now()}`,
    startTimeMs: startTime,
    dateDisplay: formatDateDisplay(startTime),
    timeDisplay: formatTimeDisplay(startTime),
    driver: config.driver || 'Unknown',
    buggy: config.buggy,
    total: totalMs > 0 ? formatTime(totalMs) : '--:--.--',
    totalMs,
    weather: { ...weather },
    splits: splits.map((s) => ({
      label: s.label,
      time: s.time,
      pusher: s.pusher,
      splitMs: parseFormattedTime(s.time),
    })),
    notes,
    flaggerNotes: flaggerNotes ?? [],
    unreliableStations: [...unreliableStations],
    exportedAt: Date.now(),
    video: video ?? null,
  };
}

export function filterAndSortRolls(
  rolls: SavedRoll[],
  filters: RollListFilters,
): SavedRoll[] {
  let result = [...rolls];

  const q = filters.driverQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((r) => r.driver.toLowerCase().includes(q));
  }

  if (filters.buggy && filters.buggy !== 'all') {
    result = result.filter((r) => r.buggy === filters.buggy);
  }

  if (filters.sortBy === 'date') {
    result.sort((a, b) => b.startTimeMs - a.startTimeMs);
  } else {
    result.sort((a, b) => {
      if (a.totalMs <= 0 && b.totalMs <= 0) return b.startTimeMs - a.startTimeMs;
      if (a.totalMs <= 0) return 1;
      if (b.totalMs <= 0) return -1;
      return a.totalMs - b.totalMs;
    });
  }

  return result;
}

function sortLeaderboardEntries(
  entries: Omit<LeaderboardEntry, 'rank'>[],
): LeaderboardEntry[] {
  entries.sort((a, b) => {
    const aUnknown = !Number.isFinite(a.timeMs);
    const bUnknown = !Number.isFinite(b.timeMs);
    if (aUnknown && bUnknown) return 0;
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    return a.timeMs - b.timeMs;
  });
  return entries.slice(0, 5).map((e, i) => ({ ...e, rank: i + 1 }));
}

export function buildLeaderboardFromRolls(
  rolls: SavedRoll[],
  hill: LeaderboardHill,
  buggyFilter = 'all',
): LeaderboardEntry[] {
  if (hill === 'all') {
    const entries: Omit<LeaderboardEntry, 'rank'>[] = [];
    for (const roll of rolls) {
      if (buggyFilter !== 'all' && roll.buggy !== buggyFilter) continue;
      const isUnknown = roll.totalMs <= 0;
      entries.push({
        rollId: roll.id,
        name: '',
        driver: roll.driver,
        buggy: roll.buggy,
        time: roll.total,
        timeMs: isUnknown ? Number.POSITIVE_INFINITY : roll.totalMs,
        date: roll.dateDisplay,
        timeDisplay: roll.timeDisplay,
      });
    }
    return sortLeaderboardEntries(entries);
  }

  const entries: Omit<LeaderboardEntry, 'rank'>[] = [];

  for (const roll of rolls) {
    if (buggyFilter !== 'all' && roll.buggy !== buggyFilter) continue;
    const split = roll.splits.find((s) => s.label === hill);
    if (!split) continue;
    const isUnknown = split.splitMs < 0;
    entries.push({
      rollId: roll.id,
      name: split.pusher,
      driver: roll.driver,
      buggy: roll.buggy,
      time: split.time,
      timeMs: isUnknown ? Number.POSITIVE_INFINITY : split.splitMs,
      date: roll.dateDisplay,
      timeDisplay: roll.timeDisplay,
    });
  }

  return sortLeaderboardEntries(entries);
}

function seedSplit(label: string, time: string, pusher: string): SavedRollSplit {
  return { label, time, pusher, splitMs: parseFormattedTime(time) };
}

export function buildManualVideoUploadMailto(supportEmail: string): string {
  const subject = encodeURIComponent('Spirit Timing — Manual roll video upload');
  const body = encodeURIComponent(
    'I have a roll video to upload manually. Roll description (driver, buggy, date/time, hills, etc.):\n\n',
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

export function buildBugReportMailto(supportEmail: string): string {
  const subject = encodeURIComponent('Spirit Timing Bug Report');
  const body = encodeURIComponent(
    'Describe the bug you encountered:\n\nDevice / browser:\nSteps to reproduce:\n',
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

export function buildRollRequestMailto(
  roll: SavedRoll,
  requestType: 'modification' | 'deletion',
  supportEmail: string,
): string {
  const subject = encodeURIComponent(
    `SRS Roll ${requestType === 'deletion' ? 'Deletion' : 'Modification'} Request — ${roll.id}`,
  );
  const body = encodeURIComponent(
    `Request type: ${requestType}\nRoll ID: ${roll.id}\nDate: ${roll.dateDisplay}\nTime: ${roll.timeDisplay}\nDriver: ${roll.driver}\nBuggy: ${roll.buggy}\nTotal: ${roll.total}\n\nPlease describe the change needed:\n`,
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

export const SEED_ROLLS: SavedRoll[] = [
  {
    id: 'seed-1',
    startTimeMs: new Date('2026-05-14T15:12:00').getTime(),
    dateDisplay: '05/14/26',
    timeDisplay: '03:12 PM',
    driver: 'Alex Chen',
    buggy: 'Inviscid',
    total: '0:41.15',
    totalMs: 41150,
    weather: { temp: '64°F', wind: '4.1 mph SW', humidity: '58%' },
    splits: [
      seedSplit('H1', '0:08.12', 'Sarah L.'),
      seedSplit('H2', '0:08.20', 'Mike D.'),
      seedSplit('H3', '0:08.15', 'Jordan T.'),
      seedSplit('H4', '0:08.44', 'Chris W.'),
      seedSplit('H5', '0:08.24', 'Elena R.'),
    ],
    notes: '',
    flaggerNotes: [],
    unreliableStations: [],
    exportedAt: new Date('2026-05-14T15:12:00').getTime(),
  },
  {
    id: 'seed-2',
    startTimeMs: new Date('2026-05-14T14:45:00').getTime(),
    dateDisplay: '05/14/26',
    timeDisplay: '02:45 PM',
    driver: 'Elena Rodriguez',
    buggy: 'Seraph',
    total: '0:42.38',
    totalMs: 42380,
    weather: { temp: '65°F', wind: '3.8 mph SW', humidity: '56%' },
    splits: [
      seedSplit('H1', '0:08.45', 'Sam V.'),
      seedSplit('H2', '0:08.55', 'Tina F.'),
      seedSplit('H3', '0:08.30', 'Liam N.'),
      seedSplit('H4', '0:08.62', 'Maya B.'),
      seedSplit('H5', '0:08.46', 'Oscar G.'),
    ],
    notes: '',
    flaggerNotes: [],
    unreliableStations: [],
    exportedAt: new Date('2026-05-14T14:45:00').getTime(),
  },
  {
    id: 'seed-3',
    startTimeMs: new Date('2026-05-13T06:28:00').getTime(),
    dateDisplay: '05/13/26',
    timeDisplay: '06:28 AM',
    driver: 'Jordan Smith',
    buggy: 'Kingpin',
    total: '0:43.12',
    totalMs: 43120,
    weather: { temp: '58°F', wind: '6 mph NW', humidity: '62%' },
    splits: [
      seedSplit('H1', '0:08.50', 'Chris W.'),
      seedSplit('H2', '0:08.70', 'Dana K.'),
      seedSplit('H3', '0:08.40', 'Elena R.'),
      seedSplit('H4', '0:08.90', 'Frank P.'),
      seedSplit('H5', '0:08.62', 'Grace H.'),
    ],
    notes: 'Early morning roll, light wind.',
    flaggerNotes: [],
    unreliableStations: [],
    exportedAt: new Date('2026-05-13T06:28:00').getTime(),
  },
  {
    id: 'seed-4',
    startTimeMs: new Date('2026-05-12T15:05:00').getTime(),
    dateDisplay: '05/12/26',
    timeDisplay: '03:05 PM',
    driver: 'Sam Rivera',
    buggy: 'Zuke',
    total: '0:40.88',
    totalMs: 40880,
    weather: { temp: '70°F', wind: '2 mph S', humidity: '55%' },
    splits: [
      seedSplit('H1', '0:07.90', 'Hannah L.'),
      seedSplit('H2', '0:08.10', 'Ivan M.'),
      seedSplit('H3', '0:08.05', 'Jade N.'),
      seedSplit('H4', '0:08.48', 'Kyle O.'),
      seedSplit('H5', '0:08.35', 'Luna P.'),
    ],
    notes: '',
    flaggerNotes: [],
    unreliableStations: ['h3h4'],
    exportedAt: new Date('2026-05-12T15:05:00').getTime(),
  },
  {
    id: 'seed-5',
    startTimeMs: new Date('2026-05-11T14:20:00').getTime(),
    dateDisplay: '05/11/26',
    timeDisplay: '02:20 PM',
    driver: 'Maya Brooks',
    buggy: 'Inviscid',
    total: '0:41.50',
    totalMs: 41500,
    weather: { temp: '68°F', wind: '5 mph W', humidity: '54%' },
    splits: [
      seedSplit('H1', '0:08.20', 'Noah Q.'),
      seedSplit('H2', '0:08.30', 'Olivia R.'),
      seedSplit('H3', '0:08.25', 'Paul S.'),
      seedSplit('H4', '0:08.55', 'Quinn T.'),
      seedSplit('H5', '0:08.20', 'Riley U.'),
    ],
    notes: '',
    flaggerNotes: [],
    unreliableStations: [],
    exportedAt: new Date('2026-05-11T14:20:00').getTime(),
  },
  {
    id: 'seed-6',
    startTimeMs: new Date('2026-05-10T06:35:00').getTime(),
    dateDisplay: '05/10/26',
    timeDisplay: '06:35 AM',
    driver: 'Chris Wu',
    buggy: 'Seraph',
    total: '0:42.05',
    totalMs: 42050,
    weather: { temp: '55°F', wind: '7 mph NE', humidity: '68%' },
    splits: [
      seedSplit('H1', '0:08.35', 'Sara V.'),
      seedSplit('H2', '0:08.45', 'Tom W.'),
      seedSplit('H3', '0:08.30', 'Uma X.'),
      seedSplit('H4', '0:08.50', 'Vic Y.'),
      seedSplit('H5', '0:08.45', 'Wren Z.'),
    ],
    notes: 'Cold morning.',
    flaggerNotes: [],
    unreliableStations: [],
    exportedAt: new Date('2026-05-10T06:35:00').getTime(),
  },
];
