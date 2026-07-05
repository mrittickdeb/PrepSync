import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const loginAction = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    try {
      await loginAction(email, password, rememberMe);
      navigate(redirect || '/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; code?: string } } };
      const code = error.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email first.');
      } else if (code === 'ACCOUNT_LOCKED') {
        setError('Account locked. Try again in 15 minutes.');
      } else {
        setError(error.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError('Enter your email to receive a magic link');
      return;
    }
    setIsLoading(true);
    try {
      const { sendMagicLink } = await import('@/services/auth.service');
      await sendMagicLink(email);
      setMagicLinkSent(true);
    } catch {
      setError('Failed to send magic link. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center bg-bg-base px-8">
        <div className="w-full max-w-[420px]">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <span className="text-[11px] font-bold text-text-inverse font-mono">PS</span>
            </div>
            <span className="text-heading text-text-primary font-sans font-semibold">PrepSync</span>
          </Link>

          <h1 className="text-display text-text-primary font-sans mb-2">Welcome back</h1>
          <p className="text-body text-text-secondary mb-8">Sign in to continue your preparation.</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-md bg-danger-dim border border-danger/20 text-body text-danger">
              {error}
            </div>
          )}

          {magicLinkSent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-accent-dim flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="text-title text-text-primary font-sans mb-2">Check your email</h2>
              <p className="text-body text-text-secondary">
                We sent a magic link to <span className="text-text-primary">{email}</span>
              </p>
              <button
                onClick={() => { setMagicLinkSent(false); setShowMagicLink(false); }}
                className="text-accent text-body hover:underline mt-4"
              >
                Back to login
              </button>
            </div>
          ) : showMagicLink ? (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Send magic link
              </Button>
              <button
                type="button"
                onClick={() => setShowMagicLink(false)}
                className="text-accent text-body hover:underline text-center"
              >
                Back to password login
              </button>
            </form>
          ) : (
            <>
              {/* Google OAuth */}
              <button
                type="button"
                onClick={() => {
                  if (redirect) localStorage.setItem('authRedirect', redirect);
                  window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google`;
                }}
                className="w-full flex items-center justify-center gap-3 px-5 py-[10px] border border-border-default rounded-md text-body text-text-primary font-sans hover:bg-bg-overlay transition-colors mb-6"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-border-subtle" />
                <span className="text-caption text-text-muted">or</span>
                <div className="flex-1 h-px bg-border-subtle" />
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border-default bg-bg-elevated accent-accent"
                    />
                    <span className="text-body text-text-secondary">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-body text-accent hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                  Sign in
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setShowMagicLink(true)}
                className="w-full text-center text-body text-text-secondary hover:text-text-primary mt-4 transition-colors"
              >
                Sign in with magic link →
              </button>
            </>
          )}

          <p className="text-body text-text-secondary mt-6 text-center">
            Don't have an account?{' '}
            <Link to={`/signup${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`} className="text-accent hover:underline">Sign up</Link>
          </p>
        </div>
      </div>

      {/* Right panel — same terminal style */}
      <div className="hidden lg:flex w-[40%] bg-bg-surface border-l border-border-subtle items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <span className="ml-2 text-caption text-text-muted font-mono">readiness.log</span>
            </div>
            <div className="p-4 font-mono text-code text-text-secondary space-y-1">
              <p className="text-accent">{'>'} Weekly Progress Update</p>
              <p>&nbsp;</p>
              <p className="text-text-primary">📈 Readiness Index</p>
              <p>────────────────────────────</p>
              <p>Overall:             <span className="text-accent">72</span> (+5)</p>
              <p>DSA:                  <span className="text-success">81</span> ↑</p>
              <p>System Design:  <span className="text-warning">58</span> →</p>
              <p>Backend:            <span className="text-accent">75</span> ↑</p>
              <p>&nbsp;</p>
              <p>Sessions this week: <span className="text-text-primary">6/7</span></p>
              <p>Streak: <span className="text-warning">12 days</span> 🔥</p>
              <p>&nbsp;</p>
              <p className="text-text-muted">Top 15% in DSA among peers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
