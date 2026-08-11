import type { HillLabel } from '../config/app.config';

export interface Assignment {
  hill: HillLabel;
  pusherName: string;
  assignedBy: string;
  updatedAt: string;
}

export interface RollOrderEntry {
  id: number;
  position: number;
  buggy: string;
  driver: string;
  status: 'queued' | 'active' | 'done' | 'scratched';
}
