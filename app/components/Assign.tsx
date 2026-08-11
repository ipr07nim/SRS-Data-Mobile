import { useState, useEffect } from 'react';
import { Navigate } from 'react-router';
import {
  Block,
  BlockFooter,
  BlockHeader,
  Button,
  List,
  ListInput,
  ListItem,
} from 'konsta/react';
import { BUGGY_OPTIONS } from '../config/app.config';
import type { HillLabel } from '../config/app.config';
import { roleShowsAssignTab } from '../config/roles';
import { useAppStore } from '../store';

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  active: 'Active',
  done: 'Done',
  scratched: 'Scratched',
};

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-[var(--app-fg-muted)]',
  active: 'text-primary font-semibold',
  done: 'text-green-500',
  scratched: 'text-red-400 line-through',
};

export default function Assign() {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const assignments = useAppStore((s) => s.assignments);
  const updateAssignment = useAppStore((s) => s.updateAssignment);
  const clearAssignments = useAppStore((s) => s.clearAssignments);
  const rollOrder = useAppStore((s) => s.rollOrder);
  const addToRollOrder = useAppStore((s) => s.addToRollOrder);
  const updateRollOrderStatus = useAppStore((s) => s.updateRollOrderStatus);
  const removeFromRollOrder = useAppStore((s) => s.removeFromRollOrder);

  const isPusher = activeRoleView === 'pusher';

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [newBuggy, setNewBuggy] = useState<string>(BUGGY_OPTIONS[0]);
  const [newDriver, setNewDriver] = useState('');

  useEffect(() => {
    const vals: Record<string, string> = {};
    for (const a of assignments) vals[a.hill] = a.pusherName;
    setLocalValues(vals);
  }, [assignments]);

  if (!roleShowsAssignTab(activeRoleView)) {
    return <Navigate to="/" replace />;
  }

  const handleBlur = (hill: HillLabel) => {
    const val = (localValues[hill] ?? '').trim();
    const current = assignments.find((a) => a.hill === hill);
    if (val !== (current?.pusherName ?? '')) {
      void updateAssignment(hill, val);
    }
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const handleAddRollOrder = () => {
    const driver = newDriver.trim();
    void addToRollOrder(newBuggy, driver);
    setNewDriver('');
  };

  const cycleStatus = (id: number, current: string) => {
    const order = ['queued', 'active', 'done', 'scratched'] as const;
    const idx = order.indexOf(current as (typeof order)[number]);
    const next = order[(idx + 1) % order.length];
    void updateRollOrderStatus(id, next);
  };

  return (
    <div className="py-4 flex flex-col gap-2">
      <BlockHeader>{`Today's pusher assignments — ${todayDisplay}`}</BlockHeader>
      <List strong inset>
        {assignments.map((a) => (
          <ListInput
            key={a.hill}
            label={a.hill}
            type="text"
            placeholder={`Pusher for ${a.hill}`}
            value={localValues[a.hill] ?? ''}
            onChange={(e) =>
              setLocalValues((v) => ({ ...v, [a.hill]: (e.target as HTMLInputElement).value }))
            }
            onBlur={() => handleBlur(a.hill)}
            info={a.assignedBy ? `by ${a.assignedBy}` : undefined}
          />
        ))}
      </List>

      {isPusher && (
        <Block className="!mt-0">
          <Button tonal onClick={() => void clearAssignments()}>
            Clear all
          </Button>
        </Block>
      )}

      <BlockHeader className="!mt-6">Roll order</BlockHeader>
      <List strong inset>
        {rollOrder.length === 0 && (
          <ListItem title="No rolls queued yet" className="text-[var(--app-fg-muted)]" />
        )}
        {rollOrder.map((entry) => (
          <ListItem
            key={entry.id}
            title={`#${entry.position} — ${entry.buggy}`}
            subtitle={entry.driver || 'No driver'}
            after={
              <span className="flex items-center gap-2">
                <span className={STATUS_COLORS[entry.status] ?? ''}>
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </span>
                {isPusher && (
                  <button
                    type="button"
                    className="text-xs text-red-400 ml-2"
                    onClick={(e) => { e.stopPropagation(); void removeFromRollOrder(entry.id); }}
                  >
                    Remove
                  </button>
                )}
              </span>
            }
            onClick={() => cycleStatus(entry.id, entry.status)}
          />
        ))}
      </List>

      {isPusher && (
        <>
          <BlockHeader>Add to queue</BlockHeader>
          <List strong inset>
            <ListInput
              label="Buggy"
              type="select"
              value={newBuggy}
              onChange={(e) => setNewBuggy((e.target as HTMLSelectElement).value)}
            >
              {BUGGY_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </ListInput>
            <ListInput
              label="Driver"
              type="text"
              placeholder="Driver name"
              value={newDriver}
              onChange={(e) => setNewDriver((e.target as HTMLInputElement).value)}
            />
          </List>
          <Block>
            <Button large onClick={handleAddRollOrder}>
              Add to roll order
            </Button>
          </Block>
          <BlockFooter className="!mt-0">
            Tap a roll to cycle its status. Swipe left to remove.
          </BlockFooter>
        </>
      )}
    </div>
  );
}
