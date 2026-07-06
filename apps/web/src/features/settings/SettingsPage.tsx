import { useState } from 'react';
import { PageWrapper } from '@/components/layout';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';

type SettingsTab = 'profile' | 'security' | 'preferences';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const { theme, toggleTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [weeklyGoal, setWeeklyGoal] = useState(user?.weeklyGoal || 5);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const { data } = await api.patch('/users/me', { name, weeklyGoal });
      setUser(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // handle error silently
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'security', label: 'Security', icon: '🔒' },
    { key: 'preferences', label: 'Preferences', icon: '⚙️' },
  ];

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-display text-text-primary font-sans mb-1">Settings</h1>
        <p className="text-body text-text-secondary font-sans">Manage your account and preferences.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 shrink-0">
          <div className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2.5 rounded-md text-body font-sans transition-colors text-left',
                  activeTab === tab.key
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-overlay',
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-border-subtle">
            <Button variant="danger" className="w-full" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-xl">
          {activeTab === 'profile' && (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-heading text-text-primary font-sans font-semibold mb-6">Profile</h3>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-2xl text-accent font-medium">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-body text-text-primary font-sans font-medium">{name}</p>
                  <p className="text-caption text-text-muted font-sans">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-caption text-text-secondary font-sans block mb-1.5">Display Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-2.5 text-body font-sans text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-caption text-text-secondary font-sans block mb-1.5">Weekly Session Goal</label>
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={weeklyGoal}
                    onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <p className="text-caption text-text-muted font-sans mt-1">
                    {weeklyGoal} sessions per week
                  </p>
                </div>
                <div>
                  <label className="text-caption text-text-secondary font-sans block mb-1.5">Target Domains</label>
                  <div className="flex flex-wrap gap-2">
                    {['dsa', 'systemDesign', 'backend', 'conceptual', 'behavioural'].map((d) => {
                      const labels: Record<string, string> = {
                        dsa: 'DSA', systemDesign: 'System Design',
                        backend: 'Backend', conceptual: 'Conceptual', behavioural: 'Behavioural',
                      };
                      const isActive = user?.targetDomains?.includes(d);
                      return (
                        <button
                          key={d}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-caption font-sans transition-colors border',
                            isActive
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border-subtle text-text-muted hover:border-border-default',
                          )}
                        >
                          {labels[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                {saveSuccess && (
                  <span className="text-caption text-green-400 font-sans">✓ Saved!</span>
                )}
                <Button onClick={handleSaveProfile} isLoading={saving}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
                <h3 className="text-heading text-text-primary font-sans font-semibold mb-4">Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-caption text-text-secondary font-sans block mb-1.5">Current Password</label>
                    <input
                      type="password"
                      className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-2.5 text-body font-sans text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-text-secondary font-sans block mb-1.5">New Password</label>
                    <input
                      type="password"
                      className="w-full bg-bg-elevated border border-border-default rounded-md px-4 py-2.5 text-body font-sans text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <Button variant="secondary">Update Password</Button>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
                <h3 className="text-heading text-text-primary font-sans font-semibold mb-2">Active Sessions</h3>
                <p className="text-caption text-text-muted font-sans mb-4">Manage your logged-in devices.</p>
                <div className="bg-bg-overlay rounded-md px-4 py-3 flex items-center justify-between mb-2">
                  <div>
                    <p className="text-body text-text-primary font-sans">Current Device</p>
                    <p className="text-caption text-text-muted font-sans">Active now</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-success" />
                </div>
                <Button variant="danger" size="sm">Revoke All Other Sessions</Button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-heading text-text-primary font-sans font-semibold mb-6">Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-body text-text-primary font-sans">Dark Mode</p>
                    <p className="text-caption text-text-muted font-sans">Toggle between dark and light themes</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={clsx(
                      "w-11 h-6 rounded-full flex items-center p-0.5 transition-colors duration-200 outline-none",
                      theme === 'dark' ? "bg-accent" : "bg-bg-overlay border border-border-subtle"
                    )}
                    aria-label="Toggle dark mode"
                  >
                    <div
                      className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200",
                        theme === 'dark' ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-body text-text-primary font-sans">Sound Effects</p>
                    <p className="text-caption text-text-muted font-sans">Play sounds for notifications and events</p>
                  </div>
                  <div className="w-11 h-6 bg-bg-overlay border border-border-subtle rounded-full flex items-center p-0.5">
                    <div className="w-5 h-5 bg-text-muted rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-body text-text-primary font-sans">Email Notifications</p>
                    <p className="text-caption text-text-muted font-sans">Receive weekly progress reports via email</p>
                  </div>
                  <div className="w-11 h-6 bg-accent rounded-full flex items-center p-0.5">
                    <div className="w-5 h-5 bg-white rounded-full ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
