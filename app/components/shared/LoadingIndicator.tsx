import { Preloader } from 'konsta/react';

interface LoadingIndicatorProps {
  label?: string;
  className?: string;
}

export function LoadingIndicator({
  label = 'Loading…',
  className = '',
}: LoadingIndicatorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Preloader />
      <p className="text-sm font-medium text-[var(--app-fg-muted)]">{label}</p>
    </div>
  );
}
