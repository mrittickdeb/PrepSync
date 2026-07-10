import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CommunitySidebar from './CommunitySidebar';
import TopBar from './TopBar';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const COMMUNITY_PAGE_TITLES: Record<string, string> = {
  '/community/feed': 'Social Feed',
  '/community/explore': 'Explore Communities',
  '/community/watch': 'Watch Videos',
  '/community/live': 'Live Streams',
};

export default function CommunityLayout() {
  const location = useLocation();
  useThemeStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarCollapsed(window.innerWidth < 1200 && !mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pageTitle =
    COMMUNITY_PAGE_TITLES[location.pathname] ||
    Object.entries(COMMUNITY_PAGE_TITLES).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ||
    'PrepSync Hub';

  return (
    <div className="min-h-screen bg-bg-base">
      <CommunitySidebar
        userName={user?.name || 'User'}
        userAvatar={user?.avatarUrl}
        collapsed={sidebarCollapsed && !isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
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
    </div>
  );
}
