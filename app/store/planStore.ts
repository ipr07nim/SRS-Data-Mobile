import { create } from 'zustand';
import { getClientId } from '../lib/clientId';
import { sharedNow } from '../lib/serverClock';
import { courseToday, planDateIso } from '../domain/planView';
import { emptyPlanState, reducePlan } from '../domain/srsPlan';
import type { PlanEvent, PlanEventDraft, PlanState } from '../domain/srsPlan';
import {
  appendPlanEvents,
  fetchBuggies,
  fetchPlanTail,
  fetchPushers,
  isSrsConfigured,
  SrsError,
} from '../services/srs/client';
import type { PlanDate, PlanTailResponse, SrsBuggy } from '../services/srs/client';

/**
 * Today's SRS roll-day plan (the same edit log the desktop plan page uses), polled the way that
 * page polls it. Pusher assignments live here; nothing about them is stored in Supabase.
 */

const POLL_MS = 3000;
const LISTS_REFRESH_MS = 5 * 60 * 1000;

export type PlanStatus = 'off' | 'loading' | 'ready' | 'error';

interface PlanStoreState {
  status: PlanStatus;
  error: string | null;
  date: PlanDate;
  rollDateId: number | null;
  lastSeq: number;
  events: PlanEvent[];
  /** Edits shown immediately but not yet acknowledged by the SRS backend. */
  pending: PlanEvent[];
  buggies: SrsBuggy[];
  pusherNames: string[];
  state: PlanState;
  refresh: () => Promise<void>;
  append: (drafts: PlanEventDraft[]) => Promise<void>;
  startPolling: () => () => void;
}

let localSeq = 0;
let listsLoadedAt = 0;
let refreshing = false;

function derive(events: PlanEvent[], pending: PlanEvent[]): PlanState {
  return events.length || pending.length ? reducePlan([...events, ...pending]) : emptyPlanState();
}

/** Idempotent, so a tail overlapping what is already held cannot duplicate events. */
function mergeTail(events: PlanEvent[], tail: PlanTailResponse): PlanEvent[] {
  const known = new Set(events.map((e) => e.seq));
  return [...events, ...tail.events.filter((e) => !known.has(e.seq))].sort((a, b) => a.seq - b.seq);
}

function message(error: unknown): string {
  if (error instanceof SrsError) return error.message;
  return error instanceof Error ? error.message : 'SRS plan unavailable';
}

export const usePlanStore = create<PlanStoreState>()((set, get) => ({
  status: isSrsConfigured() ? 'loading' : 'off',
  error: isSrsConfigured() ? null : 'SRS backend is not configured (VITE_SRS_URL).',
  date: courseToday(Date.now()),
  rollDateId: null,
  lastSeq: 0,
  events: [],
  pending: [],
  buggies: [],
  pusherNames: [],
  state: emptyPlanState(),

  refresh: async () => {
    if (!isSrsConfigured() || refreshing) return;
    refreshing = true;

    const today = courseToday(sharedNow());
    if (planDateIso(today) !== planDateIso(get().date)) {
      set({ date: today, rollDateId: null, lastSeq: 0, events: [], pending: [], state: emptyPlanState() });
    }

    try {
      if (!listsLoadedAt || Date.now() - listsLoadedAt > LISTS_REFRESH_MS || !get().buggies.length) {
        const [buggies, pushers] = await Promise.all([fetchBuggies(), fetchPushers()]);
        listsLoadedAt = Date.now();
        set({
          buggies,
          pusherNames: [...new Set(pushers.map((p) => p.name).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b)),
        });
      }

      const date = get().date;
      const tail = await fetchPlanTail(date, get().lastSeq);
      if (planDateIso(date) !== planDateIso(get().date)) return;
      set((s) => {
        const events = mergeTail(s.events, tail);
        return {
          status: 'ready',
          error: null,
          rollDateId: tail.roll_date_id,
          lastSeq: Math.max(s.lastSeq, tail.last_seq),
          events,
          state: derive(events, s.pending),
        };
      });
    } catch (error) {
      set({ status: 'error', error: message(error) });
    } finally {
      refreshing = false;
    }
  },

  append: async (drafts) => {
    if (drafts.length === 0 || !isSrsConfigured()) return;
    const clientId = getClientId();
    const provisional: PlanEvent[] = drafts.map((d) => ({ ...d, seq: --localSeq, client_id: clientId }));
    const seqs = new Set(provisional.map((e) => e.seq));
    const date = get().date;

    set((s) => {
      const pending = [...s.pending, ...provisional];
      return { pending, state: derive(s.events, pending) };
    });

    try {
      const tail = await appendPlanEvents(date, clientId, drafts, get().lastSeq);
      set((s) => {
        const pending = s.pending.filter((e) => !seqs.has(e.seq));
        if (planDateIso(date) !== planDateIso(s.date)) return { pending, state: derive(s.events, pending) };
        const events = mergeTail(s.events, tail);
        return {
          status: 'ready',
          error: null,
          rollDateId: tail.roll_date_id,
          lastSeq: Math.max(s.lastSeq, tail.last_seq),
          events,
          pending,
          state: derive(events, pending),
        };
      });
    } catch (error) {
      set((s) => {
        const pending = s.pending.filter((e) => !seqs.has(e.seq));
        return { pending, state: derive(s.events, pending), error: `Change not saved: ${message(error)}` };
      });
      throw error;
    }
  },

  startPolling: () => {
    if (typeof window === 'undefined' || !isSrsConfigured()) return () => {};
    void get().refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void get().refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void get().refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  },
}));
