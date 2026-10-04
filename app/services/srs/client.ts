import type { PlanEvent, PlanEventDraft } from '../../domain/srsPlan';

/**
 * The SRS backend (srs/backend) as it already exists: no endpoints were added for this app.
 * Production requires the shared password as `?key=` on every request.
 */

const SRS_URL = ((import.meta.env.VITE_SRS_URL as string | undefined) ?? '').replace(/\/+$/, '');
const SRS_KEY = (import.meta.env.VITE_SRS_KEY as string | undefined) ?? '';

export function isSrsConfigured(): boolean {
  return Boolean(SRS_URL);
}

export class SrsError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

function srsUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`${SRS_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  if (SRS_KEY) url.searchParams.set('key', SRS_KEY);
  return url.toString();
}

async function srsJson<T>(path: string, params?: Record<string, string | number>, init?: RequestInit): Promise<T> {
  if (!SRS_URL) throw new SrsError('SRS backend is not configured (VITE_SRS_URL).', null);
  let response: Response;
  try {
    response = await fetch(srsUrl(path, params), init);
  } catch {
    throw new SrsError('Could not reach the SRS backend.', null);
  }
  if (response.status === 401) {
    throw new SrsError('SRS backend rejected the key (check VITE_SRS_KEY).', 401);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${response.status}`;
    throw new SrsError(`SRS backend error: ${detail}`, response.status);
  }
  return response.json() as Promise<T>;
}

export interface SrsBuggy {
  id: number;
  name: string;
  abbreviation: string;
  active: boolean;
}

export interface SrsPusher {
  id: number;
  name: string;
}

/** In the order SRS returns them; the plan page lays its columns out in this order. */
export function fetchBuggies(): Promise<SrsBuggy[]> {
  return srsJson<SrsBuggy[]>('/buggies');
}

export function fetchPushers(): Promise<SrsPusher[]> {
  return srsJson<SrsPusher[]>('/pushers');
}

/** A weekend roll day. The plan page only plans weekend rolls. */
export interface PlanDate {
  year: number;
  month: number;
  day: number;
}

export interface PlanTailResponse {
  roll_date_id: number | null;
  since: number;
  last_seq: number;
  events: PlanEvent[];
}

function planPath({ year, month, day }: PlanDate): string {
  return `/plan/${year}/${month}/${day}`;
}

export function fetchPlanTail(date: PlanDate, since: number): Promise<PlanTailResponse> {
  return srsJson<PlanTailResponse>(planPath(date), { type: 'weekend', since });
}

export function appendPlanEvents(
  date: PlanDate,
  clientId: string,
  events: PlanEventDraft[],
  since: number,
): Promise<PlanTailResponse> {
  return srsJson<PlanTailResponse>(planPath(date), { type: 'weekend', since }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, events }),
  });
}
