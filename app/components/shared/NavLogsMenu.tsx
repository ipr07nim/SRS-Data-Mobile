import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useMatch } from 'react-router';
import { Icon, TabbarLink } from 'konsta/react';
import { Clock, StarFill } from 'framework7-icons/react';
import { MdHistory, MdEmojiEvents } from 'react-icons/md';
import { useAppStore } from '../../store';

const ANIM_MS = 300;

const MENU_ITEMS = [
  {
    id: 'logs' as const,
    label: 'Logs',
    path: '/history',
    ios: <Clock className="w-6 h-6" />,
    material: <MdHistory className="w-6 h-6" />,
  },
  {
    id: 'leaderboard' as const,
    label: 'Leaderboard',
    path: '/leaderboard',
    ios: <StarFill className="w-6 h-6" />,
    material: <MdEmojiEvents className="w-6 h-6" />,
  },
];

const menuItemClass = (active: boolean) =>
  `flex flex-col items-center justify-center gap-1 w-full py-3 px-4 ${
    active ? 'text-spirit-gold' : 'text-[var(--nav-inactive)]'
  }`;

export function NavLogsMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const historyDetail = useMatch('/history/:rollId');
  const setHighlightLogsOnNextList = useAppStore((s) => s.setHighlightLogsOnNextList);
  const directToLogsFromRollSummary = useAppStore((s) => s.directToLogsFromRollSummary);
  const linkRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animatingIn, setAnimatingIn] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 96, left: 0 });

  const onRollDetail = Boolean(historyDetail);
  const skipMenuOnDetail = onRollDetail && directToLogsFromRollSummary;
  const isLogsActive = location.pathname.startsWith('/history');
  const isLeaderboardActive = location.pathname === '/leaderboard';
  const isActive = isLogsActive || isLeaderboardActive;

  useEffect(() => {
    if (skipMenuOnDetail) setOpen(false);
  }, [skipMenuOnDetail]);

  useEffect(() => {
    if (open) {
      const el = linkRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setMenuPos({
          bottom: window.innerHeight - rect.top + 12,
          left: rect.left + rect.width / 2,
        });
      }
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimatingIn(true));
      });
    } else if (visible) {
      setAnimatingIn(false);
      const t = setTimeout(() => setVisible(false), ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (linkRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const goToLogsList = () => {
    setHighlightLogsOnNextList(true);
    navigate('/history');
    setOpen(false);
  };

  const handleSelect = (path: string) => {
    if (path === '/history') {
      goToLogsList();
      return;
    }
    navigate(path);
    setOpen(false);
  };

  const handleLogsButtonClick = () => {
    if (skipMenuOnDetail) {
      goToLogsList();
      return;
    }
    setOpen((v) => !v);
  };

  const menu =
    visible && !skipMenuOnDetail && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={`fixed z-[120] -translate-x-1/2 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out origin-bottom ${
              animatingIn
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 translate-y-2'
            }`}
            style={{ bottom: menuPos.bottom, left: menuPos.left }}
            role="menu"
          >
            <div className="flex flex-col min-w-[140px]">
            {MENU_ITEMS.map(({ id, label, path, ios, material }, index) => {
              const itemActive =
                id === 'logs' ? isLogsActive && !onRollDetail : isLeaderboardActive;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(path)}
                  className={`${menuItemClass(itemActive)} ${
                    index < MENU_ITEMS.length - 1 ? 'border-b border-[var(--border-default)]' : ''
                  }`}
                >
                  <Icon ios={ios} material={material} />
                  <span className="text-[10px] font-bold text-center w-full leading-tight">
                    {label}
                  </span>
                </button>
              );
            })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <TabbarLink
        ref={linkRef}
        className="flex-1"
        active={isActive}
        onClick={handleLogsButtonClick}
        icon={
          <Icon
            ios={<Clock className="w-7 h-7" />}
            material={<MdHistory className="w-6 h-6" />}
          />
        }
        label="Logs"
        aria-expanded={open && !skipMenuOnDetail}
        aria-haspopup={skipMenuOnDetail ? undefined : 'menu'}
        aria-label={
          skipMenuOnDetail ? 'Back to logs list' : 'Logs and leaderboard menu'
        }
      />
      {menu}
    </>
  );
}
