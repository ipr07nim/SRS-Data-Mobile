import { useState, useEffect } from 'react';
import {
  Block,
  BlockFooter,
  BlockHeader,
  Button,
  Icon,
  Link,
  List,
  ListInput,
  ListItem,
  Navbar,
  Segmented,
  SegmentedButton,
  Sheet,
  Toggle,
} from 'konsta/react';
import { AntFill } from 'framework7-icons/react';
import { MdBugReport } from 'react-icons/md';
import { SUPPORT_EMAIL } from '../../config/app.config';
import { buildBugReportMailto } from '../../domain/rolls';
import { useAppStore, type AppTheme } from '../../store';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { id: AppTheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const displayName = useAppStore((s) => s.displayName);
  const setDisplayName = useAppStore((s) => s.setDisplayName);
  const directToLogsFromRollSummary = useAppStore((s) => s.directToLogsFromRollSummary);
  const setDirectToLogsFromRollSummary = useAppStore((s) => s.setDirectToLogsFromRollSummary);

  const [nameValue, setNameValue] = useState(displayName);
  useEffect(() => {
    if (open) setNameValue(displayName);
  }, [open, displayName]);

  const handleNameBlur = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) setDisplayName(trimmed);
  };

  return (
    <Sheet
      opened={open}
      backdrop
      onBackdropClick={onClose}
      className="pb-safe max-h-[85vh] flex flex-col"
    >
      <Navbar
        title="Settings"
        right={<Link onClick={onClose}>Close</Link>}
        className="!relative shrink-0"
      />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-safe flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-3">
          <BlockHeader className="!my-0 !mx-0 !px-0">Your name</BlockHeader>
          <List strong className="!my-0 overflow-hidden rounded-2xl">
            <ListInput
              type="text"
              placeholder="Enter your name"
              value={nameValue}
              onChange={(e) => setNameValue((e.target as HTMLInputElement).value)}
              onBlur={handleNameBlur}
            />
          </List>
        </div>

        <div className="flex flex-col gap-3">
          <BlockHeader className="!my-0 !mx-0 !px-0">Appearance</BlockHeader>
          <Segmented strong rounded>
            {THEME_OPTIONS.map(({ id, label }) => (
              <SegmentedButton
                key={id}
                active={theme === id}
                onClick={() => setTheme(id)}
              >
                {label}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>

        <div className="flex flex-col gap-2">
          <List strong className="!my-0 overflow-hidden rounded-2xl">
            <ListItem
              title="Direct to Logs from roll summary"
              after={
                <Toggle
                  checked={directToLogsFromRollSummary}
                  onChange={() =>
                    setDirectToLogsFromRollSummary(!directToLogsFromRollSummary)
                  }
                />
              }
            />
          </List>
          <BlockFooter className="!mt-0 !mx-0">
            When on, tapping Logs while viewing a past roll opens the logs list directly (with your
            last viewed roll highlighted). When off, the Logs and Leaderboard menu always appears.
          </BlockFooter>
        </div>

        <Block className="text-center !my-0 !px-0">
          <Icon
            ios={<AntFill className="w-8 h-8 text-primary mx-auto mb-3" />}
            material={<MdBugReport className="w-8 h-8 text-primary mx-auto mb-3" />}
          />
          <p className="text-sm leading-relaxed text-left mb-4">
            Found something wrong with the SRS Data App? Tap below to email the SRS Data team with
            details. Include what you were doing and what you expected to happen.
          </p>
          <Button large href={buildBugReportMailto(SUPPORT_EMAIL)} className="w-full">
            Send bug fixes email
          </Button>
        </Block>
      </div>
    </Sheet>
  );
}
