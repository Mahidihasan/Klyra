import React, { createContext, useContext, useState } from 'react';

interface AdminUIContextType {
  isDrawerOpen: boolean;
  openDrawer: (content: React.ReactNode, title: string) => void;
  closeDrawer: () => void;
  drawerContent: React.ReactNode | null;
  drawerTitle: string;
}

const AdminUIContext = createContext<AdminUIContextType | undefined>(undefined);

export const AdminUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<React.ReactNode | null>(null);
  const [drawerTitle, setDrawerTitle] = useState('');

  const openDrawer = (content: React.ReactNode, title: string) => {
    setDrawerContent(content);
    setDrawerTitle(title);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    // Don't immediately clear content to allow exit animation to play smoothly
    setTimeout(() => {
      setDrawerContent(null);
      setDrawerTitle('');
    }, 300);
  };

  return (
    <AdminUIContext.Provider value={{ isDrawerOpen, openDrawer, closeDrawer, drawerContent, drawerTitle }}>
      {children}
    </AdminUIContext.Provider>
  );
};

export const useAdminUI = () => {
  const context = useContext(AdminUIContext);
  if (!context) {
    throw new Error('useAdminUI must be used within an AdminUIProvider');
  }
  return context;
};
