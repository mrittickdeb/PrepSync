import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

interface SidebarProps {
  userName?: string;
  userAvatar?: string;
  readinessScore?: number;
  onNewSession?: () => void;
  onToggle?: () => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
    </svg>
  );
}

function PeerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DmsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'AI Interview', path: '/ai-room', icon: <AiIcon /> },
  { label: 'Peer Room', path: '/peer-room', icon: <PeerIcon /> },
  { label: 'Domain Groups', path: '/groups', icon: <GroupsIcon /> },
  { label: 'DMs', path: '/dms', icon: <DmsIcon /> },
  { label: 'History', path: '/history', icon: <HistoryIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

export default function Sidebar({
  userName = 'User',
  userAvatar,
  readinessScore,
  onNewSession,
  onToggle,
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const location = useLocation();

  // On mobile, auto-close sidebar when navigating
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen bg-bg-surface border-r border-border-subtle flex flex-col z-50 transition-transform duration-200',
          collapsed ? 'w-16' : 'w-64',
          // Mobile overrides: standard width when open, translate out when closed
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full'
        )}
      >
      {/* Logo + Toggle */}
      <div className={clsx('flex items-center h-16 border-b border-border-subtle shrink-0', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-text-inverse font-mono">PS</span>
          </div>
          {!collapsed && (
            <span className="text-heading text-text-primary font-sans font-semibold">
              PrepSync
            </span>
          )}
        </div>
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
            title="Collapse sidebar"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand toggle when collapsed */}
      {onToggle && collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 w-10 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-accent hover:bg-bg-overlay transition-colors"
          title="Expand sidebar"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Avatar name={userName} imageUrl={userAvatar} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-body text-text-primary font-sans truncate">{userName}</p>
              {readinessScore !== undefined && (
                <p className="text-caption text-text-secondary font-mono">
                  Readiness: {readinessScore}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-[10px] rounded-md text-body font-sans transition-colors duration-150 relative',
                    isActive
                      ? 'text-accent bg-accent-dim'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
                    collapsed && 'justify-center px-0',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-sm" />
                  )}
                  <span className={clsx(collapsed && 'ml-0')}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Explore Community Switcher */}
      <div className={clsx('px-3 pb-2', collapsed && 'px-2')}>
        <NavLink
          to="/community/feed"
          className={clsx(
            'flex items-center gap-3 px-3 py-[10px] rounded-md text-caption font-sans border border-accent/20 hover:border-accent hover:bg-accent-dim text-accent transition-colors duration-150',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? "Explore Community" : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {!collapsed && <span className="font-medium">Explore Community</span>}
        </NavLink>
      </div>

      {/* New Session CTA */}
      <div className={clsx('px-3 pb-4', collapsed && 'px-2')}>
        <Button
          variant="primary"
          className={clsx('w-full', collapsed && 'px-0')}
          onClick={onNewSession}
        >
          {collapsed ? '+' : 'New Session'}
        </Button>
      </div>
    </aside>
    </>
  );
}
