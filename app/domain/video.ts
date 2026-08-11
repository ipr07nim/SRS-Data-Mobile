import { MAX_ROLL_VIDEO_BYTES } from '../config/app.config';
import type { RollVideoAttachment } from './types';

export async function readVideoFileAsAttachment(file: File): Promise<RollVideoAttachment> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Please select a video file.');
  }
  if (file.size > MAX_ROLL_VIDEO_BYTES) {
    throw new Error('Video must be under 20 MB to save on this device.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read video.'));
    };
    reader.onerror = () => reject(new Error('Could not read video.'));
    reader.readAsDataURL(file);
  });

  return {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: Date.now(),
    dataUrl,
  };
}
