import { List, ListInput } from 'konsta/react';
import { useAppStore } from '../../store';

const labelColors = {
  labelTextIos: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextMaterial: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextFocusIos: 'text-xs text-neutral-400 font-medium tracking-wide',
  labelTextFocusMaterial: 'text-xs text-primary font-medium tracking-wide',
};

export function PusherConfigPanel() {
  const config = useAppStore((s) => s.config);
  const rollActive = useAppStore((s) => s.rollActive);
  const setConfig = useAppStore((s) => s.setConfig);
  const disabled = rollActive;

  return (
    <List strong inset>
      {config.pushers.map((name, i) => (
        <ListInput
          key={i}
          label={`Pusher ${i + 1} (H${i + 1})`}
          type="text"
          placeholder="Name"
          value={name}
          disabled={disabled}
          colors={labelColors}
          inputClassName="text-base font-normal"
          onChange={(e) => {
            const newPushers = [...config.pushers];
            newPushers[i] = (e.target as HTMLInputElement).value;
            setConfig({ ...config, pushers: newPushers });
          }}
        />
      ))}
    </List>
  );
}
