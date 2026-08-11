import { Flag } from 'lucide-react';
import type { HillLabel } from '../../config/app.config';
import { HILL_AVERAGES } from '../../config/app.config';

interface SplitTimeRowProps {
  label: string;
  pusher: string;
  time: string;
  flagged?: boolean;
  showAvg?: boolean;
  /** Formatted delta string (e.g. "+0:01.30" or "-0:00.85"). Positive = slower. */
  delta?: string | null;
  deltaPositive?: boolean;
}

export function SplitTimeRow({
  label,
  pusher,
  time,
  flagged = false,
  showAvg = false,
  delta,
  deltaPositive,
}: SplitTimeRowProps) {
  const hill = label as HillLabel;
  const avg = showAvg && hill in HILL_AVERAGES ? HILL_AVERAGES[hill] : null;

  return (
    <div className="flex justify-between items-center p-4 border-b border-neutral-800/50 bg-black/20">
      <div className="flex flex-col">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-[10px] text-slate-500 uppercase font-bold">{pusher}</span>
      </div>
      <div className="flex items-center gap-2">
        {flagged && (
          <Flag size={16} className="text-red-400 shrink-0" aria-label="Unreliable tap" />
        )}
        <div className="flex flex-col items-end">
          <span className="font-mono font-medium text-white">{time}</span>
          {avg && (
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
              AVG: {avg}
            </span>
          )}
          {delta && (
            <span
              className={`text-[9px] font-bold font-mono ${
                deltaPositive ? 'text-red-400' : 'text-green-500'
              }`}
            >
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
