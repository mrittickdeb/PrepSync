import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { SessionConfigModal } from '@/features/ai-room';
import { useAuthStore } from '@/stores/authStore';
import { connectSocket, disconnectSocket } from '@/services/socket';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ai-room': 'AI Interview',
  '/peer-room': 'Peer Room',
  '/groups': 'Domain Groups',
  '/dms': 'Messages',
  '/history': 'Session History',
  '/settings': 'Settings',
};

export default function AppLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [groupCallActive, setGroupCallActive] = useState(false);
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!groupCallActive) {
        setSidebarCollapsed(window.innerWidth < 1200 && !mobile);
      }
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleOpenModal = () => setShowSessionConfig(true);
    document.addEventListener('open-new-session', handleOpenModal);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('open-new-session', handleOpenModal);
    };
  }, [groupCallActive]);

  // Listen for group-call-mode events to collapse/expand sidebar
  useEffect(() => {
    function handleCallMode(e: Event) {
      const active = (e as CustomEvent).detail?.active ?? false;
      setGroupCallActive(active);
      if (active) {
        setSidebarCollapsed(true);
      } else {
        // Restore based on screen width
        setSidebarCollapsed(window.innerWidth < 1200);
      }
    }
    window.addEventListener('group-call-mode', handleCallMode);
    return () => window.removeEventListener('group-call-mode', handleCallMode);
  }, []);

  // Establish global socket connection for presence and notifications
  useEffect(() => {
    if (user?._id) {
      const socket = connectSocket();
      socket.emit('user:setup', { userId: user._id });

      return () => {
        disconnectSocket();
      };
    }
  }, [user?._id]);

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    Object.entries(PAGE_TITLES).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ||
    'PrepSync';

  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar
        userName={user?.name || 'User'}
        userAvatar={user?.avatarUrl}
        readinessScore={user?.readinessIndex?.overall}
        collapsed={sidebarCollapsed && !isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        onNewSession={() => setShowSessionConfig(true)}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div
        className="transition-all duration-200"
        style={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 64 : 240) }}
      >
        <TopBar 
          title={pageTitle} 
          userName={user?.name || 'User'} 
          userAvatar={user?.avatarUrl}
          onMenuClick={isMobile ? () => setMobileMenuOpen(true) : undefined}
        />
        <Outlet />
      </div>

      {/* AI Interview Session Config Modal */}
      <SessionConfigModal
        isOpen={showSessionConfig}
        onClose={() => setShowSessionConfig(false)}
      />
    </div>
  );
}
