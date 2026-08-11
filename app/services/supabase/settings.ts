import { getClientId } from '../../lib/clientId';
import { supabase } from '../../lib/supabase';
import type { RoleView } from '../../config/roles';
import type { AppTheme } from '../../store';
import type { DbUserSettingsRow } from './types';

const THEME_SESSION_KEY = 'srs-theme';

export function cacheThemeForBootstrap(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(THEME_SESSION_KEY, theme);
}

export function getCachedThemeForBootstrap(): AppTheme | null {
  if (typeof window === 'undefined') return null;
  const t = sessionStorage.getItem(THEME_SESSION_KEY);
  if (t === 'dark' || t === 'light' || t === 'system') return t;
  return null;
}

export async function loadOrCreateSettings(): Promise<DbUserSettingsRow> {
  const clientId = getClientId();
  const { data: existing, error: fetchErr } = await supabase
    .from('user_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing as DbUserSettingsRow;

  const { data: created, error: insertErr } = await supabase
    .from('user_settings')
    .insert({
      client_id: clientId,
      theme: 'system',
      direct_to_logs: true,
      role_view: 'pusher',
    })
    .select('*')
    .single();

  if (insertErr) throw insertErr;
  return created as DbUserSettingsRow;
}

export async function saveSettings(patch: {
  display_name?: string;
  theme?: AppTheme;
  direct_to_logs?: boolean;
  role_view?: RoleView;
  last_viewed_roll_id?: number | null;
}): Promise<void> {
  const clientId = getClientId();
  const { error } = await supabase
    .from('user_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('client_id', clientId);

  if (error) throw error;
  if (patch.theme) cacheThemeForBootstrap(patch.theme);
}
