import { ACTIVE_ROLL_MAX_AGE_MS } from '../../config/app.config';
import type { OriginStation, StationId } from '../../config/app.config';
import { getClientId } from '../../lib/clientId';
import { sharedNow } from '../../lib/serverClock';
import { supabase } from '../../lib/supabase';
import { computeTotalElapsedMs, createEmptyRecords } from '../../domain/timing';
import type { RollConfig, StationRecords } from '../../domain/types';
import type { WeatherSnapshot } from '../../domain/weather';
import {
  buildSplitRowsForExport,
  dbRollToSavedRoll,
  negateRecords,
  normalizeDbRecords,
} from './mappers';
import type { SavedRoll } from '../../domain/rolls';
import type { DbRollRow, DbRollSplitRow } from './types';

/** The SRS plan entry a roll was timed for. */
export interface SrsRollLink {
  rollDate: string;
  rollNumber: number;
  buggyId: number;
}

function mapRollRow(row: Record<string, unknown>): DbRollRow {
  const origin = row.origin_station;
  return {
    id: row.id as number,
    start_time_ms: Number(row.start_time_ms),
    driver: row.driver as string | null,
    buggy: row.buggy as string | null,
    total_ms: row.total_ms == null ? null : Number(row.total_ms),
    weather: row.weather as DbRollRow['weather'],
    notes: (row.notes as string) ?? '',
    flagger_notes: Array.isArray(row.flagger_notes) ? row.flagger_notes : [],
    unreliable_stations: (row.unreliable_stations as string[]) ?? [],
    exported_at: row.exported_at == null ? null : Number(row.exported_at),
    status: row.status as DbRollRow['status'],
    records: normalizeDbRecords(row.records),
    config_snapshot: row.config_snapshot as RollConfig,
    client_id: row.client_id as string | null,
    video_url: (row.video_url as string | null) ?? null,
    created_at: row.created_at as string,
    origin_station: origin === 'start' || origin === 'h1h2' ? origin : null,
    srs_roll_date: (row.srs_roll_date as string | null) ?? null,
    srs_roll_number: row.srs_roll_number == null ? null : Number(row.srs_roll_number),
    srs_buggy_id: row.srs_buggy_id == null ? null : Number(row.srs_buggy_id),
  };
}

export async function fetchCompletedRolls(): Promise<SavedRoll[]> {
  const { data: rolls, error } = await supabase
    .from('rolls')
    .select('*')
    .in('status', ['completed', 'cancelled'])
    .order('start_time_ms', { ascending: false });

  if (error) throw error;
  if (!rolls?.length) return [];

  const ids = rolls.map((r) => r.id as number);
  const { data: splits, error: splitErr } = await supabase
    .from('roll_splits')
    .select('*')
    .in('roll_id', ids);

  if (splitErr) throw splitErr;

  const splitsByRoll = new Map<number, DbRollSplitRow[]>();
  for (const s of splits ?? []) {
    const rollId = s.roll_id as number;
    const list = splitsByRoll.get(rollId) ?? [];
    list.push(s as DbRollSplitRow);
    splitsByRoll.set(rollId, list);
  }

  return rolls.map((r) => {
    const mapped = mapRollRow(r);
    return dbRollToSavedRoll(mapped, splitsByRoll.get(mapped.id) ?? []);
  });
}

/** The roll on the course right now: the newest active roll started recently. */
export async function fetchActiveRoll(): Promise<DbRollRow | null> {
  const cutoff = Math.round(sharedNow() - ACTIVE_ROLL_MAX_AGE_MS);
  const { data, error } = await supabase
    .from('rolls')
    .select('*')
    .eq('status', 'active')
    .gte('start_time_ms', cutoff)
    .order('start_time_ms', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRollRow(data);
}

export async function createActiveRoll(params: {
  config: RollConfig;
  originStation: OriginStation;
  originMs: number;
  srs: SrsRollLink | null;
  weather: WeatherSnapshot;
}): Promise<DbRollRow> {
  const { config, originStation, originMs, srs, weather } = params;
  const records: StationRecords = { ...createEmptyRecords(), [originStation]: Math.round(originMs) };

  const { data, error } = await supabase
    .from('rolls')
    .insert({
      start_time_ms: Math.round(originMs),
      driver: config.driver,
      buggy: config.buggy,
      weather,
      status: 'active',
      records,
      config_snapshot: config,
      notes: '',
      unreliable_stations: [],
      client_id: getClientId(),
      origin_station: originStation,
      srs_roll_date: srs?.rollDate ?? null,
      srs_roll_number: srs?.rollNumber ?? null,
      srs_buggy_id: srs?.buggyId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapRollRow(data);
}

/** Notes and late-tap flags. Taps live in roll_taps and are never written here mid-roll. */
export async function syncRollMeta(
  rollId: number,
  unreliableStations: StationId[],
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from('rolls')
    .update({
      unreliable_stations: unreliableStations,
      notes,
    })
    .eq('id', rollId)
    .eq('status', 'active');

  if (error) throw error;
}

export async function cancelRollInDb(rollId: number, records: StationRecords): Promise<void> {
  const negated = negateRecords(records);
  const totalMs = computeTotalElapsedMs(negated);
  const { error } = await supabase
    .from('rolls')
    .update({
      records: negated,
      total_ms: totalMs !== 0 ? totalMs : negated.start != null ? -Math.abs(negated.start) : null,
      status: 'cancelled',
    })
    .eq('id', rollId);

  if (error) throw error;
}

/** Saves a roll as completed with whatever stations were tapped; finish is not required. */
export async function finalizeRollInDb(
  rollId: number,
  params: {
    records: StationRecords;
    config: RollConfig;
    weather: WeatherSnapshot | null;
    notes: string;
    unreliableStations: StationId[];
  },
): Promise<void> {
  const { records, config, weather, notes, unreliableStations } = params;
  const totalMs = computeTotalElapsedMs(records);

  const { error: rollErr } = await supabase
    .from('rolls')
    .update({
      records,
      config_snapshot: config,
      weather,
      notes,
      unreliable_stations: unreliableStations,
      total_ms: totalMs > 0 ? totalMs : null,
      exported_at: Date.now(),
      status: 'completed',
      driver: config.driver,
      buggy: config.buggy,
    })
    .eq('id', rollId);

  if (rollErr) throw rollErr;

  const splitRows = buildSplitRowsForExport(rollId, records, config);
  const { error: splitErr } = await supabase.from('roll_splits').upsert(splitRows, {
    onConflict: 'roll_id,hill',
  });

  if (splitErr) throw splitErr;
}

export async function syncFlaggerNotes(rollId: number, notes: unknown[]): Promise<void> {
  const { error } = await supabase
    .from('rolls')
    .update({ flagger_notes: notes })
    .eq('id', rollId);
  if (error) throw error;
}

export async function updateRollNotes(rollId: number, notes: string): Promise<void> {
  const { error } = await supabase.from('rolls').update({ notes }).eq('id', rollId);
  if (error) throw error;
}

export async function deleteRoll(rollId: number): Promise<void> {
  const { error } = await supabase.from('rolls').delete().eq('id', rollId);
  if (error) throw error;
}
