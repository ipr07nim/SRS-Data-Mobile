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

/** Subscribe to real-time updates on a single roll row. Returns an object with `unsubscribe()`. */
export function subscribeToRoll(
  rollId: number,
  onChange: (payload: Record<string, unknown>) => void,
): { unsubscribe: () => void; channel: RealtimeChannel } {
  const channel = supabase
    .channel(`roll-${rollId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rolls',
        filter: `id=eq.${rollId}`,
      },
      (payload) => onChange(payload.new as Record<string, unknown>),
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export function unsubscribeFromRoll(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
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
