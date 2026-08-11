import { ACTIVE_ROLL_MAX_AGE_MS } from '../../store/persist';
import { getClientId } from '../../lib/clientId';
import { supabase } from '../../lib/supabase';
import type { StationId } from '../../config/app.config';
import { computeTotalElapsedMs } from '../../domain/timing';
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

function mapRollRow(row: Record<string, unknown>): DbRollRow {
  return {
    id: row.id as number,
    start_time_ms: row.start_time_ms as number,
    driver: row.driver as string | null,
    buggy: row.buggy as string | null,
    total_ms: row.total_ms as number | null,
    weather: row.weather as DbRollRow['weather'],
    notes: (row.notes as string) ?? '',
    flagger_notes: Array.isArray(row.flagger_notes) ? row.flagger_notes : [],
    unreliable_stations: (row.unreliable_stations as string[]) ?? [],
    exported_at: row.exported_at as number | null,
    status: row.status as DbRollRow['status'],
    records: normalizeDbRecords(row.records),
    config_snapshot: row.config_snapshot as RollConfig,
    client_id: row.client_id as string | null,
    video_url: (row.video_url as string | null) ?? null,
    created_at: row.created_at as string,
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

export async function fetchActiveRoll(): Promise<DbRollRow | null> {
  const cutoff = Date.now() - ACTIVE_ROLL_MAX_AGE_MS;
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

export async function createActiveRoll(
  config: RollConfig,
  startTimeMs: number,
  weather: WeatherSnapshot,
): Promise<DbRollRow> {
  const records: StationRecords = {
    start: startTimeMs,
    h1h2: null,
    h2h3: null,
    h3h4: null,
    h4h5: null,
    finish: null,
  };

  const { data, error } = await supabase
    .from('rolls')
    .insert({
      start_time_ms: startTimeMs,
      driver: config.driver,
      buggy: config.buggy,
      weather,
      status: 'active',
      records,
      config_snapshot: config,
      notes: '',
      unreliable_stations: [],
      client_id: getClientId(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapRollRow(data);
}

export async function syncRollRecords(
  rollId: number,
  records: StationRecords,
  unreliableStations: StationId[],
  notes: string,
): Promise<void> {
  const totalMs = computeTotalElapsedMs(records);
  const { error } = await supabase
    .from('rolls')
    .update({
      records,
      unreliable_stations: unreliableStations,
      notes,
      total_ms: totalMs > 0 ? totalMs : null,
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

export async function finalizeRollInDb(
  rollId: number,
  records: StationRecords,
  config: RollConfig,
  weather: WeatherSnapshot,
  notes: string,
  unreliableStations: StationId[],
): Promise<void> {
  const totalMs = computeTotalElapsedMs(records);
  const exportedAt = Date.now();

  const { error: rollErr } = await supabase
    .from('rolls')
    .update({
      records,
      config_snapshot: config,
      weather,
      notes,
      unreliable_stations: unreliableStations,
      total_ms: totalMs,
      exported_at: exportedAt,
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
