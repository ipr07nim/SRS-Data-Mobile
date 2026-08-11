import { supabase } from '../../lib/supabase';

const BUCKET = 'roll-videos';

export async function uploadRollVideo(
  rollId: number,
  file: File,
): Promise<string> {
  const path = `${rollId}/${file.name}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateErr } = await supabase
    .from('rolls')
    .update({ video_url: publicUrl })
    .eq('id', rollId);

  if (updateErr) throw updateErr;

  return publicUrl;
}

export async function deleteRollVideo(rollId: number, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from('rolls').update({ video_url: null }).eq('id', rollId);
}
