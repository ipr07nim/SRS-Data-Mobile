import { PUSHER_COUNT, STATIONS } from '../config/app.config';
import type { AppTheme } from '../store';
import type { RollConfig, StationRecords } from '../domain/types';
import { createEmptyRecords } from '../domain/timing';

export const PERSIST_VERSION = 1;

const THEME_SESSION_KEY = 'srs-theme';

function normalizePushers(pushers: unknown): string[] {
  if (!Array.isArray(pushers)) {
    return Array.from({ length: PUSHER_COUNT }, () => '');
  }
  const list = pushers.map((p) => (typeof p === 'string' ? p : ''));
  while (list.length < PUSHER_COUNT) list.push('');
  return list.slice(0, PUSHER_COUNT);
}

function normalizeRecords(records: unknown): StationRecords {
  const empty = createEmptyRecords();
  if (!records || typeof records !== 'object') return empty;
  const raw = records as Record<string, unknown>;
  for (const station of STATIONS) {
    const v = raw[station.id];
    empty[station.id] = typeof v === 'number' ? v : null;
  }
  return empty;
}

function normalizeConfig(config: unknown): RollConfig {
  if (!config || typeof config !== 'object') {
    return { driver: '', buggy: 'Inviscid', pushers: normalizePushers([]) };
  }
  const c = config as Record<string, unknown>;
  return {
    driver: typeof c.driver === 'string' ? c.driver : '',
    buggy: typeof c.buggy === 'string' ? c.buggy : 'Inviscid',
    pushers: normalizePushers(c.pushers),
  };
}

function normalizeTheme(theme: unknown): AppTheme {
  if (theme === 'dark' || theme === 'light' || theme === 'system') return theme;
  return 'system';
}

/** @deprecated localStorage persist removed; kept for migrate helpers if needed */
export function normalizePersistedState(
  persisted: unknown,
  version: number,
): Record<string, unknown> {
  let state: Record<string, unknown>;

  if (persisted && typeof persisted === 'object' && 'state' in persisted) {
    const envelope = persisted as { state?: Record<string, unknown> };
    state = { ...(envelope.state ?? {}) };
  } else if (persisted && typeof persisted === 'object') {
    state = { ...(persisted as Record<string, unknown>) };
  } else {
    return {};
  }

  if (version < 1) {
    state.config = normalizeConfig(state.config);
    state.records = normalizeRecords(state.records);
    state.theme = normalizeTheme(state.theme);
  }

  state.config = normalizeConfig(state.config);
  state.records = normalizeRecords(state.records);
  state.theme = normalizeTheme(state.theme);

  return state;
}

/** Apply theme from session cache before React paints (no localStorage roll data). */
export function buildThemeBootstrapScript(): string {
  return `(function(){try{var t=sessionStorage.getItem(${JSON.stringify(THEME_SESSION_KEY)});var d=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var x=t==='light'?'light':t==='dark'?'dark':d;document.documentElement.setAttribute('data-theme',x);document.documentElement.classList.toggle('dark',x==='dark');}catch(e){}})();`;
}
