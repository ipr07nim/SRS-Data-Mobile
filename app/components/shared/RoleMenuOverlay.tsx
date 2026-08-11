import { Icon, List, ListItem } from 'konsta/react';
import { Checkmark } from 'framework7-icons/react';
import { MdCheck } from 'react-icons/md';
import type { RoleView } from '../../config/roles';
import { GENERAL_ROLE, SORTED_OPERATIONAL_ROLES } from '../../config/roles';
import { useAppStore } from '../../store';
import { AnimatedPanelOverlay } from './AnimatedPanelOverlay';

interface RoleMenuOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function RoleMenuOverlay({ open, onClose }: RoleMenuOverlayProps) {
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const setActiveRoleView = useAppStore((s) => s.setActiveRoleView);

  const handleSelect = (id: RoleView) => {
    setActiveRoleView(id);
    onClose();
  };

  const roles = [GENERAL_ROLE, ...SORTED_OPERATIONAL_ROLES];

  return (
    <AnimatedPanelOverlay open={open} onClose={onClose} origin="top-left" title="Select your view">
      <List strongIos outlineIos>
        {roles.map(({ id, label, Icon: RoleIcon }) => {
          const isActive = activeRoleView === id;
          return (
            <ListItem
              key={id}
              link
              title={label}
              onClick={() => handleSelect(id)}
              media={<RoleIcon size={22} className="text-primary" />}
              after={
                isActive ? (
                  <Icon
                    ios={<Checkmark className="w-5 h-5 text-primary" />}
                    material={<MdCheck className="w-5 h-5 text-primary" />}
                  />
                ) : undefined
              }
            />
          );
        })}
      </List>
    </AnimatedPanelOverlay>
  );
}
