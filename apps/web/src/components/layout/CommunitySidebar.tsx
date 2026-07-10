import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import Avatar from '../ui/Avatar';

interface CommunitySidebarProps {
  userName?: string;
  userAvatar?: string;
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

function FeedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0-10 10c0 2.5 1 4.8 2.6 6.4L6 17a7 7 0 0 1-1-4 7 7 0 0 1 7-7 7 7 0 0 1 7 7c0 1.5-.5 3-1.4 4.1l1.4 1.4A9.9 9.9 0 0 0 22 12 10 10 0 0 0 12 2z" />
      <path d="M12 6a6 6 0 0 0-6 6c0 1.5.6 2.9 1.5 3.9l1.4-1.4a4 4 0 0 1-.9-2.5 4 4 0 0 1 4-4 4 4 0 0 1 4 4c0 .9-.3 1.8-.9 2.5l1.4 1.4A5.9 5.9 0 0 0 18 12a6 6 0 0 0-6-6z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

const communityNavItems: NavItem[] = [
  { label: 'Social Feed', path: '/community/feed', icon: <FeedIcon /> },
  { label: 'Communities', path: '/community/explore', icon: <ExploreIcon /> },
  { label: 'Watch Video', path: '/community/watch', icon: <WatchIcon /> },
  { label: 'Live Stream', path: '/community/live', icon: <LiveIcon /> },
];

export default function CommunitySidebar({
  userName = 'User',
  userAvatar,
  onToggle,
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
}: CommunitySidebarProps) {
  const location = useLocation();

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
                PrepSync Hub
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

        {/* User Profile Info */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <Avatar name={userName} imageUrl={userAvatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-body text-text-primary font-sans truncate">{userName}</p>
                <p className="text-[10px] text-accent font-sans font-medium uppercase tracking-wider">
                  Community Member
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Social Navigation Links */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          <ul className="flex flex-col gap-0.5">
            {communityNavItems.map((item) => {
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

        {/* Return to Workspace Switcher */}
        <div className={clsx('px-3 pb-4', collapsed && 'px-2')}>
          <NavLink
            to="/dashboard"
            className={clsx(
              'flex items-center gap-3 px-3 py-[10px] rounded-md text-caption font-sans border border-border-subtle hover:border-text-secondary hover:bg-bg-overlay text-text-secondary transition-colors duration-150',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? "Back to Workspace" : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {!collapsed && <span className="font-medium">Back to Workspace</span>}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
