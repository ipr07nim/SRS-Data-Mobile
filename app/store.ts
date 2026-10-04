import { create } from 'zustand';
import {
  BUGGY_OPTIONS,
  DEFAULT_BUGGY,
  PUSHER_COUNT,
  isStationId,
} from './config/app.config';
import type { OriginStation, StationId } from './config/app.config';
import type { BuggyName } from './config/app.config';
import type { SavedRoll, LeaderboardEntry, LeaderboardHill } from './domain/rolls';
import {
  createEmptyRecords,
  originStationOf,
  splitCount,
  stationAction,
} from './domain/timing';
import {
  buildWeatherApiUrl,
  parseWeatherResponse,
  WEATHER_ERROR,
  WEATHER_PLACEHOLDER,
  type WeatherSnapshot,
} from './domain/weather';
import type { FlaggerNote, RollConfig, RollVideoAttachment, StationRecords } from './domain/types';
import type { NextRollPick } from './domain/planView';
import type { RoleView } from './config/roles';
import { isSupabaseConfigured, subscribeToRollTaps, subscribeToTable } from './lib/supabase';
import { startClockSync } from './lib/serverClock';
import { parseRollId, normalizeFlaggerNotes } from './services/supabase/mappers';
import * as rollsApi from './services/supabase/rolls';
import * as tapsApi from './services/supabase/taps';
import * as settingsApi from './services/supabase/settings';
import * as leaderboardApi from './services/supabase/leaderboard';
import type { DbRollRow } from './services/supabase/types';
import type { SrsRollLink } from './services/supabase/rolls';
import { usePlanStore } from './store/planStore';
import { resolveNextRoll } from './store/nextRoll';
import type { ActiveRollForPlan } from './store/nextRoll';

let weatherAbort: AbortController | null = null;
let weatherFetchGeneration = 0;
let notesSyncTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let loadSeq = 0;
let loadTimer: ReturnType<typeof setTimeout> | null = null;

const PENDING_TAPS_KEY = 'srs-pending-taps';
const ACTIVE_POLL_MS = 10_000;
const FLUSH_RETRY_MS = 2_000;
const OPEN_MAX_ATTEMPTS = 30;
const SETUP_HINT = 'Supabase is missing the phone sync setup. Run supabase/phone_sync.sql.';

export type { RollConfig, StationRecords };
export type { RoleView } from './config/roles';
export type AppTheme = 'dark' | 'light' | 'system';
export { STATIONS, HILL_AVERAGES } from './config/app.config';
export type { StationId, HillLabel } from './config/app.config';
export type { SavedRoll } from './domain/rolls';

export type InitStatus = 'idle' | 'loading' | 'ready' | 'error';
export type LoadStatus = 'idle' | 'loading' | 'ready';

/** A tap that has a time but has not reached Supabase yet. Kept across reloads. */
export interface PendingTap {
  rollId: number;
  stationId: StationId;
  serverMs: number;
}

