import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface PermissionsContextType {
  hasPermission: (key: string) => boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  const hasPermission = (key: string) => {
    if (user?.role === 'SUPER_ADMIN') return true; // God mode
    if (user?.role === 'ADMIN') return user?.permissions?.includes(key) || user?.permissions?.includes('*') || false;
    return false; // Zero-trust default
  };

  return (
    <PermissionsContext.Provider value={{ hasPermission, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
