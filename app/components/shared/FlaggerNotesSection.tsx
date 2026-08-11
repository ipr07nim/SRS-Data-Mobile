import { useState } from 'react';
import { Block, BlockTitle, Button, List, ListInput, ListItem } from 'konsta/react';
import type { FlaggerNote } from '../../domain/types';

interface FlaggerNotesSectionProps {
  notes: FlaggerNote[];
  onAdd?: (text: string) => void;
  readOnly?: boolean;
}

export function FlaggerNotesSection({ notes, onAdd, readOnly }: FlaggerNotesSectionProps) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed || !onAdd) return;
    onAdd(trimmed);
    setDraft('');
  };

  if (readOnly && notes.length === 0) return null;

  return (
    <Block strong insetMaterial outlineIos className="!my-0">
      <BlockTitle className="!mt-0">Flagger notes</BlockTitle>

      {!readOnly && onAdd && (
        <List strongIos outlineIos className="!my-2">
          <ListInput
            type="textarea"
            placeholder="Add a flagger note..."
            value={draft}
            onChange={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            inputClassName="!h-16 resize-none"
          />
        </List>
      )}

      {!readOnly && onAdd && (
        <Button
          tonal
          className="mb-3"
          disabled={!draft.trim()}
          onClick={handleAdd}
        >
          Add note
        </Button>
      )}

      {notes.length > 0 && (
        <List strongIos outlineIos className="!my-0">
          {notes.map((note) => (
            <ListItem
              key={note.id}
              title={note.text}
              subtitle={`${note.by} · ${new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            />
          ))}
        </List>
      )}
    </Block>
  );
}
