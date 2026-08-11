import type { HillLabel, StationId } from '../config/app.config';

export interface RollConfig {
  driver: string;
  buggy: string;
  pushers: string[];
}

export type StationRecords = Record<StationId, number | null>;

export interface SplitResult {
  label: HillLabel;
  pusher: string;
  time: string;
}

export const MISSING_SPLIT_TIME = '--:--.--';

export interface FlaggerNote {
  id: string;
  by: string;
  text: string;
  createdAt: number;
}

/** Video attached to the active or exported roll (stored client-side as data URL). */
export interface RollVideoAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  dataUrl: string;
}
