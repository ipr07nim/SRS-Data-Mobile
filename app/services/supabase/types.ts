import type { OriginStation } from '../../config/app.config';
import type { RollConfig, StationRecords } from '../../domain/types';
import type { WeatherSnapshot } from '../../domain/weather';

export type RollStatus = 'active' | 'completed' | 'cancelled';

export interface DbRollRow {
  id: number;
  start_time_ms: number;
  driver: string | null;
  buggy: string | null;
  total_ms: number | null;
  weather: WeatherSnapshot | null;
  notes: string;
  flagger_notes: unknown[];
  unreliable_stations: string[];
  exported_at: number | null;
  status: RollStatus;
  records: StationRecords;
  config_snapshot: RollConfig;
  client_id: string | null;
  video_url: string | null;
  created_at: string;
  /** Null on rolls saved before phone sync; those started at the Hill 1 line. */
  origin_station: OriginStation | null;
  srs_roll_date: string | null;
  srs_roll_number: number | null;
  srs_buggy_id: number | null;
}

export interface DbRollSplitRow {
  id: number;
  roll_id: number;
  hill: number;
  time_display: string;
  split_ms: number;
  pusher: string | null;
}

export interface DbUserSettingsRow {
  id: number;
  client_id: string;
  display_name: string | null;
  theme: string | null;
  direct_to_logs: boolean | null;
  role_view: string | null;
  last_viewed_roll_id: number | null;
}

export interface DbLeaderboardCacheRow {
  hill: string;
  buggy_filter: string;
  entries: LeaderboardCacheEntry[];
  computed_at: string;
}

export interface LeaderboardCacheEntry {
  rank: number;
  rollId: string;
  name: string;
  driver: string;
  buggy: string;
  time: string;
  timeMs: number;
  date: string;
  timeDisplay: string;
}
