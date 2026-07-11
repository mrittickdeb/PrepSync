import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout, CommunityLayout } from '@/components/layout';
import { PageWrapper } from '@/components/layout';
import { ToastProvider } from '@/components/ui';
import {
  SignupPage,
  LoginPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  OnboardingPage,
  AuthCallbackPage,
} from '@/features/auth';
import { DashboardPage } from '@/features/dashboard';
import { AIRoomPage, EvaluationReportPage } from '@/features/ai-room';
import { PeerRoomPage, JoinRoomPage } from '@/features/peer-room';
import { DomainGroupsPage } from '@/features/groups';
import { DMsPage } from '@/features/dms';
import { SessionHistoryPage } from '@/features/history';
import { SettingsPage } from '@/features/settings';
import AuthGuard from '@/components/guards/AuthGuard';

// Community Features
import SocialFeedPage from '@/features/feed/SocialFeedPage';
import ExploreCommunitiesPage from '@/features/communities/ExploreCommunitiesPage';
import CommunityDetailPage from '@/features/communities/CommunityDetailPage';
import VideoCatalogPage from '@/features/watch/VideoCatalogPage';
import VideoDetailPage from '@/features/watch/VideoDetailPage';
import LiveStreamsPage from '@/features/stream/LiveStreamsPage';
import LiveStreamViewPage from '@/features/stream/LiveStreamViewPage';

// Placeholder for protected pages — replaced as features are built
function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageWrapper>
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-display text-text-primary font-sans mb-2">{title}</h2>
        <p className="text-body text-text-secondary">This page is under construction.</p>
      </div>
    </PageWrapper>
  );
}

// Landing page
function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 text-center max-w-2xl mx-auto px-4">
        <p className="text-[11px] uppercase tracking-[0.08em] text-accent font-sans font-medium mb-4">
          Interview simulation platform
        </p>
        <h1 className="text-[52px] leading-[1.1] font-semibold text-text-primary font-sans mb-6">
          Get interview-ready.<br />Not just LeetCode-ready.
        </h1>
        <p className="text-heading text-text-secondary font-sans mb-8 max-w-lg mx-auto">
          Practice with AI interviewers, collaborate with peers, track your readiness — all in one tab.
        </p>
        <div className="flex items-center justify-center gap-4 mb-4">
          <a
            href="/signup"
            className="inline-flex items-center px-6 py-3 bg-accent text-text-inverse font-sans font-medium rounded-md hover:bg-[#00BBDF] transition-colors"
          >
            Start for free
          </a>
          <a
            href="/login"
            className="inline-flex items-center px-6 py-3 text-text-secondary font-sans font-medium hover:text-text-primary transition-colors"
          >
            See how it works →
          </a>
        </div>
        <p className="text-caption text-text-muted font-sans">
          No credit card. No setup. Start in 60 seconds.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Auth callback (magic link / Google OAuth) */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/magic" element={<PlaceholderPage title="Signing in..." />} />
        <Route path="/room/:inviteCode" element={<JoinRoomPage />} />

        {/* Protected routes (inside app layout + auth guard) */}
        <Route
          element={
            <AuthGuard requireOnboarding>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ai-room" element={
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-accent-dim flex items-center justify-center mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                  <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
                </svg>
              </div>
              <h2 className="text-display text-text-primary font-sans mb-3">AI Interview Simulator</h2>
              <p className="text-body text-text-secondary mb-8 max-w-md text-center">
                Practice realistic technical and behavioral interviews with an AI interviewer. Get detailed feedback on your performance.
              </p>
              <button 
                onClick={() => document.dispatchEvent(new CustomEvent('open-new-session'))}
                className="px-6 py-3 bg-accent text-text-inverse rounded-md font-medium hover:bg-[#00BBDF] transition-colors"
                style={{ cursor: 'pointer' }}
              >
                Start New Session
              </button>
            </div>
          } />
          <Route path="/ai-room/:sessionId" element={<AIRoomPage />} />
          <Route path="/ai-room/:sessionId/report" element={<EvaluationReportPage />} />
          <Route path="/peer-room" element={<PeerRoomPage />} />
          <Route path="/peer-room/:inviteCode" element={<PeerRoomPage />} />
          <Route path="/groups" element={<DomainGroupsPage />} />
          <Route path="/groups/:groupId" element={<DomainGroupsPage />} />
          <Route path="/dms" element={<DMsPage />} />
          <Route path="/dms/:threadId" element={<DMsPage />} />
          <Route path="/history" element={<SessionHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Community Hub routes (inside community layout + auth guard) */}
        <Route
          element={
            <AuthGuard requireOnboarding>
              <CommunityLayout />
            </AuthGuard>
          }
        >
          <Route path="/community/feed" element={<SocialFeedPage />} />
          <Route path="/community/explore" element={<ExploreCommunitiesPage />} />
          <Route path="/community/explore/:communityId" element={<CommunityDetailPage />} />
          <Route path="/community/watch" element={<VideoCatalogPage />} />
          <Route path="/community/watch/:videoId" element={<VideoDetailPage />} />
          <Route path="/community/live" element={<LiveStreamsPage />} />
          <Route path="/community/live/:streamId" element={<LiveStreamViewPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
