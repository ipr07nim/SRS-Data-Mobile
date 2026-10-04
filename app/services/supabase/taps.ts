import { isStationId } from '../../config/app.config';
import type { StationId } from '../../config/app.config';
import { getClientId } from '../../lib/clientId';
import { supabase } from '../../lib/supabase';
import { createEmptyRecords } from '../../domain/timing';
import type { StationRecords } from '../../domain/types';

/** Live (not undone) taps for a roll, as station -> shared-clock ms. */
export async function fetchLiveTaps(rollId: number): Promise<StationRecords> {
  const { data, error } = await supabase
    .from('roll_taps')
    .select('station_id, server_ms')
    .eq('roll_id', rollId)
    .is('undone_at', null);
  if (error) throw error;

  const records = createEmptyRecords();
  for (const row of data ?? []) {
    const station = row.station_id as string;
    if (isStationId(station)) records[station] = Number(row.server_ms);
  }
  return records;
}

export type InsertTapResult = 'saved' | 'alreadyTapped';

/** Records a tap. A second phone tapping the same station loses to whoever saved first. */
export async function insertTap(
  rollId: number,
  stationId: StationId,
  serverMs: number,
): Promise<InsertTapResult> {
  const { error } = await supabase.from('roll_taps').insert({
    roll_id: rollId,
    station_id: stationId,
    server_ms: Math.round(serverMs),
    client_id: getClientId(),
  });
  if (!error) return 'saved';
  if (error.code === '23505') return 'alreadyTapped';
  throw error;
}

export async function undoTap(rollId: number, stationId: StationId): Promise<void> {
  const { error } = await supabase
    .from('roll_taps')
    .update({ undone_at: new Date().toISOString() })
    .eq('roll_id', rollId)
    .eq('station_id', stationId)
    .is('undone_at', null);
  if (error) throw error;
}
