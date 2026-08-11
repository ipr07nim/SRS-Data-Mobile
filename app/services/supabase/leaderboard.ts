import { supabase } from '../../lib/supabase';
import type { LeaderboardEntry, LeaderboardHill } from '../../domain/rolls';
import type { DbLeaderboardCacheRow, LeaderboardCacheEntry } from './types';

function cacheKey(hill: LeaderboardHill, buggy: string): string {
  return `${hill}:${buggy}`;
}

function mapEntry(e: LeaderboardCacheEntry): LeaderboardEntry {
  return {
    rank: e.rank,
    rollId: e.rollId,
    name: e.name,
    driver: e.driver,
    buggy: e.buggy,
    time: e.time,
    timeMs: e.timeMs,
    date: e.date,
    timeDisplay: e.timeDisplay,
  };
}

export async function fetchLeaderboardSlice(
  hill: LeaderboardHill,
  buggyFilter: string,
): Promise<{ entries: LeaderboardEntry[]; computedAt: string | null }> {
  const { data, error } = await supabase
    .from('leaderboard_cache')
    .select('entries, computed_at')
    .eq('hill', hill)
    .eq('buggy_filter', buggyFilter)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { entries: [], computedAt: null };

  const row = data as Pick<DbLeaderboardCacheRow, 'entries' | 'computed_at'>;
  const entries = (row.entries ?? []).map(mapEntry);
  return { entries, computedAt: row.computed_at };
}

export function leaderboardCacheKey(hill: LeaderboardHill, buggy: string): string {
  return cacheKey(hill, buggy);
}
