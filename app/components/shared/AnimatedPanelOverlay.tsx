import type { ReactNode } from 'react';
import { Button, Navbar, Page, Popup } from 'konsta/react';

export const PANEL_ANIM_MS = 300;

export type PanelOrigin = 'top-left' | 'top-right' | 'top';

interface AnimatedPanelOverlayProps {
  open: boolean;
  onClose: () => void;
  origin: PanelOrigin;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Konsta Popup wrapper — `origin` kept for call-site compatibility (unused). */
export function AnimatedPanelOverlay({
  open,
  onClose,
  title,
  children,
  footer,
}: AnimatedPanelOverlayProps) {
  return (
    <Popup opened={open} onBackdropClick={onClose}>
      <Page>
        <Navbar
          title={title}
          right={
            <Button clear small onClick={onClose}>
              Close
            </Button>
          }
        />
        <div className="p-4 flex flex-col gap-4">
          {children}
          {footer ? <div className="flex flex-col gap-2 mt-2">{footer}</div> : null}
        </div>
      </Page>
    </Popup>
  );
}
