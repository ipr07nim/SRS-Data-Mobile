import { Users, Footprints, Wrench, Car, Flag, type LucideIcon } from 'lucide-react';

export type RoleView = 'general' | 'pusher' | 'mechanic' | 'driver' | 'flagger';

export const ROLES: ReadonlyArray<{
  id: RoleView;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: 'general', label: 'General - View Only', Icon: Users },
  { id: 'pusher', label: 'Pushers - Assign, View, & Time', Icon: Footprints },
  { id: 'mechanic', label: 'Mechanics - View Stats & Add Notes', Icon: Wrench },
  { id: 'driver', label: 'Drivers - View Stats & Add Notes', Icon: Car },
  { id: 'flagger', label: 'Flaggers - View & Flag', Icon: Flag },
] as const;

export const GENERAL_ROLE = ROLES.find((r) => r.id === 'general')!;

export const SORTED_OPERATIONAL_ROLES = ROLES.filter((r) => r.id !== 'general').sort((a, b) =>
  a.label.localeCompare(b.label),
);

export function getRoleById(id: RoleView) {
  return ROLES.find((r) => r.id === id) ?? ROLES.find((r) => r.id === 'pusher')!;
}

export function roleShowsAssignTab(view: RoleView): boolean {
  return view === 'pusher' || view === 'mechanic';
}
