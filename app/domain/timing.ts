import { HILL_LABELS, STATIONS } from '../config/app.config';
import type { HillLabel, StationId } from '../config/app.config';
import type { RollConfig, SplitResult, StationRecords } from './types';
import { MISSING_SPLIT_TIME } from './types';

/** Format milliseconds as M:SS.CS (centiseconds). Negative values clamp to zero. */
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

/** Hill segment station IDs in course order (excludes start). */
export function hillStationIds(): StationId[] {
  return STATIONS.slice(1).map((s) => s.id);
}

/**
 * Derive per-hill splits from absolute station timestamps.
 * Behavior matches legacy RollSummary inline loop.
 */
export function computeSplits(
  records: StationRecords,
  config: RollConfig,
): SplitResult[] {
  const splits: SplitResult[] = [];
  let previousTime = records.start;

  for (let i = 1; i < STATIONS.length; i++) {
    const segment = STATIONS[i];
    const currentTime = records[segment.id];
    const label = HILL_LABELS[i - 1];
    const pusher = config.pushers[i - 1] || 'Unknown';

    if (currentTime != null && previousTime != null) {
      splits.push({
        label,
        pusher,
        time: formatTime(currentTime - previousTime),
      });
      previousTime = currentTime;
    } else {
      splits.push({
        label,
        pusher,
        time: MISSING_SPLIT_TIME,
      });
    }
  }

  return splits;
}

export function computeTotalElapsedMs(records: StationRecords): number {
  if (records.finish != null && records.start != null) {
    return records.finish - records.start;
  }
  return 0;
}

export function formatTotalElapsed(records: StationRecords): string {
  const ms = computeTotalElapsedMs(records);
  return ms > 0 ? formatTime(ms) : MISSING_SPLIT_TIME;
}
