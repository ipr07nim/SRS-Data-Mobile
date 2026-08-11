import type { ReactNode } from 'react';

interface HorizontalScrollRowProps {
  children: ReactNode;
  className?: string;
}

/** Horizontally scrollable chip row, centered when content fits; scrollbar hidden. */
export function HorizontalScrollRow({ children, className = '' }: HorizontalScrollRowProps) {
  return (
    <div className={`w-full flex justify-center ${className}`}>
      <div className="max-w-full overflow-x-auto scrollbar-hide scroll-pane-x">
        <div className="flex gap-2 w-max mx-auto px-1 pb-1 justify-center">{children}</div>
      </div>
    </div>
  );
}
