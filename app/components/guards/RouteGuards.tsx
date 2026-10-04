import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { roleShowsAssignTab } from '../../config/roles';
import { useAppStore } from '../../store';
import { LoadingIndicator } from '../shared/LoadingIndicator';

export function AppHydrationGate({ children }: { children: ReactNode }) {
  const initStatus = useAppStore((s) => s.initStatus);
  const initError = useAppStore((s) => s.initError);

  if (initStatus === 'loading' || initStatus === 'idle') {
    return <LoadingIndicator label="Loading…" className="min-h-[60vh]" />;
  }

  if (initStatus === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-red-400 font-bold">Could not load app data</p>
        <p className="text-sm text-[var(--app-fg-muted)]">{initError}</p>
      </div>
    );
  }

  return <>{children}</>;
}

const TIMING_ALLOWED_ROLES = new Set(['pusher', 'flagger']);

export function TimingRouteGuard({ children }: { children: ReactNode }) {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  if (!TIMING_ALLOWED_ROLES.has(activeRoleView)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function SummaryRouteGuard({ children }: { children: ReactNode }) {
  const rollActive = useAppStore((s) => s.rollActive);

  if (!rollActive) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function AssignRouteGuard({ children }: { children: ReactNode }) {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  if (!roleShowsAssignTab(activeRoleView)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function useTimingPathAllowed(): boolean {
  const location = useLocation();
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  if (!location.pathname.startsWith('/timing/')) return true;
  return TIMING_ALLOWED_ROLES.has(activeRoleView);
}