export interface AppState {
  initStatus: InitStatus;
  initError: string | null;
  rollsLoadStatus: LoadStatus;
  leaderboardLoadStatus: LoadStatus;
  displayName: string;
  rollActive: boolean;
  activeRollDbId: number | null;
  activeOrigin: OriginStation | null;
  activeSrs: SrsRollLink | null;
  rollConfigSnapshot: RollConfig | null;
  /** Shared-clock ms of the roll's origin tap. */
  startTime: number | null;
  isFinished: boolean;
  /** True while this phone is starting a roll (the tap time is already fixed). */
  opening: boolean;
  syncError: string | null;
  pendingTaps: PendingTap[];
  nextRollPick: NextRollPick | null;
  weather: WeatherSnapshot;
  fetchWeather: () => Promise<void>;
  /** Typed-in setup for the next roll, used when the SRS plan is unavailable. */
  config: RollConfig;
  records: StationRecords;
  rollNotes: string;
  flaggerNotes: FlaggerNote[];
  rollVideo: RollVideoAttachment | null;
  unreliableStations: Partial<Record<StationId, true>>;
  savedRolls: SavedRoll[];
  leaderboardByKey: Record<string, LeaderboardEntry[]>;
  leaderboardComputedAt: string | null;
  lastViewedRollId: string | null;
  highlightLogsOnNextList: boolean;
  activeRoleView: RoleView;
  theme: AppTheme;
  directToLogsFromRollSummary: boolean;
  tapSubscription: { unsubscribe: () => void } | null;
  tableSubscriptions: { unsubscribe: () => void }[];
  hydrate: () => Promise<void>;
  refreshSavedRolls: () => Promise<void>;
  loadActiveRoll: () => Promise<void>;
  loadLeaderboard: (hill: LeaderboardHill, buggy: string) => Promise<void>;
  setDisplayName: (name: string) => void;
  setActiveRoleView: (view: RoleView) => void;
  setNextRollPick: (pick: NextRollPick | null) => void;
  setTheme: (theme: AppTheme) => void;
  setDirectToLogsFromRollSummary: (value: boolean) => void;
  /** A tap at a station, with the shared-clock time captured at the press. */
  tapStation: (stationId: StationId, tapMs: number) => Promise<void>;
  undoRecord: (stationId: StationId) => Promise<void>;
  resetRoll: () => Promise<void>;
  setConfig: (config: RollConfig) => void;
  setRollNotes: (notes: string) => void;
  addFlaggerNote: (text: string) => void;
  setRollVideo: (video: RollVideoAttachment | null) => void;
  flagStationUnreliable: (stationId: StationId) => void;
  clearStationUnreliable: (stationId: StationId) => void;
  toggleStationUnreliable: (stationId: StationId) => void;
  exportRoll: () => Promise<void>;
  updateSavedRollNotes: (id: string, notes: string) => Promise<void>;
  setLastViewedRollId: (id: string | null) => void;
  setHighlightLogsOnNextList: (value: boolean) => void;
  deleteSavedRoll: (id: string) => Promise<void>;
}

const emptyPushers = () => Array.from({ length: PUSHER_COUNT }, () => '');

const defaultConfig = (): RollConfig => ({
  driver: '',
  buggy: DEFAULT_BUGGY,
  pushers: emptyPushers(),
});

const resetActiveRollState = {
  rollActive: false,
  activeRollDbId: null as number | null,
  activeOrigin: null as OriginStation | null,
  activeSrs: null as SrsRollLink | null,
  rollConfigSnapshot: null as RollConfig | null,
  startTime: null as number | null,
  isFinished: false,
  rollNotes: '',
  flaggerNotes: [] as FlaggerNote[],
  rollVideo: null as RollVideoAttachment | null,
  unreliableStations: {} as Partial<Record<StationId, true>>,
  records: createEmptyRecords(),
};

function normalizeBuggy(buggy: string): BuggyName {
  return (BUGGY_OPTIONS as readonly string[]).includes(buggy)
    ? (buggy as BuggyName)
    : DEFAULT_BUGGY;
}

function normalizeConfigInput(config: RollConfig): RollConfig {
  return {
    driver: config.driver,
    buggy: normalizeBuggy(config.buggy),
    pushers: normalizePushers(config.pushers),
  };
}

function normalizePushers(pushers: string[]): string[] {
  const list = [...pushers];
  while (list.length < PUSHER_COUNT) list.push('');
  return list.slice(0, PUSHER_COUNT);
}

function normalizeSnapshot(config: RollConfig | null | undefined): RollConfig {
  return {
    driver: config?.driver ?? '',
    buggy: config?.buggy ?? '',
    pushers: normalizePushers(config?.pushers ?? []),
  };
}

function loadPendingTaps(): PendingTap[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_TAPS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (t): t is PendingTap =>
        t && typeof t.rollId === 'number' && isStationId(t.stationId) && typeof t.serverMs === 'number',
    );
  } catch {
    return [];
  }
}

function savePendingTaps(taps: PendingTap[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_TAPS_KEY, JSON.stringify(taps));
}

const sameTap = (a: PendingTap, b: PendingTap) =>
  a.rollId === b.rollId && a.stationId === b.stationId && a.serverMs === b.serverMs;

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? code : '';
}

/** Schema/constraint problems will not fix themselves; anything else (no signal) is retried. */
function isPermanentDbError(error: unknown): boolean {
  const code = errorCode(error);
  return code.startsWith('PGRST') || /^(22|23|42)/.test(code);
}

