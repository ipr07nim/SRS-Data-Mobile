import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  App,
  Page,
  Navbar,
  Link,
  Tabbar,
  TabbarLink,
  ToolbarPane,
  Icon,
} from 'konsta/react';
import { Timer, GearAlt, DocPlaintext } from 'framework7-icons/react';
import { MdTimer, MdSettings, MdAssignment } from 'react-icons/md';
import { getRoleById, roleShowsAssignTab } from '../config/roles';
import { resolveKonstaTheme } from '../lib/platformTheme';
import { useAppStore } from '../store';
import { applyThemeToDocument, resolveTheme } from '../utils/theme';
import { AppHydrationGate } from './guards/RouteGuards';
import { RoleMenuOverlay } from './shared/RoleMenuOverlay';
import { SettingsModal } from './shared/SettingsModal';
import { NavLogsMenu } from './shared/NavLogsMenu';
import { NameEntryDialog } from './shared/NameEntryDialog';
import logoImg from '../assets/Logo.png';

export default function Layout() {
  const [searchParams] = useSearchParams();
  const themePreference = useAppStore((s) => s.theme);
  const [konstaTheme, setKonstaTheme] = useState(() => resolveKonstaTheme(searchParams));
  const [dark, setDark] = useState(() => resolveTheme(themePreference) === 'dark');

  useEffect(() => {
    setKonstaTheme(resolveKonstaTheme(searchParams));
  }, [searchParams]);

  useEffect(() => {
    applyThemeToDocument(themePreference);
    setDark(resolveTheme(themePreference) === 'dark');
    if (themePreference !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyThemeToDocument('system');
      setDark(resolveTheme('system') === 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themePreference]);

  return (
    <App theme={konstaTheme} dark={dark} safeAreas className="h-dvh overflow-hidden">
      <LayoutShell />
    </App>
  );
}

function LayoutShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrate = useAppStore((s) => s.hydrate);
  const activeRoleView = useAppStore((s) => s.activeRoleView);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const RoleIcon = getRoleById(activeRoleView).Icon;
  const showAssignTab = roleShowsAssignTab(activeRoleView);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const timingActive =
    location.pathname === '/' ||
    location.pathname.startsWith('/timing') ||
    location.pathname === '/summary';
  const assignActive = location.pathname.startsWith('/assign');

  return (
    <Page className="flex flex-col h-full bg-[var(--app-bg)] text-[var(--app-fg)]">
      <Navbar
        className="top-0 sticky z-20"
        title={
          <NavLink to="/" className="flex items-center justify-center min-h-[44px]">
            <img src={logoImg} alt="Logo" className="w-11 h-11 object-contain" />
          </NavLink>
        }
        left={
          <Link iconOnly onClick={() => setRoleMenuOpen(true)} aria-label="Select role view">
            <Icon
              ios={<RoleIcon className="w-6 h-6 text-primary" />}
              material={<RoleIcon className="w-6 h-6 text-primary" />}
            />
          </Link>
        }
        right={
          <Link iconOnly onClick={() => setSettingsOpen(true)} aria-label="Open settings">
            <Icon
              ios={<GearAlt className="w-6 h-6 text-primary" />}
              material={<MdSettings className="w-6 h-6 text-primary" />}
            />
          </Link>
        }
      />

      <NameEntryDialog />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RoleMenuOverlay open={roleMenuOpen} onClose={() => setRoleMenuOpen(false)} />

      <main className="flex-1 overflow-y-auto overscroll-y-contain scroll-pane pb-28">
        <AppHydrationGate>
          <Outlet />
        </AppHydrationGate>
      </main>

      <Tabbar labels icons className="left-0 bottom-0 fixed z-20">
        <ToolbarPane>
          <TabbarLink
            className="flex-1"
            active={timingActive}
            onClick={() => navigate('/')}
            icon={
              <Icon
                ios={<Timer className="w-7 h-7" />}
                material={<MdTimer className="w-6 h-6" />}
              />
            }
            label="Timing"
          />
          {showAssignTab && (
            <TabbarLink
              className="flex-1"
              active={assignActive}
              onClick={() => navigate('/assign')}
              icon={
                <Icon
                  ios={<DocPlaintext className="w-7 h-7" />}
                  material={<MdAssignment className="w-6 h-6" />}
                />
              }
              label="Assign"
            />
          )}
          <NavLogsMenu />
        </ToolbarPane>
      </Tabbar>
    </Page>
  );
}
