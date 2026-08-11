/**
 * Single source of truth for course layout, baselines, and static app metadata.
 * Client-only: no server loaders; safe to read offline after first load.
 */

export const STATIONS = [
  { id: 'start', name: 'Start', label: 'Tap to START' },
  { id: 'h1h2', name: 'H1-H2', label: 'H1-H2 Transition' },
  { id: 'h2h3', name: 'H2-H3', label: 'H2-H3 Transition' },
  { id: 'h3h4', name: 'H3-H4', label: 'H3-H4 Transition' },
  { id: 'h4h5', name: 'H4-H5', label: 'H4-H5 Transition' },
  { id: 'finish', name: 'Finish', label: 'Finish Line' },
] as const;

export type StationId = (typeof STATIONS)[number]['id'];

export function isStationId(id: string): id is StationId {
  return STATIONS.some((s) => s.id === id);
}

export const HILL_LABELS = ['H1', 'H2', 'H3', 'H4', 'H5'] as const;
export type HillLabel = (typeof HILL_LABELS)[number];

export const HILL_LABEL_TO_STATION: Record<HillLabel, StationId> = {
  H1: 'h1h2',
  H2: 'h2h3',
  H3: 'h3h4',
  H4: 'h4h5',
  H5: 'finish', // last split is recorded at finish station
};

export const HILL_AVERAGES: Record<HillLabel, string> = {
  H1: '0:10.25',
  H2: '0:12.35',
  H3: '0:11.20',
  H4: '0:13.55',
  H5: '0:12.40',
};

export const BUGGY_OPTIONS = [
  'Inviscid',
  'Kingpin',
  'Seraph',
  'Zuke',
] as const;

export type BuggyName = (typeof BUGGY_OPTIONS)[number];

export const DEFAULT_BUGGY: BuggyName = 'Inviscid';

export const PUSHER_COUNT = HILL_LABELS.length;

export const WEATHER = {
  latitude: 40.44014,
  longitude: -79.94529,
  locationName: 'Schenley Park',
  pollIntervalMs: 60_000,
  /** `current=` returns analyzed now-cast conditions at the pin (not a future hourly forecast). */
  apiUrl:
    'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=0&past_days=0',
} as const;

export const STORAGE_KEY = 'srs-storage';

/** Placeholder — update with real SRS Data support address */
export const SUPPORT_EMAIL = 'srsdata@example.com';

export const UNDO_WINDOW_MS = 3000;

/** Max video size for client-side roll attachment (localStorage persist). */
export const MAX_ROLL_VIDEO_BYTES = 20 * 1024 * 1024;
