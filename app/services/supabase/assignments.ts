import { supabase } from '../../lib/supabase';
import { HILL_LABELS } from '../../config/app.config';
import type { HillLabel } from '../../config/app.config';
import type { Assignment } from '../../domain/assignments';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchTodayAssignments(): Promise<Assignment[]> {
  const today = todayDateString();
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('roll_date', today)
    .order('hill');

  if (error) throw error;

  const byHill = new Map((data ?? []).map((r) => [r.hill as string, r]));

  return HILL_LABELS.map((hill) => {
    const row = byHill.get(hill);
    return {
      hill,
      pusherName: (row?.pusher_name as string) ?? '',
      assignedBy: (row?.assigned_by as string) ?? '',
      updatedAt: (row?.updated_at as string) ?? '',
    };
  });
}

export async function upsertAssignment(
  hill: HillLabel,
  pusherName: string,
  assignedBy: string,
): Promise<void> {
  const today = todayDateString();
  const { error } = await supabase
    .from('assignments')
    .upsert(
      {
        roll_date: today,
        hill,
        pusher_name: pusherName,
        assigned_by: assignedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'roll_date,hill' },
    );
  if (error) throw error;
}

export async function clearAssignments(): Promise<void> {
  const today = todayDateString();
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('roll_date', today);
  if (error) throw error;
}
