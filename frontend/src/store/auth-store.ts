import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  channelListCode?: string;
  emailVerified?: boolean;
  profilePicture?: string;
}

interface AuthState {
  user: User | null;
  sessionId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setSession: (user: User, sessionId: string) => void;
  setTokens: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user }),

      setSession: (user, sessionId) => {
        set({ user, sessionId, isAuthenticated: true });
      },

      setTokens: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      logout: () => {
        set({
          user: null,
          sessionId: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'firevision-auth',
      partialize: (state) => ({
        user: state.user,
        sessionId: state.sessionId,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
