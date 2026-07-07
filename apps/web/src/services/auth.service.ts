import api, { setAccessToken } from './api';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface VerifyEmailPayload {
  userId: string;
  otp: string;
}

interface ResetPasswordPayload {
  token: string;
  userId: string;
  newPassword: string;
}

interface OnboardingPayload {
  goal: string;
  targetDomains: string[];
  weeklyGoal: number;
}

interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

export async function registerUser(payload: RegisterPayload): Promise<{ userId: string }> {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthResponse> {
  const { data } = await api.post('/auth/verify-email', payload);
  if (data.accessToken) {
    setAccessToken(data.accessToken);
  }
  return data;
}

export async function resendVerification(userId: string): Promise<void> {
  await api.post('/auth/resend-verification', { userId });
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post('/auth/login', payload);
  if (data.accessToken) {
    setAccessToken(data.accessToken);
  }
  return data;
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const { data } = await api.post('/auth/refresh');
  if (data.accessToken) {
    setAccessToken(data.accessToken);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout');
  setAccessToken(null);
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await api.post('/auth/reset-password', payload);
}

export async function sendMagicLink(email: string): Promise<void> {
  await api.post('/auth/magic-link', { email });
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<AuthResponse> {
  const { data } = await api.post('/auth/onboarding', payload);
  return data;
}

export async function getMe(): Promise<Record<string, unknown>> {
  const { data } = await api.get('/users/me');
  return data;
}

export async function getUserActivity(): Promise<Record<string, number>> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data } = await api.get(`/users/me/activity?timezone=${encodeURIComponent(timezone)}`);
  return data;
}
