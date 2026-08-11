import { Flag, RotateCcw } from 'lucide-react';

interface StationCornerActionsProps {
  showUndo: boolean;
  showFlag: boolean;
  isFlagged: boolean;
  onUndo: () => void;
  onFlag: () => void;
}

export function StationCornerActions({
  showUndo,
  showFlag,
  isFlagged,
  onUndo,
  onFlag,
}: StationCornerActionsProps) {
  return (
    <>
      {showFlag && (
        <button
          type="button"
          onClick={onFlag}
          className={`fixed bottom-28 left-6 z-40 w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-95 border-2 transition-colors duration-300 ${
            isFlagged
              ? 'bg-spirit-gold border-spirit-gold text-black'
              : 'bg-neutral-800 border-spirit-gold/50 text-spirit-gold'
          }`}
          aria-label="Toggle late tap flag"
        >
          <Flag size={20} />
          <span className="text-[8px] font-bold uppercase mt-0.5">Flag</span>
        </button>
      )}
      {showUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="fixed bottom-28 right-6 z-40 w-14 h-14 rounded-full bg-neutral-800 border-2 border-spirit-gold flex flex-col items-center justify-center text-spirit-gold shadow-lg active:scale-95"
          aria-label="Undo tap"
        >
          <RotateCcw size={20} />
          <span className="text-[8px] font-bold uppercase mt-0.5">Undo</span>
        </button>
      )}
    </>
  );
}
