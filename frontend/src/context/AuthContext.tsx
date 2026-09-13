import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, profileApi, UpdatePreferencesInput, UpdateProfileInput, UserProfile, AuthTokens, LoginResponse } from '../services/api/auth';

export function applyTheme(theme: UserProfile['preferences']['theme']) {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  updatePersonalInfo: (profile: UpdateProfileInput) => Promise<{ user: UserProfile; message: string }>;
  uploadProfileAvatar: (file: File) => Promise<{ user: UserProfile; message: string }>;
  removeProfileAvatar: () => Promise<{ user: UserProfile; message: string }>;
  changeProfilePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateProfilePreferences: (preferences: UpdatePreferencesInput) => Promise<{ user: UserProfile; message: string }>;
  deactivateAccount: (currentPassword: string) => Promise<{ success: boolean; message: string }>;
  openDemoInboxTab: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('klyra_access_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const cacheProfile = useCallback((profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('klyra_user', JSON.stringify(profile));
  }, []);

  useEffect(() => {
    if (!user?.preferences) return;
    applyTheme(user.preferences.theme);
    if (user.preferences.theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [user?.preferences?.theme]);

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
        cacheProfile(profile);
      } catch (err: any) {
        // Access token might be expired, attempt refresh
        if (storedRefresh) {
          try {
            const newTokens = await authApi.refreshToken(storedRefresh);
            localStorage.setItem('klyra_access_token', newTokens.accessToken);
            setAccessToken(newTokens.accessToken);
            const { user: profile } = await authApi.me();
            cacheProfile(profile);
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
  }, [cacheProfile, clearSession]);

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

  const refreshProfile = useCallback(async (): Promise<void> => {
    try {
      const { user: profile } = await authApi.me();
      cacheProfile(profile);
    } catch {
      // Keep existing profile
    }
  }, [cacheProfile]);

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    const { user: profile } = await profileApi.getProfile();
    cacheProfile(profile);
    return profile;
  }, [cacheProfile]);

  const updatePersonalInfo = useCallback(async (profile: UpdateProfileInput) => {
    const result = await profileApi.updatePersonalInfo(profile);
    cacheProfile(result.user);
    return result;
  }, [cacheProfile]);

  const uploadProfileAvatar = useCallback(async (file: File) => {
    const result = await profileApi.uploadAvatar(file);
    cacheProfile(result.user);
    return result;
  }, [cacheProfile]);

  const removeProfileAvatar = useCallback(async () => {
    const result = await profileApi.removeAvatar();
    cacheProfile(result.user);
    return result;
  }, [cacheProfile]);

  const changeProfilePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await profileApi.changePassword(currentPassword, newPassword);
    await refreshProfile();
    return result;
  }, [refreshProfile]);

  const updateProfilePreferences = useCallback(async (preferences: UpdatePreferencesInput) => {
    const result = await profileApi.updatePreferences(preferences);
    cacheProfile(result.user);
    return result;
  }, [cacheProfile]);

  const deactivateAccount = useCallback(async (currentPassword: string) => {
    const result = await profileApi.deactivateAccount(currentPassword);
    // Do not clear state unless the server completed the account transaction.
    clearSession();
    return result;
  }, [clearSession]);

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
        loadProfile,
        refreshProfile,
        updatePersonalInfo,
        uploadProfileAvatar,
        removeProfileAvatar,
        changeProfilePassword,
        updateProfilePreferences,
        deactivateAccount,
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
