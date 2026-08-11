import { useState, useEffect } from 'react';
import { Segmented, SegmentedButton } from 'konsta/react';
import { HILL_LABELS } from '../config/app.config';
import type { StationId } from '../config/app.config';
import { formatTime } from '../domain/timing';
import { useAppStore, STATIONS } from '../store';

export function GlobalTimer() {
  const { rollActive, startTime, isFinished, records } = useAppStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let frame: number;
    const update = () => {
      if (rollActive && startTime) {
        if (isFinished && records.finish) {
          setElapsed(records.finish - startTime);
          return;
        }

        setElapsed(Date.now() - startTime);
        frame = requestAnimationFrame(update);
      }
    };

    if (rollActive) {
      frame = requestAnimationFrame(update);
    } else {
      setElapsed(0);
    }
    return () => cancelAnimationFrame(frame);
  }, [rollActive, startTime, isFinished, records.finish]);

  if (!rollActive) {
    return <div className="text-3xl font-mono font-bold text-slate-grey">0:00.00</div>;
  }

  return (
    <div className={`text-3xl font-mono font-bold ${isFinished ? 'text-spirit-gold' : 'text-white'}`}>
      {formatTime(elapsed)}
    </div>
  );
}

export function CourseProgress() {
  const { records, unreliableStations, rollActive, isFinished, toggleStationUnreliable } =
    useAppStore();

  const canToggleFlags = rollActive && !isFinished;

  return (
    <Segmented strong className="w-full mt-6">
      {STATIONS.slice(1).map((station, index) => {
        const isRecorded = records[station.id] !== null;
        const isFlagged = Boolean(unreliableStations[station.id]);
        const canToggle = canToggleFlags && isRecorded;

        return (
          <SegmentedButton
            key={station.id}
            active={isRecorded}
            disabled={!canToggle}
            onClick={
              canToggle
                ? () => toggleStationUnreliable(station.id as StationId)
                : undefined
            }
            aria-label={
              canToggle ? `Toggle late tap flag for ${HILL_LABELS[index]}` : undefined
            }
            className={
              isRecorded
                ? `!bg-primary !text-black font-semibold ${isFlagged ? 'ring-2 ring-primary/80' : ''}`
                : 'text-neutral-400'
            }
          >
            {HILL_LABELS[index]}
          </SegmentedButton>
        );
      })}
    </Segmented>
  );
}
