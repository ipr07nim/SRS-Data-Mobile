import { AnimatedPanelOverlay } from './AnimatedPanelOverlay';

interface WeatherModalProps {
  open: boolean;
  onClose: () => void;
}

export function WeatherModal({ open, onClose }: WeatherModalProps) {
  return (
    <AnimatedPanelOverlay open={open} onClose={onClose} origin="top" title="Weather">
      <p className="text-sm leading-relaxed text-center">
        This Schenley Park weather data is sourced from{' '}
        <span className="font-semibold">Open-Meteo</span>, and is used in rolls data.
      </p>
    </AnimatedPanelOverlay>
  );
}
