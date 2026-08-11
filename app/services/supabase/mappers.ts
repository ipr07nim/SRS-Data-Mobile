import { HILL_LABELS, STATIONS } from '../../config/app.config';
import type { HillLabel } from '../../config/app.config';
import {
  computeSplits,
  computeTotalElapsedMs,
  formatTime,
  parseFormattedTime,
} from '../../domain/timing';
import type { SavedRoll, SavedRollSplit } from '../../domain/rolls';
import type { FlaggerNote, RollConfig, StationRecords } from '../../domain/types';
import { WEATHER_PLACEHOLDER, type WeatherSnapshot } from '../../domain/weather';
import type { DbRollRow, DbRollSplitRow } from './types';

export function rollIdToString(id: number): string {
  return String(id);
}

export function parseRollId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeDbRecords(raw: unknown): StationRecords {
  const empty = Object.fromEntries(STATIONS.map((s) => [s.id, null])) as StationRecords;
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;
  for (const station of STATIONS) {
    const v = obj[station.id];
    empty[station.id] = typeof v === 'number' ? v : null;
  }
  return empty;
}

export function normalizeFlaggerNotes(raw: unknown): FlaggerNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (n): n is FlaggerNote =>
      n && typeof n === 'object' && typeof n.id === 'string' && typeof n.text === 'string',
  );
}

export function negateRecords(records: StationRecords): StationRecords {
  const next = { ...records };
  for (const station of STATIONS) {
    const v = next[station.id];
    if (v != null) next[station.id] = -Math.abs(v);
  }
  return next;
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

export function dbSplitsToSavedSplits(rows: DbRollSplitRow[]): SavedRollSplit[] {
  const byHill = new Map(rows.map((r) => [r.hill, r]));
  return HILL_LABELS.map((label, i) => {
    const row = byHill.get(i + 1);
    if (!row) {
      return { label, time: '--:--.--', pusher: 'Unknown', splitMs: -1 };
    }
    return {
      label,
      time: row.time_display,
      pusher: row.pusher ?? 'Unknown',
      splitMs: row.split_ms,
    };
  });
}

export function dbRollToSavedRoll(roll: DbRollRow, splits: DbRollSplitRow[]): SavedRoll {
  const records = normalizeDbRecords(roll.records);
  const config = roll.config_snapshot;
  const computedSplits =
    splits.length > 0
      ? dbSplitsToSavedSplits(splits)
      : computeSplits(records, config).map((s) => ({
          label: s.label,
          time: s.time,
          pusher: s.pusher,
          splitMs: parseFormattedTime(s.time),
        }));

  const totalMs = roll.total_ms ?? computeTotalElapsedMs(records);
  const isCancelled = roll.status === 'cancelled' || totalMs < 0;

  return {
    id: rollIdToString(roll.id),
    startTimeMs: Math.abs(roll.start_time_ms),
    dateDisplay: formatDateDisplay(Math.abs(roll.start_time_ms)),
    timeDisplay: formatTimeDisplay(Math.abs(roll.start_time_ms)),
    driver: config.driver || roll.driver || 'Unknown',
    buggy: config.buggy || roll.buggy || 'Unknown',
    total: isCancelled ? formatTime(totalMs) : totalMs > 0 ? formatTime(totalMs) : '--:--.--',
    totalMs,
    weather: roll.weather ?? WEATHER_PLACEHOLDER,
    splits: computedSplits,
    notes: roll.notes ?? '',
    flaggerNotes: normalizeFlaggerNotes(roll.flagger_notes),
    unreliableStations: (roll.unreliable_stations ?? []) as SavedRoll['unreliableStations'],
    exportedAt: roll.exported_at ?? Date.now(),
    video: null,
    videoUrl: roll.video_url ?? null,
    status: roll.status,
  };
}

export function buildSplitRowsForExport(
  rollId: number,
  records: StationRecords,
  config: RollConfig,
): Omit<DbRollSplitRow, 'id'>[] {
  return computeSplits(records, config).map((split, i) => ({
    roll_id: rollId,
    hill: i + 1,
    time_display: split.time,
    split_ms: parseFormattedTime(split.time),
    pusher: split.pusher,
  }));
}

export function isCompletedRollForLeaderboard(roll: DbRollRow): boolean {
  return roll.status === 'completed' && (roll.total_ms ?? 0) > 0;
}

export type SavedRollWithStatus = SavedRoll & { status?: string };
