import { create } from 'zustand';
import { setAccessToken } from '../services/api';
import * as authService from '../services/auth.service';

let refreshPromise: Promise<void> | null = null;

interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  goal?: string;
  targetDomains: string[];
  weeklyGoal: number;
  streak: number;
  readinessIndex: {
    overall: number;
    dsa: number;
    systemDesign: number;
    backend: number;
    conceptual: number;
    behavioural: number;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingUserId: string | null;

  setUser: (user: User | null) => void;
  setPendingUserId: (id: string | null) => void;

  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  verifyEmail: (userId: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  fetchUser: () => Promise<void>;
  completeOnboarding: (goal: string, targetDomains: string[], weeklyGoal: number) => Promise<void>;
}

const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: hasToken,
  pendingUserId: null,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  setPendingUserId: (id) =>
    set({ pendingUserId: id }),

  register: async (name, email, password) => {
    const result = await authService.registerUser({ name, email, password });
    set({ pendingUserId: result.userId });
    return result.userId;
  },

  verifyEmail: async (userId, otp) => {
    const result = await authService.verifyEmail({ userId, otp });
    set({
      user: result.user as unknown as User,
      isAuthenticated: true,
      isLoading: false,
      pendingUserId: null,
    });
  },

  login: async (email, password, rememberMe) => {
    const result = await authService.loginUser({ email, password, rememberMe });
    set({
      user: result.user as unknown as User,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await authService.logoutUser();
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  refreshAuth: async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        set({ isLoading: true });
        
        // 1. Try to fetch user profile directly using current access token
        try {
          const user = await authService.getMe();
          set({
            user: user as unknown as User,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch {
          // Token might be expired or missing, proceed to manual refresh
        }

        // 2. Refresh token manually using cookie
        await authService.refreshToken();
        const user = await authService.getMe();
        set({
          user: user as unknown as User,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const user = await authService.getMe();
      set({
        user: user as unknown as User,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw new Error('Failed to fetch user profile');
    }
  },

  completeOnboarding: async (goal, targetDomains, weeklyGoal) => {
    const result = await authService.completeOnboarding({ goal, targetDomains, weeklyGoal });
    const currentUser = get().user;
    if (currentUser) {
      set({
        user: { ...currentUser, ...(result.user as unknown as User) },
      });
    }
  },
}));
