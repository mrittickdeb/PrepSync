import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Too weak', color: 'var(--color-danger)' };
  if (score === 2) return { level: 2, label: 'Weak', color: 'var(--color-danger)' };
  if (score === 3) return { level: 3, label: 'Fair', color: 'var(--color-warning)' };
  if (score === 4) return { level: 4, label: 'Strong', color: 'var(--color-success)' };
  return { level: 5, label: 'Very strong', color: 'var(--color-accent)' };
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const registerAction = useAuthStore((s) => s.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const strength = getPasswordStrength(password);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!email.trim()) errs.email = 'Email is required';
    if (!PASSWORD_REGEX.test(password)) {
      errs.password = 'Must be 8+ chars with uppercase, number, and special character';
    }
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords don\'t match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      const userId = await registerAction(name, email, password);
      navigate('/verify-email', { state: { userId, email, redirect } });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setServerError(error.response?.data?.error || 'Registration failed. Please try again.');
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

          <h1 className="text-display text-text-primary font-sans mb-2">Create your account</h1>
          <p className="text-body text-text-secondary mb-8">Start your interview preparation journey.</p>

          {serverError && (
            <div className="mb-6 px-4 py-3 rounded-md bg-danger-dim border border-danger/20 text-body text-danger">
              {serverError}
            </div>
          )}

          {/* Google OAuth Button */}
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
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              error={errors.name}
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={errors.email}
              autoComplete="email"
            />
            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                error={errors.password}
                autoComplete="new-password"
              />
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors duration-300"
                        style={{
                          backgroundColor: i <= strength.level ? strength.color : 'var(--color-border-subtle)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-caption font-sans" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
            <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
              Create account
            </Button>
          </form>

          <p className="text-body text-text-secondary mt-6 text-center">
            Already have an account?{' '}
            <Link to={`/login${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}`} className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right — Terminal Animation */}
      <div className="hidden lg:flex w-[40%] bg-bg-surface border-l border-border-subtle items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <span className="ml-2 text-caption text-text-muted font-mono">evaluation.log</span>
            </div>
            <div className="p-4 font-mono text-code text-text-secondary space-y-1 terminal-animation">
              <p className="text-accent">{'>'} Session completed — DSA (Medium)</p>
              <p>&nbsp;</p>
              <p className="text-text-primary">📊 Evaluation Report</p>
              <p>────────────────────────────</p>
              <p>Overall Score: <span className="text-accent">78</span>/100</p>
              <p>&nbsp;</p>
              <p>Correctness        <span className="text-success">████████░░</span> 82</p>
              <p>Approach            <span className="text-warning">██████░░░░</span> 65</p>
              <p>Communication  <span className="text-accent">█████████░</span> 90</p>
              <p>Edge Cases        <span className="text-warning">█████░░░░░</span> 55</p>
              <p>&nbsp;</p>
              <p className="text-text-muted">💡 Practice: merge intervals, sliding window</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
