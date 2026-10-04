import {
  HILL_LABELS,
  JOIN_WINDOW_MS,
  OPENER_STATIONS,
  RESTART_LOCK_MS,
  STATIONS,
} from '../config/app.config';
import type { OriginStation, StationId } from '../config/app.config';
import type { RollConfig, SplitResult, StationRecords } from './types';
import { MISSING_SPLIT_TIME } from './types';

/** Parse M:SS.CS formatted time to milliseconds; returns -1 if invalid/missing. */
export function parseFormattedTime(time: string): number {
  if (time === '--:--.--' || !time) return -1;
  const match = time.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (!match) return -1;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const centiseconds = parseInt(match[3], 10);
  return minutes * 60_000 + seconds * 1000 + centiseconds * 10;
}

/** Format milliseconds as M:SS.CS (centiseconds). Negative values clamp to zero. */
export function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function createEmptyRecords(): StationRecords {
  return Object.fromEntries(
    STATIONS.map((s) => [s.id, null]),
  ) as StationRecords;
}

export function isOpenerStation(id: string): id is OriginStation {
  return (OPENER_STATIONS as readonly string[]).includes(id);
}

/** Which station the roll's clock counts from: the Hill 1 line, or Hill 2 when Hill 1 was skipped. */
export function originStationOf(records: StationRecords): OriginStation | null {
  if (records.start != null) return 'start';
  if (records.h1h2 != null) return 'h1h2';
  return null;
}

export function originMsOf(records: StationRecords): number | null {
  const origin = originStationOf(records);
  return origin ? records[origin] : null;
}

/**
 * Hill N runs from the station before it to the station after it. A split exists only when both
 * ends were tapped: a skipped station leaves a gap rather than folding into the next hill.
 */
export function computeSplits(
  records: StationRecords,
  config: RollConfig,
): SplitResult[] {
  const splits: SplitResult[] = [];

  for (let i = 1; i < STATIONS.length; i++) {
    const from = records[STATIONS[i - 1].id];
    const to = records[STATIONS[i].id];
    const label = HILL_LABELS[i - 1];
    const pusher = config.pushers[i - 1] || 'Unknown';
    const ok = from != null && to != null && to >= from;
    splits.push({ label, pusher, time: ok ? formatTime(to - from) : MISSING_SPLIT_TIME });
  }

  return splits;
}

export function splitCount(records: StationRecords): number {
  return computeSplits(records, { driver: '', buggy: '', pushers: [] })
    .filter((s) => s.time !== MISSING_SPLIT_TIME).length;
}

/** Finish minus the roll's origin (Hill 1 line, or Hill 2 when Hill 1 was skipped). */
export function computeTotalElapsedMs(records: StationRecords): number {
  const origin = originMsOf(records);
  if (records.finish != null && origin != null) {
    return records.finish - origin;
  }
  return 0;
}

export function formatTotalElapsed(records: StationRecords): string {
  const ms = computeTotalElapsedMs(records);
  return ms > 0 ? formatTime(ms) : MISSING_SPLIT_TIME;
}

export interface ActiveRollSnapshot {
  records: StationRecords;
}

/**
 * What a tap at `stationId` does right now.
 * - open: no roll on the course, this tap starts one here.
 * - openNext: a roll is still marked active but this tap starts the next one (the old one is saved).
 * - record: log this station on the active roll.
 * - recorded: already logged on the active roll.
 * - busy: a roll just started elsewhere; an opener station is locked for a moment.
 * - wait: nothing on the course and this station cannot start a roll.
 */
export type StationActionKind = 'open' | 'openNext' | 'record' | 'recorded' | 'busy' | 'wait';

export function stationAction(
  stationId: StationId,
  active: ActiveRollSnapshot | null,
  nowMs: number,
): StationActionKind {
  if (!active) return isOpenerStation(stationId) ? 'open' : 'wait';

  const { records } = active;
  const recordedAt = records[stationId];
  const origin = originStationOf(records);
  const originMs = originMsOf(records);

  if (!isOpenerStation(stationId)) return recordedAt != null ? 'recorded' : 'record';

  if (stationId === 'h1h2' && recordedAt == null && origin === 'start' && originMs != null
    && nowMs - originMs < JOIN_WINDOW_MS) {
    return 'record';
  }

  if (recordedAt != null) {
    return nowMs - recordedAt < RESTART_LOCK_MS ? 'recorded' : 'openNext';
  }

  if (originMs != null && nowMs - originMs < RESTART_LOCK_MS) return 'busy';
  return 'openNext';
}

