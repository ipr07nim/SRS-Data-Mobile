import { create } from 'zustand';
import {
  BUGGY_OPTIONS,
  DEFAULT_BUGGY,
  PUSHER_COUNT,
  STATIONS,
  isStationId,
} from './config/app.config';
import type { StationId } from './config/app.config';
import type { BuggyName } from './config/app.config';
import type { SavedRoll, LeaderboardEntry, LeaderboardHill } from './domain/rolls';
import { createEmptyRecords } from './domain/timing';
import {
  buildWeatherApiUrl,
  parseWeatherResponse,
  WEATHER_ERROR,
  WEATHER_PLACEHOLDER,
  type WeatherSnapshot,
} from './domain/weather';
import type { FlaggerNote, RollConfig, RollVideoAttachment, StationRecords } from './domain/types';
import type { Assignment, RollOrderEntry } from './domain/assignments';
import type { RoleView } from './config/roles';
import { HILL_LABELS } from './config/app.config';
import type { HillLabel } from './config/app.config';
import { isSupabaseConfigured, subscribeToRoll, subscribeToTable, unsubscribeFromRoll } from './lib/supabase';
import { parseRollId, normalizeDbRecords, normalizeFlaggerNotes } from './services/supabase/mappers';
import * as assignmentsApi from './services/supabase/assignments';
import * as rollOrderApi from './services/supabase/rollOrder';
import * as rollsApi from './services/supabase/rolls';
import * as settingsApi from './services/supabase/settings';
import * as leaderboardApi from './services/supabase/leaderboard';

let weatherAbort: AbortController | null = null;
let weatherFetchGeneration = 0;
let notesSyncTimer: ReturnType<typeof setTimeout> | null = null;

export type { RollConfig, StationRecords };
export type { RoleView } from './config/roles';
export type AppTheme = 'dark' | 'light' | 'system';
export { STATIONS, HILL_AVERAGES } from './config/app.config';
export type { StationId, HillLabel } from './config/app.config';
export type { SavedRoll } from './domain/rolls';

export type InitStatus = 'idle' | 'loading' | 'ready' | 'error';
export type LoadStatus = 'idle' | 'loading' | 'ready';

