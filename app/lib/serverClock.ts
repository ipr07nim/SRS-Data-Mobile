import { useSyncExternalStore } from 'react';
import { bestClockOffset } from '../domain/clock';
import type { ClockSample } from '../domain/clock';
import { supabase } from './supabase';

/**
 * One clock for every phone. Each phone measures its offset from the database's clock and then
 * counts with performance.now(), so a phone whose own clock is wrong, or steps mid-roll, still
 * shows the same elapsed time as everyone else.
 */

const SAMPLES = 6;
const RESYNC_MS = 3 * 60 * 1000;
const MAX_USEFUL_RTT_MS = 2_000;
const SLEEP_JUMP_MS = 500;

export type ClockStatus = 'unsynced' | 'synced' | 'unavailable';

export interface ClockState {
  status: ClockStatus;
  offsetMs: number;
  /** Half the best round trip: the worst case error of the offset. */
  uncertaintyMs: number | null;
  syncedAt: number | null;
  error: string | null;
}

let state: ClockState = {
  status: 'unsynced',
  offsetMs: 0,
  uncertaintyMs: null,
  syncedAt: null,
  error: null,
};
let wallMinusMonoAtSync: number | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: Partial<ClockState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function monoNow(): number {
  if (typeof performance === 'undefined') return Date.now();
  return performance.timeOrigin + performance.now();
}

/** Current time on the shared clock, in epoch milliseconds. */
export function sharedNow(): number {
  return monoNow() + state.offsetMs;
}

export function getClockState(): ClockState {
  return state;
}

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClockState(): ClockState {
  return useSyncExternalStore(subscribeClock, getClockState, getClockState);
}

/**
 * If performance.now() stalled while the phone slept, the wall clock kept going; carry that
 * difference into the offset immediately, before the next sync confirms it.
 */
function correctForSleep() {
  if (wallMinusMonoAtSync == null) return;
  const drift = Date.now() - monoNow() - wallMinusMonoAtSync;
  if (Math.abs(drift) > SLEEP_JUMP_MS) {
    wallMinusMonoAtSync += drift;
    setState({ offsetMs: state.offsetMs + drift });
  }
}

export function syncClock(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const samples: ClockSample[] = [];
    let lastError: string | null = null;

    for (let i = 0; i < SAMPLES; i++) {
      const sentMs = monoNow();
      const { data, error } = await supabase.rpc('server_now_ms');
      const receivedMs = monoNow();
      if (error) {
        lastError = error.message;
        if (error.code === 'PGRST202' || error.code === '42883') break;
        continue;
      }
      samples.push({ sentMs, receivedMs, serverMs: Number(data) });
    }

    const best = bestClockOffset(samples);
    if (best && best.rtt <= MAX_USEFUL_RTT_MS) {
      wallMinusMonoAtSync = Date.now() - monoNow();
      setState({
        status: 'synced',
        offsetMs: best.offset,
        uncertaintyMs: Math.round(best.rtt / 2),
        syncedAt: Date.now(),
        error: null,
      });
    } else if (state.status !== 'synced') {
      setState({
        status: lastError ? 'unavailable' : 'unsynced',
        offsetMs: Date.now() - monoNow(),
        error: lastError,
      });
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Sync now, every few minutes, and whenever the phone wakes up. Returns a stop function. */
export function startClockSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (state.status === 'unsynced') setState({ offsetMs: Date.now() - monoNow() });
  void syncClock();
  const timer = setInterval(() => void syncClock(), RESYNC_MS);
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    correctForSleep();
    void syncClock();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
  };
}