function isMissingSetupError(error: unknown): boolean {
  const code = errorCode(error);
  const text = String((error as { message?: unknown })?.message ?? '');
  return code === 'PGRST202' || code === 'PGRST204' || code === 'PGRST205'
    || code === '42P01' || code === '42703' || /roll_taps|origin_station|srs_roll/.test(text);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Live taps from the database plus this phone's taps that have not been saved yet. */
function mergeRecords(server: StationRecords, pending: PendingTap[], rollId: number): StationRecords {
  const records = { ...server };
  for (const tap of pending) {
    if (tap.rollId === rollId && records[tap.stationId] == null) records[tap.stationId] = tap.serverMs;
  }
  return records;
}

/** The origin tap may still be in flight from the phone that opened the roll; the row has it too. */
function withOriginFallback(records: StationRecords, row: DbRollRow): StationRecords {
  const origin = row.origin_station ?? originStationOf(row.records);
  if (origin && records[origin] == null && row.records[origin] != null) {
    return { ...records, [origin]: row.records[origin] };
  }
  return records;
}

function srsLinkOf(row: DbRollRow): SrsRollLink | null {
  if (!row.srs_roll_date || row.srs_roll_number == null || row.srs_buggy_id == null) return null;
  return { rollDate: row.srs_roll_date.slice(0, 10), rollNumber: row.srs_roll_number, buggyId: row.srs_buggy_id };
}

/** Saves a roll that is being replaced: completed if it has any split, otherwise cancelled. */
async function closeRoll(row: DbRollRow, records: StationRecords): Promise<void> {
  if (splitCount(records) > 0) {
    await rollsApi.finalizeRollInDb(row.id, {
      records,
      config: normalizeSnapshot(row.config_snapshot),
      weather: row.weather,
      notes: row.notes ?? '',
      unreliableStations: (row.unreliable_stations ?? []) as StationId[],
    });
  } else {
    await rollsApi.cancelRollInDb(row.id, records);
  }
}

async function syncActiveMeta(get: () => AppState): Promise<void> {
  const { activeRollDbId, unreliableStations, rollNotes } = get();
  if (!activeRollDbId) return;
  await rollsApi.syncRollMeta(
    activeRollDbId,
    Object.keys(unreliableStations) as StationId[],
    rollNotes,
  );
}

function scheduleNotesSync(get: () => AppState): void {
  if (notesSyncTimer) clearTimeout(notesSyncTimer);
  notesSyncTimer = setTimeout(() => {
    void syncActiveMeta(get);
  }, 400);
}

export const useAppStore = create<AppState>()((set, get) => {
  function setPendingTaps(pendingTaps: PendingTap[]) {
    savePendingTaps(pendingTaps);
    set({ pendingTaps });
  }

  function scheduleFlush(delay = 0) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushPendingTaps();
    }, delay);
  }

  async function flushPendingTaps(): Promise<void> {
    if (flushing) return;
    flushing = true;
    let retry = false;
    try {
      for (const tap of [...get().pendingTaps]) {
        try {
          await tapsApi.insertTap(tap.rollId, tap.stationId, tap.serverMs);
          const stillWanted = get().pendingTaps.some((t) => sameTap(t, tap));
          setPendingTaps(get().pendingTaps.filter((t) => !sameTap(t, tap)));
          if (!stillWanted) await tapsApi.undoTap(tap.rollId, tap.stationId).catch(() => {});
        } catch (error) {
          if (isPermanentDbError(error)) {
            console.error('Tap rejected by the database:', error);
            setPendingTaps(get().pendingTaps.filter((t) => !sameTap(t, tap)));
            set({ syncError: isMissingSetupError(error) ? SETUP_HINT : 'A tap was rejected by the database.' });
          } else {
            retry = true;
            set({ syncError: 'No connection. Taps are kept on this phone and will be sent.' });
            break;
          }
        }
      }
    } finally {
      flushing = false;
    }
    if (retry || get().pendingTaps.length) {
      scheduleFlush(FLUSH_RETRY_MS);
    } else if (get().syncError?.startsWith('No connection')) {
      set({ syncError: null });
    }
  }

  function subscribeTaps(rollId: number) {
    get().tapSubscription?.unsubscribe();
    const sub = subscribeToRollTaps(rollId, () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(() => void get().loadActiveRoll(), 150);
    });
    set({ tapSubscription: sub });
  }

  function clearActive() {
    get().tapSubscription?.unsubscribe();
    set((s) => ({ ...resetActiveRollState, config: s.config, tapSubscription: null }));
  }

  function applyActive(row: DbRollRow, serverRecords: StationRecords) {
    const state = get();
    const isNewRoll = state.activeRollDbId !== row.id;
    const records = mergeRecords(withOriginFallback(serverRecords, row), state.pendingTaps, row.id);
    const snapshot = normalizeSnapshot(row.config_snapshot);
    const incomingFlaggerNotes = normalizeFlaggerNotes(row.flagger_notes);
    const localIds = new Set(state.flaggerNotes.map((n) => n.id));

    set({
      rollActive: true,
      activeRollDbId: row.id,
      activeOrigin: row.origin_station ?? originStationOf(records) ?? 'start',
      activeSrs: srsLinkOf(row),
      rollConfigSnapshot: snapshot,
      startTime: row.start_time_ms,
      isFinished: records.finish != null,
      records,
      unreliableStations: Object.fromEntries(
        (row.unreliable_stations ?? []).map((id) => [id, true]),
      ) as Partial<Record<StationId, true>>,
      rollNotes: isNewRoll ? row.notes ?? '' : row.notes || state.rollNotes,
      flaggerNotes: isNewRoll
        ? incomingFlaggerNotes
        : [...state.flaggerNotes, ...incomingFlaggerNotes.filter((n) => !localIds.has(n.id))],
      ...(isNewRoll ? { rollVideo: null, weather: row.weather ?? state.weather } : {}),
    });

    if (isNewRoll) {
      subscribeTaps(row.id);
      if (state.activeRollDbId != null) void get().refreshSavedRolls();
    }
  }

  function queueTap(tap: PendingTap) {
    setPendingTaps([...get().pendingTaps.filter((t) => !(t.rollId === tap.rollId && t.stationId === tap.stationId)), tap]);
    scheduleFlush();
  }

  function recordTap(rollId: number, stationId: StationId, tapMs: number) {
    set((state) => ({
      records: { ...state.records, [stationId]: tapMs },
      isFinished: stationId === 'finish' ? true : state.isFinished,
    }));
    queueTap({ rollId, stationId, serverMs: tapMs });
  }

  async function openOrJoin(stationId: OriginStation, tapMs: number): Promise<void> {
    if (get().opening) return;
    set({ opening: true, syncError: null });

    let closedOne = false;
    let replaced: ActiveRollForPlan | null = null;
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          const server = await rollsApi.fetchActiveRoll();
          if (server) {
            const serverRecords = withOriginFallback(await tapsApi.fetchLiveTaps(server.id), server);
            const action = stationAction(stationId, { records: serverRecords }, tapMs);
            if (action === 'record') {
              loadSeq++;
              applyActive(server, serverRecords);
              recordTap(server.id, stationId, tapMs);
              return;
            }
            if (action === 'recorded' || action === 'busy') {
              loadSeq++;
              applyActive(server, serverRecords);
              set({ syncError: 'Another phone already started this roll.' });
              return;
            }
            const closing = mergeRecords(serverRecords, get().pendingTaps, server.id);
            await closeRoll(server, closing);
            closedOne = true;
            replaced = { srs: srsLinkOf(server), records: closing };
          }

          const nextRoll = resolveNextRoll({
            plan: usePlanStore.getState(),
            pick: get().nextRollPick,
            savedRolls: get().savedRolls,
            active: replaced,
            manualConfig: normalizeConfigInput(get().config),
            nowMs: tapMs,
          });
          const row = await rollsApi.createActiveRoll({
            config: normalizeSnapshot(nextRoll.config),
            originStation: stationId,
            originMs: tapMs,
            srs: nextRoll.srs,
            weather: get().weather,
          });
          loadSeq++;
          set({ nextRollPick: null, syncError: null });
          applyActive(row, { ...createEmptyRecords(), [stationId]: tapMs });
          queueTap({ rollId: row.id, stationId, serverMs: tapMs });
          if (closedOne) void get().refreshSavedRolls();
          return;
        } catch (error) {
          console.error('Starting the roll failed:', error);
          if (isPermanentDbError(error)) {
            set({ syncError: isMissingSetupError(error) ? SETUP_HINT : `Could not start the roll: ${String((error as Error).message ?? error)}` });
            return;
          }
          if (attempt >= OPEN_MAX_ATTEMPTS) {
            set({ syncError: 'Could not reach the database to start the roll. Check the connection and tap again.' });
            return;
          }
          set({ syncError: 'No connection. Still starting the roll; the tap time is kept.' });
          await sleep(Math.min(2_000 * attempt, 10_000));
        }
      }
    } finally {
      set({ opening: false });
    }
  }

  return {
    initStatus: 'idle',
    initError: null,
    rollsLoadStatus: 'idle',
    leaderboardLoadStatus: 'idle',
    displayName: '',
    rollActive: false,
    activeRollDbId: null,
    activeOrigin: null,
    activeSrs: null,
    rollConfigSnapshot: null,
    startTime: null,
    isFinished: false,
    opening: false,
    syncError: null,
    pendingTaps: [],
    nextRollPick: null,
    weather: WEATHER_PLACEHOLDER,
    rollNotes: '',
    flaggerNotes: [],
    rollVideo: null,
    unreliableStations: {},
    savedRolls: [],
    leaderboardByKey: {},
    leaderboardComputedAt: null,
    lastViewedRollId: null,
    highlightLogsOnNextList: false,
    activeRoleView: 'pusher',
    theme: 'system',
    directToLogsFromRollSummary: true,
    config: defaultConfig(),
    records: createEmptyRecords(),
    tapSubscription: null,
    tableSubscriptions: [],

    hydrate: async () => {
      if (get().initStatus === 'loading' || get().initStatus === 'ready') return;
      set({ initStatus: 'loading', initError: null, pendingTaps: loadPendingTaps() });

      if (!isSupabaseConfigured()) {
        set({
          initStatus: 'error',
          initError: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        });
        return;
      }

      const stopClock = startClockSync();
      const stopPlan = usePlanStore.getState().startPolling();

      try {
        const settings = await settingsApi.loadOrCreateSettings();
        const theme = (settings.theme === 'dark' ||
        settings.theme === 'light' ||
        settings.theme === 'system'
          ? settings.theme
          : 'system') as AppTheme;

        settingsApi.cacheThemeForBootstrap(theme);

        const rolls = await rollsApi.fetchCompletedRolls();

        set({
          displayName: settings.display_name ?? '',
          theme,
          directToLogsFromRollSummary: settings.direct_to_logs ?? true,
          activeRoleView: (settings.role_view as RoleView) ?? 'pusher',
          lastViewedRollId: settings.last_viewed_roll_id
            ? String(settings.last_viewed_roll_id)
            : null,
          savedRolls: rolls,
          rollsLoadStatus: 'ready',
        });

        await get().loadActiveRoll();
        set({ initStatus: 'ready' });
        if (get().pendingTaps.length) scheduleFlush();

        const rollsSub = subscribeToTable('rolls-live', 'rolls', () => {
          if (loadTimer) clearTimeout(loadTimer);
          loadTimer = setTimeout(() => void get().loadActiveRoll(), 150);
        });

        const poll = setInterval(() => {
          if (document.visibilityState === 'visible') void get().loadActiveRoll();
        }, ACTIVE_POLL_MS);
        const onVisible = () => {
          if (document.visibilityState !== 'visible') return;
          void get().loadActiveRoll();
          if (get().pendingTaps.length) scheduleFlush();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onVisible);

        set({
          tableSubscriptions: [
            rollsSub,
            {
              unsubscribe: () => {
                clearInterval(poll);
                document.removeEventListener('visibilitychange', onVisible);
                window.removeEventListener('online', onVisible);
                stopClock();
                stopPlan();
              },
            },
          ],
        });
      } catch (error) {
        console.error('Hydrate failed:', error);
        set({
          initStatus: 'error',
          initError: error instanceof Error ? error.message : 'Failed to load from database',
        });
      }
    },

    loadActiveRoll: async () => {
      const seq = ++loadSeq;
      try {
        const row = await rollsApi.fetchActiveRoll();
        if (seq !== loadSeq) return;
        if (!row) {
          if (get().rollActive) {
            clearActive();
            void get().refreshSavedRolls();
          }
          return;
        }
        const taps = await tapsApi.fetchLiveTaps(row.id);
        if (seq !== loadSeq) return;
        applyActive(row, taps);
        if (get().syncError === SETUP_HINT) set({ syncError: null });
      } catch (error) {
        console.error('loadActiveRoll failed:', error);
        if (isMissingSetupError(error)) set({ syncError: SETUP_HINT });
      }
    },

    refreshSavedRolls: async () => {
      set({ rollsLoadStatus: 'loading' });
      try {
        const rolls = await rollsApi.fetchCompletedRolls();
        set({ savedRolls: rolls, rollsLoadStatus: 'ready' });
      } catch (error) {
        console.error('refreshSavedRolls failed:', error);
        set({ rollsLoadStatus: 'ready' });
      }
    },

    loadLeaderboard: async (hill, buggy) => {
      const key = leaderboardApi.leaderboardCacheKey(hill, buggy);
      set({ leaderboardLoadStatus: 'loading' });
      try {
        const { entries, computedAt } = await leaderboardApi.fetchLeaderboardSlice(hill, buggy);
        set((s) => ({
          leaderboardByKey: { ...s.leaderboardByKey, [key]: entries },
          leaderboardComputedAt: computedAt,
          leaderboardLoadStatus: 'ready',
        }));
      } catch (error) {
        console.error('loadLeaderboard failed:', error);
        set({ leaderboardLoadStatus: 'ready' });
      }
    },

    setDisplayName: (name) => {
      set({ displayName: name });
      void settingsApi.saveSettings({ display_name: name });
    },

    setActiveRoleView: (view) => {
      set({ activeRoleView: view });
      void settingsApi.saveSettings({ role_view: view });
    },

    setNextRollPick: (pick) => set({ nextRollPick: pick }),

    setTheme: (theme) => {
      settingsApi.cacheThemeForBootstrap(theme);
      set({ theme });
      void settingsApi.saveSettings({ theme });
    },

    setDirectToLogsFromRollSummary: (value) => {
      set({ directToLogsFromRollSummary: value });
      void settingsApi.saveSettings({ direct_to_logs: value });
    },

    fetchWeather: async () => {
      weatherAbort?.abort();
      const controller = new AbortController();
      weatherAbort = controller;
      const generation = ++weatherFetchGeneration;

      try {
        const response = await fetch(buildWeatherApiUrl(), { signal: controller.signal });
        if (generation !== weatherFetchGeneration) return;
        if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
        const data = await response.json();
        if (generation !== weatherFetchGeneration) return;
        set({ weather: parseWeatherResponse(data) });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (generation !== weatherFetchGeneration) return;
        console.error('Weather fetch failed:', error);
        set({ weather: WEATHER_ERROR });
      }
    },

    tapStation: async (stationId, tapMs) => {
      if (!isStationId(stationId)) return;
      const state = get();
      const action = stationAction(
        stationId,
        state.rollActive ? { records: state.records } : null,
        tapMs,
      );
      if (action === 'record' && state.activeRollDbId != null) {
        recordTap(state.activeRollDbId, stationId, tapMs);
      } else if ((action === 'open' || action === 'openNext') && (stationId === 'start' || stationId === 'h1h2')) {
        await openOrJoin(stationId, tapMs);
      }
    },


    undoRecord: async (stationId) => {
      if (!isStationId(stationId)) return;
      const { activeRollDbId, activeOrigin } = get();
      if (activeRollDbId == null) return;

      if (stationId === activeOrigin) {
        await get().resetRoll();
        return;
      }

      const wasPending = get().pendingTaps.some(
        (t) => t.rollId === activeRollDbId && t.stationId === stationId,
      );
      setPendingTaps(get().pendingTaps.filter(
        (t) => !(t.rollId === activeRollDbId && t.stationId === stationId),
      ));
      set((state) => {
        const nextUnreliable = { ...state.unreliableStations };
        delete nextUnreliable[stationId];
        return {
          records: { ...state.records, [stationId]: null },
          unreliableStations: nextUnreliable,
          isFinished: stationId === 'finish' ? false : state.isFinished,
        };
      });

      try {
        if (!wasPending || flushing) await tapsApi.undoTap(activeRollDbId, stationId);
        await syncActiveMeta(get);
      } catch (error) {
        console.error('undoRecord failed:', error);
        set({ syncError: 'Undo was not saved. Check the connection.' });
      }
    },

    resetRoll: async () => {
      const { activeRollDbId, records: prevRecords } = get();
      clearActive();
      if (activeRollDbId == null) return;
      setPendingTaps(get().pendingTaps.filter((t) => t.rollId !== activeRollDbId));
      try {
        await rollsApi.cancelRollInDb(activeRollDbId, prevRecords);
        await get().refreshSavedRolls();
      } catch (error) {
        console.error('resetRoll failed:', error);
        set({ syncError: 'Cancelling the roll was not saved. Check the connection.' });
      }
    },

    setConfig: (newConfig) => {
      set({ config: normalizeConfigInput(newConfig) });
    },

    setRollNotes: (notes) => {
      set({ rollNotes: notes });
      scheduleNotesSync(get);
    },

    addFlaggerNote: (text) => {
      const { displayName, activeRollDbId, flaggerNotes } = get();
      const note: FlaggerNote = {
        id: crypto.randomUUID(),
        by: displayName || 'Unknown',
        text,
        createdAt: Date.now(),
      };
      const updated = [...flaggerNotes, note];
      set({ flaggerNotes: updated });
      if (activeRollDbId) {
        void rollsApi.syncFlaggerNotes(activeRollDbId, updated);
      }
    },

    setRollVideo: (video) => set({ rollVideo: video }),

    flagStationUnreliable: (stationId) => {
      set((state) => ({
        unreliableStations: { ...state.unreliableStations, [stationId]: true },
      }));
      void syncActiveMeta(get);
    },

    clearStationUnreliable: (stationId) => {
      set((state) => {
        const next = { ...state.unreliableStations };
        delete next[stationId];
        return { unreliableStations: next };
      });
      void syncActiveMeta(get);
    },

    toggleStationUnreliable: (stationId) => {
      set((state) => {
        const next = { ...state.unreliableStations };
        if (next[stationId]) delete next[stationId];
        else next[stationId] = true;
        return { unreliableStations: next };
      });
      void syncActiveMeta(get);
    },

    exportRoll: async () => {
      const state = get();
      if (!state.activeRollDbId || !state.rollConfigSnapshot) return;
      if (splitCount(state.records) === 0 && state.records.finish == null) return;

      const rollId = state.activeRollDbId;
      try {
        await rollsApi.finalizeRollInDb(rollId, {
          records: state.records,
          config: state.rollConfigSnapshot,
          weather: state.weather,
          notes: state.rollNotes,
          unreliableStations: Object.keys(state.unreliableStations) as StationId[],
        });
        if (get().activeRollDbId === rollId) clearActive();
        await get().refreshSavedRolls();
      } catch (error) {
        console.error('exportRoll failed:', error);
        set({ syncError: 'Saving the roll failed. Check the connection and try again.' });
      }
    },

    updateSavedRollNotes: async (id, notes) => {
      const dbId = parseRollId(id);
      if (!dbId) return;
      set((state) => ({
        savedRolls: state.savedRolls.map((r) => (r.id === id ? { ...r, notes } : r)),
      }));
      try {
        await rollsApi.updateRollNotes(dbId, notes);
      } catch (error) {
        console.error('updateSavedRollNotes failed:', error);
      }
    },

    setLastViewedRollId: (id) => {
      set({ lastViewedRollId: id });
      const dbId = id ? parseRollId(id) : null;
      void settingsApi.saveSettings({ last_viewed_roll_id: dbId });
    },

    setHighlightLogsOnNextList: (value) => set({ highlightLogsOnNextList: value }),

    deleteSavedRoll: async (id) => {
      const dbId = parseRollId(id);
      if (!dbId) return;
      set((state) => ({
        savedRolls: state.savedRolls.filter((r) => r.id !== id),
        lastViewedRollId: state.lastViewedRollId === id ? null : state.lastViewedRollId,
      }));
      try {
        await rollsApi.deleteRoll(dbId);
        if (get().lastViewedRollId === null) {
          void settingsApi.saveSettings({ last_viewed_roll_id: null });
        }
      } catch (error) {
        console.error('deleteSavedRoll failed:', error);
        await get().refreshSavedRolls();
      }
    },
  };
});
