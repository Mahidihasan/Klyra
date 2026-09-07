import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, UserProfile, AuthTokens, LoginResponse } from '../services/api/auth';

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  openDemoInboxTab: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('klyra_access_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to open Demo Inbox in a new browser tab
  const openDemoInboxTab = useCallback(() => {
    try {
      window.open('/demo-inbox', '_blank');
    } catch {
      // Popup blocked fallback
    }
  }, []);

  // Save or clear auth session
  const saveSession = useCallback((tokens: AuthTokens, userProfile: UserProfile) => {
    localStorage.setItem('klyra_access_token', tokens.accessToken);
    localStorage.setItem('klyra_refresh_token', tokens.refreshToken);
    localStorage.setItem('klyra_user', JSON.stringify(userProfile));
    setAccessToken(tokens.accessToken);
    setUser(userProfile);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('klyra_access_token');
    localStorage.removeItem('klyra_refresh_token');
    localStorage.removeItem('klyra_user');
    setAccessToken(null);
    setUser(null);
  }, []);

  // Restore session on app load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('klyra_access_token');
      const storedRefresh = localStorage.getItem('klyra_refresh_token');
      const cachedUser = localStorage.getItem('klyra_user');

      if (!storedToken && !storedRefresh) {
        setIsLoading(false);
        return;
      }

      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch { /* ignore */ }
      }

      try {
        // Try fetching current user profile
        const { user: profile } = await authApi.me();
        setUser(profile);
        localStorage.setItem('klyra_user', JSON.stringify(profile));
      } catch (err: any) {
        // Access token might be expired, attempt refresh
        if (storedRefresh) {
          try {
            const newTokens = await authApi.refreshToken(storedRefresh);
            localStorage.setItem('klyra_access_token', newTokens.accessToken);
            setAccessToken(newTokens.accessToken);
            const { user: profile } = await authApi.me();
            setUser(profile);
            localStorage.setItem('klyra_user', JSON.stringify(profile));
          } catch {
            clearSession();
          }
        } else {
          clearSession();
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [clearSession]);

  const login = async (email: string, password: string, rememberMe = false): Promise<LoginResponse> => {
    const res = await authApi.login(email, password, rememberMe);
    if (!res.requires2FA && res.tokens && res.user) {
      saveSession(res.tokens, res.user);
    }
    return res;
  };

  const verify2FA = async (tempToken: string, code: string): Promise<void> => {
    const res = await authApi.verify2FA(tempToken, code);
    saveSession(res.tokens, res.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      clearSession();
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const { user: profile } = await authApi.me();
      setUser(profile);
      localStorage.setItem('klyra_user', JSON.stringify(profile));
    } catch {
      // Keep existing profile
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        verify2FA,
        logout,
        refreshProfile,
        openDemoInboxTab,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
