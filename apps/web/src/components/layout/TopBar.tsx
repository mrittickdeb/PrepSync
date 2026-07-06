import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import Avatar from '../ui/Avatar';
import { useNotificationStore } from '@/stores/notificationStore';

interface TopBarProps {
  title: string;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  onMenuClick?: () => void;
}

export default function TopBar({
  title,
  userName = 'User',
  userAvatar,
  onLogout,
  onMenuClick,
}: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    if (dropdownOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, notificationsOpen]);

  return (
    <header className="h-16 border-b border-border-subtle bg-bg-base flex items-center justify-between px-4 md:px-8 shrink-0">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <h1 className="text-title text-text-primary font-sans truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification bell dropdown */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setDropdownOpen(false);
            }}
            className="text-text-muted hover:text-text-secondary transition-colors p-2 rounded-md hover:bg-bg-overlay relative flex items-center justify-center"
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-bg-base">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg py-1 z-50 max-h-96 overflow-y-auto">
              <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="font-semibold text-body text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-xs text-accent hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-border-subtle">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-caption text-text-muted">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif._id}
                      onClick={() => {
                        markAsRead(notif._id);
                        navigate(notif.link);
                        setNotificationsOpen(false);
                      }}
                      className={clsx(
                        "px-4 py-3 hover:bg-bg-overlay transition-colors cursor-pointer flex gap-3 items-start",
                        !notif.read && "bg-accent-dim/30"
                      )}
                    >
                      <div className="mt-0.5 text-lg">
                        {notif.type === 'dm' ? '💬' : notif.type === 'reply' ? '↩️' : '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx("text-body text-text-primary font-sans truncate", !notif.read && "font-semibold")}>
                          {notif.title}
                        </p>
                        <p className="text-caption text-text-muted font-sans line-clamp-2 mt-0.5">
                          {notif.body}
                        </p>
                        <span className="text-[10px] text-text-muted block mt-1">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif._id);
                        }}
                        className="text-text-muted hover:text-danger p-0.5 rounded"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-bg-overlay transition-colors"
          >
            <Avatar name={userName} imageUrl={userAvatar} size="sm" />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={clsx('text-text-muted transition-transform duration-150', dropdownOpen && 'rotate-180')}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2 border-b border-border-subtle">
                <p className="text-body text-text-primary font-sans truncate">{userName}</p>
              </div>
              <a
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-body text-text-secondary hover:text-text-primary hover:bg-bg-overlay transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </a>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout?.();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-body text-danger hover:bg-danger-dim transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
