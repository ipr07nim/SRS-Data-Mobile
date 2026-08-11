import { Block, BlockTitle, List, ListInput } from 'konsta/react';

interface RollNotesSectionProps {
  notes: string;
  onChange: (notes: string) => void;
  readOnly?: boolean;
}

export function RollNotesSection({ notes, onChange, readOnly }: RollNotesSectionProps) {
  return (
    <Block strong insetMaterial outlineIos className="!my-0">
      <BlockTitle className="!mt-0">Notes</BlockTitle>
      <List strongIos outlineIos>
        <ListInput
          type="textarea"
          placeholder="Add notes about this roll…"
          value={notes}
          disabled={readOnly}
          onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
          onBlur={(e) => onChange((e.target as HTMLTextAreaElement).value)}
          inputClassName="!h-24 resize-none"
        />
      </List>
    </Block>
  );
}