export interface AppState {
  initStatus: InitStatus;
  initError: string | null;
  rollsLoadStatus: LoadStatus;
  leaderboardLoadStatus: LoadStatus;
  displayName: string;
  rollActive: boolean;
  activeRollDbId: number | null;
  rollConfigSnapshot: RollConfig | null;
  startTime: number | null;
  isFinished: boolean;
  weather: WeatherSnapshot;
  fetchWeather: () => Promise<void>;
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
  assignments: Assignment[];
  rollOrder: RollOrderEntry[];
  rollSubscription: { unsubscribe: () => void } | null;
  tableSubscriptions: { unsubscribe: () => void }[];
  hydrate: () => Promise<void>;
  refreshSavedRolls: () => Promise<void>;
  loadLeaderboard: (hill: LeaderboardHill, buggy: string) => Promise<void>;
  setDisplayName: (name: string) => void;
  setActiveRoleView: (view: RoleView) => void;
  loadAssignments: () => Promise<void>;
  updateAssignment: (hill: HillLabel, pusherName: string) => Promise<void>;
  clearAssignments: () => Promise<void>;
  loadRollOrder: () => Promise<void>;
  addToRollOrder: (buggy: string, driver: string) => Promise<void>;
  updateRollOrderStatus: (id: number, status: RollOrderEntry['status']) => Promise<void>;
  removeFromRollOrder: (id: number) => Promise<void>;
  setTheme: (theme: AppTheme) => void;
  setDirectToLogsFromRollSummary: (value: boolean) => void;
  startRoll: (config: RollConfig) => Promise<void>;
  recordStation: (stationId: StationId, time: number) => Promise<void>;
  undoRecord: (stationId: StationId) => Promise<void>;
  resetRoll: () => Promise<void>;
  setConfig: (config: RollConfig) => void;
  setFinished: (status: boolean) => void;
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
  _subscribeToActiveRoll: (rollId: number) => void;
  _unsubscribeFromActiveRoll: () => void;
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

async function syncActiveRoll(get: () => AppState): Promise<void> {
  const { activeRollDbId, records, unreliableStations, rollNotes } = get();
  if (!activeRollDbId) return;
  await rollsApi.syncRollRecords(
    activeRollDbId,
    records,
    Object.keys(unreliableStations) as StationId[],
    rollNotes,
  );
}

function scheduleNotesSync(get: () => AppState): void {
  if (notesSyncTimer) clearTimeout(notesSyncTimer);
  notesSyncTimer = setTimeout(() => {
    void syncActiveRoll(get);
  }, 400);
}

export const useAppStore = create<AppState>()((set, get) => ({
  initStatus: 'idle',
  initError: null,
  rollsLoadStatus: 'idle',
  leaderboardLoadStatus: 'idle',
  displayName: '',
  rollActive: false,
  activeRollDbId: null,
  rollConfigSnapshot: null,
  startTime: null,
  isFinished: false,
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
  assignments: HILL_LABELS.map((hill) => ({ hill, pusherName: '', assignedBy: '', updatedAt: '' })),
  rollOrder: [],
  rollSubscription: null,
  tableSubscriptions: [],

  hydrate: async () => {
    if (get().initStatus === 'loading' || get().initStatus === 'ready') return;
    set({ initStatus: 'loading', initError: null });

    if (!isSupabaseConfigured()) {
      set({
        initStatus: 'error',
        initError: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      });
      return;
    }

    try {
      const settings = await settingsApi.loadOrCreateSettings();
      const theme = (settings.theme === 'dark' ||
      settings.theme === 'light' ||
      settings.theme === 'system'
        ? settings.theme
        : 'system') as AppTheme;

      settingsApi.cacheThemeForBootstrap(theme);

      const active = await rollsApi.fetchActiveRoll();
      const rolls = await rollsApi.fetchCompletedRolls();

      const sharedSettings = {
        displayName: settings.display_name ?? '',
        theme,
        directToLogsFromRollSummary: settings.direct_to_logs ?? true,
        activeRoleView: (settings.role_view as RoleView) ?? 'pusher',
        lastViewedRollId: settings.last_viewed_roll_id
          ? String(settings.last_viewed_roll_id)
          : null,
      };

      if (active) {
        const records = active.records;
        const config = active.config_snapshot;
        set({
          initStatus: 'ready',
          rollsLoadStatus: 'ready',
          ...sharedSettings,
          savedRolls: rolls,
          rollActive: true,
          activeRollDbId: active.id,
          rollConfigSnapshot: config,
          startTime: Math.abs(active.start_time_ms),
          isFinished: records.finish != null,
          rollNotes: active.notes ?? '',
          flaggerNotes: normalizeFlaggerNotes(active.flagger_notes),
          config,
          records,
          unreliableStations: Object.fromEntries(
            (active.unreliable_stations ?? []).map((id) => [id, true]),
          ) as Partial<Record<StationId, true>>,
          weather: active.weather ?? WEATHER_PLACEHOLDER,
        });
        get()._subscribeToActiveRoll(active.id);
      } else {
        set({
          initStatus: 'ready',
          rollsLoadStatus: 'ready',
          ...sharedSettings,
          savedRolls: rolls,
        });
      }

      void get().loadAssignments();
      void get().loadRollOrder();

      const assignSub = subscribeToTable('assignments-today', 'assignments', () => {
        void get().loadAssignments();
      });
      const orderSub = subscribeToTable('roll-order-today', 'roll_order', () => {
        void get().loadRollOrder();
      });
      set({ tableSubscriptions: [assignSub, orderSub] });
    } catch (error) {
      console.error('Hydrate failed:', error);
      set({
        initStatus: 'error',
        initError: error instanceof Error ? error.message : 'Failed to load from database',
      });
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

  loadAssignments: async () => {
    try {
      const assignments = await assignmentsApi.fetchTodayAssignments();
      set({ assignments });
    } catch (error) {
      console.error('loadAssignments failed:', error);
    }
  },

  updateAssignment: async (hill, pusherName) => {
    const { displayName } = get();
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a.hill === hill ? { ...a, pusherName, assignedBy: displayName || '' } : a,
      ),
    }));
    try {
      await assignmentsApi.upsertAssignment(hill, pusherName, displayName || '');
    } catch (error) {
      console.error('updateAssignment failed:', error);
    }
  },

  clearAssignments: async () => {
    set({
      assignments: HILL_LABELS.map((hill) => ({ hill, pusherName: '', assignedBy: '', updatedAt: '' })),
    });
    try {
      await assignmentsApi.clearAssignments();
    } catch (error) {
      console.error('clearAssignments failed:', error);
    }
  },

  loadRollOrder: async () => {
    try {
      const rollOrder = await rollOrderApi.fetchTodayRollOrder();
      set({ rollOrder });
    } catch (error) {
      console.error('loadRollOrder failed:', error);
    }
  },

  addToRollOrder: async (buggy, driver) => {
    try {
      await rollOrderApi.addToRollOrder(buggy, driver);
      await get().loadRollOrder();
    } catch (error) {
      console.error('addToRollOrder failed:', error);
    }
  },

  updateRollOrderStatus: async (id, status) => {
    set((state) => ({
      rollOrder: state.rollOrder.map((r) => (r.id === id ? { ...r, status } : r)),
    }));
    try {
      await rollOrderApi.updateRollOrderStatus(id, status);
    } catch (error) {
      console.error('updateRollOrderStatus failed:', error);
    }
  },

  removeFromRollOrder: async (id) => {
    set((state) => ({
      rollOrder: state.rollOrder.filter((r) => r.id !== id),
    }));
    try {
      await rollOrderApi.removeFromRollOrder(id);
    } catch (error) {
      console.error('removeFromRollOrder failed:', error);
    }
  },

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

  startRoll: async (config) => {
    const existing = await rollsApi.fetchActiveRoll();
    if (existing) {
      console.warn('An active roll already exists — joining it instead of creating a new one.');
      const records = existing.records;
      const cfg = existing.config_snapshot;
      set({
        rollActive: true,
        activeRollDbId: existing.id,
        rollConfigSnapshot: cfg,
        startTime: Math.abs(existing.start_time_ms),
        isFinished: records.finish != null,
        rollNotes: existing.notes ?? '',
        flaggerNotes: normalizeFlaggerNotes(existing.flagger_notes),
        rollVideo: null,
        unreliableStations: Object.fromEntries(
          (existing.unreliable_stations ?? []).map((id) => [id, true]),
        ) as Partial<Record<StationId, true>>,
        config: cfg,
        records,
        weather: existing.weather ?? get().weather,
      });
      get()._subscribeToActiveRoll(existing.id);
      return;
    }

    const { assignments: currentAssignments } = get();
    const autoFilledPushers = config.pushers.map((p, i) => {
      if (p) return p;
      const assignment = currentAssignments[i];
      return assignment?.pusherName || '';
    });
    const normalized = normalizeConfigInput({ ...config, pushers: autoFilledPushers });
    const t = Date.now();
    const weather = get().weather;

    try {
      const row = await rollsApi.createActiveRoll(normalized, t, weather);
      set({
        rollActive: true,
        activeRollDbId: row.id,
        rollConfigSnapshot: normalized,
        startTime: t,
        isFinished: false,
        rollNotes: '',
        rollVideo: null,
        unreliableStations: {},
        config: normalized,
        records: { ...createEmptyRecords(), start: t },
      });
      get()._subscribeToActiveRoll(row.id);
    } catch (error) {
      console.error('startRoll failed:', error);
    }
  },

  setFinished: (status) => set({ isFinished: status }),

  recordStation: async (stationId, time) => {
    if (!isStationId(stationId)) return;
    set((state) => ({
      records: { ...state.records, [stationId]: time },
      isFinished: stationId === 'finish' ? true : state.isFinished,
    }));
    try {
      await syncActiveRoll(get);
    } catch (error) {
      console.error('recordStation sync failed:', error);
    }
  },

  undoRecord: async (stationId) => {
    if (!isStationId(stationId)) return;
    const { activeRollDbId, records: prevRecords } = get();

    set((state) => {
      const nextUnreliable = { ...state.unreliableStations };
      delete nextUnreliable[stationId];
      if (stationId === 'start') {
        return {
          ...resetActiveRollState,
          config: state.config,
        };
      }
      return {
        records: { ...state.records, [stationId]: null },
        unreliableStations: nextUnreliable,
        isFinished: stationId === 'finish' ? false : state.isFinished,
      };
    });

    if (stationId === 'start' && activeRollDbId) {
      try {
        await rollsApi.cancelRollInDb(activeRollDbId, prevRecords);
        await get().refreshSavedRolls();
      } catch (error) {
        console.error('undo start failed:', error);
      }
      return;
    }
    try {
      await syncActiveRoll(get);
    } catch (error) {
      console.error('undoRecord sync failed:', error);
    }
  },

  resetRoll: async () => {
    const { activeRollDbId, records: prevRecords } = get();
    get()._unsubscribeFromActiveRoll();
    set((state) => ({
      ...resetActiveRollState,
      config: state.config,
    }));
    if (!activeRollDbId) return;
    try {
      await rollsApi.cancelRollInDb(activeRollDbId, prevRecords);
      await get().refreshSavedRolls();
    } catch (error) {
      console.error('resetRoll failed:', error);
    }
  },

  setConfig: (newConfig) => {
    if (get().rollActive) return;
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
    void syncActiveRoll(get);
  },

  clearStationUnreliable: (stationId) => {
    set((state) => {
      const next = { ...state.unreliableStations };
      delete next[stationId];
      return { unreliableStations: next };
    });
    void syncActiveRoll(get);
  },

  toggleStationUnreliable: (stationId) => {
    set((state) => {
      const next = { ...state.unreliableStations };
      if (next[stationId]) delete next[stationId];
      else next[stationId] = true;
      return { unreliableStations: next };
    });
    void syncActiveRoll(get);
  },

  exportRoll: async () => {
    const state = get();
    if (!state.startTime || !state.activeRollDbId || !state.rollConfigSnapshot) return;
    if (state.records.finish == null) return;

    const config = state.rollConfigSnapshot;
    const unreliable = Object.keys(state.unreliableStations) as StationId[];

    try {
      get()._unsubscribeFromActiveRoll();
      await rollsApi.finalizeRollInDb(
        state.activeRollDbId,
        state.records,
        config,
        state.weather,
        state.rollNotes,
        unreliable,
      );
      set((s) => ({
        ...resetActiveRollState,
        config: s.config,
      }));
      await get().refreshSavedRolls();
    } catch (error) {
      console.error('exportRoll failed:', error);
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

  _subscribeToActiveRoll: (rollId) => {
    get()._unsubscribeFromActiveRoll();
    const sub = subscribeToRoll(rollId, (payload) => {
      const incoming = payload as Record<string, unknown>;
      const incomingRecords = normalizeDbRecords(incoming.records);
      const incomingNotes = (incoming.notes as string) ?? '';
      const incomingUnreliable = (incoming.unreliable_stations as string[]) ?? [];
      const incomingConfig = incoming.config_snapshot as RollConfig | undefined;
      const incomingStatus = incoming.status as string | undefined;

      if (incomingStatus === 'completed' || incomingStatus === 'cancelled') {
        get()._unsubscribeFromActiveRoll();
        set((s) => ({ ...resetActiveRollState, config: s.config }));
        void get().refreshSavedRolls();
        return;
      }

      const incomingFlaggerNotes = normalizeFlaggerNotes(incoming.flagger_notes);

      set((state) => {
        const mergedRecords = { ...state.records };
        for (const key of STATIONS.map((s) => s.id)) {
          const remote = incomingRecords[key];
          if (remote != null && mergedRecords[key] == null) {
            mergedRecords[key] = remote;
          }
        }

        const localIds = new Set(state.flaggerNotes.map((n) => n.id));
        const mergedFlaggerNotes = [
          ...state.flaggerNotes,
          ...incomingFlaggerNotes.filter((n) => !localIds.has(n.id)),
        ];

        return {
          records: mergedRecords,
          rollNotes: incomingNotes || state.rollNotes,
          flaggerNotes: mergedFlaggerNotes,
          unreliableStations: Object.fromEntries(
            incomingUnreliable.map((id) => [id, true]),
          ) as Partial<Record<StationId, true>>,
          isFinished: mergedRecords.finish != null,
          ...(incomingConfig ? { rollConfigSnapshot: incomingConfig, config: incomingConfig } : {}),
        };
      });
    });
    set({ rollSubscription: sub });
  },

  _unsubscribeFromActiveRoll: () => {
    const sub = get().rollSubscription;
    if (sub) {
      sub.unsubscribe();
      set({ rollSubscription: null });
    }
  },
}));
