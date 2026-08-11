import { useState } from 'react';
import { Dialog, DialogButton, List, ListInput } from 'konsta/react';
import { useAppStore } from '../../store';

export function NameEntryDialog() {
  const displayName = useAppStore((s) => s.displayName);
  const initStatus = useAppStore((s) => s.initStatus);
  const setDisplayName = useAppStore((s) => s.setDisplayName);
  const [value, setValue] = useState('');

  const isOpen = initStatus === 'ready' && !displayName;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
  };

  return (
    <Dialog
      opened={isOpen}
      title="What's your name?"
      content={
        <List nested className="!my-2">
          <ListInput
            type="text"
            placeholder="Enter your name"
            value={value}
            onChange={(e) => setValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
        </List>
      }
      buttons={
        <DialogButton onClick={handleSave} disabled={!value.trim()}>
          Save
        </DialogButton>
      }
    />
  );
}
