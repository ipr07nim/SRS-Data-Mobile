import { supabase } from '../../lib/supabase';
import type { RollOrderEntry } from '../../domain/assignments';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchTodayRollOrder(): Promise<RollOrderEntry[]> {
  const today = todayDateString();
  const { data, error } = await supabase
    .from('roll_order')
    .select('*')
    .eq('roll_date', today)
    .order('position');

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as number,
    position: r.position as number,
    buggy: r.buggy as string,
    driver: (r.driver as string) ?? '',
    status: r.status as RollOrderEntry['status'],
  }));
}

export async function addToRollOrder(buggy: string, driver: string): Promise<void> {
  const today = todayDateString();
  const { data: existing } = await supabase
    .from('roll_order')
    .select('position')
    .eq('roll_date', today)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existing?.length ? (existing[0].position as number) + 1 : 1;

  const { error } = await supabase.from('roll_order').insert({
    roll_date: today,
    position: nextPosition,
    buggy,
    driver,
  });
  if (error) throw error;
}

export async function updateRollOrderStatus(
  id: number,
  status: RollOrderEntry['status'],
): Promise<void> {
  const { error } = await supabase
    .from('roll_order')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function removeFromRollOrder(id: number): Promise<void> {
  const { error } = await supabase
    .from('roll_order')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
