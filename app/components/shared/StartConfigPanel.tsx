import { BlockHeader, List, ListInput } from 'konsta/react';
import { BUGGY_OPTIONS, type BuggyName } from '../../config/app.config';
import { useAppStore } from '../../store';
import { PusherConfigPanel } from './PusherConfigPanel';

const labelColors = {
  labelTextIos: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextMaterial: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextFocusIos: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextFocusMaterial: 'text-xs text-primary font-medium tracking-wide',
};

export function StartConfigPanel() {
  const config = useAppStore((s) => s.config);
  const rollActive = useAppStore((s) => s.rollActive);
  const setConfig = useAppStore((s) => s.setConfig);
  const disabled = rollActive;

  return (
    <>
      <BlockHeader>Roll configuration</BlockHeader>
      <List strong inset>
        <ListInput
          label="Driver"
          type="text"
          placeholder="Name"
          value={config.driver}
          disabled={disabled}
          colors={labelColors}
          inputClassName="text-base font-normal"
          onChange={(e) =>
            setConfig({ ...config, driver: (e.target as HTMLInputElement).value })
          }
        />
        <ListInput
          label="Buggy"
          type="select"
          placeholder="Select buggy"
          dropdown
          value={config.buggy}
          disabled={disabled}
          colors={labelColors}
          inputClassName="text-base font-normal"
          onChange={(e) =>
            setConfig({ ...config, buggy: (e.target as HTMLSelectElement).value as BuggyName })
          }
        >
          {BUGGY_OPTIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </ListInput>
      </List>

      <BlockHeader>Hill pushers (H1–H5)</BlockHeader>
      <PusherConfigPanel />
    </>
  );
}
