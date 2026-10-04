import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** Subscribe to tap inserts and undos for one roll. Returns an object with `unsubscribe()`. */
export function subscribeToRollTaps(
  rollId: number,
  onChange: () => void,
): { unsubscribe: () => void; channel: RealtimeChannel } {
  const channel = supabase
    .channel(`roll-taps-${rollId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'roll_taps',
        filter: `roll_id=eq.${rollId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

/** Subscribe to INSERT/UPDATE/DELETE on an entire table. */
export function subscribeToTable(
  channelName: string,
  table: string,
  onChange: () => void,
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
