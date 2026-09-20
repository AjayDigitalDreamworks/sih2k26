import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../api/auth';
import { fieldOfficerApi } from '../api/fieldOfficer';
import { storage } from '../api/client';
import { initSocket, disconnectSocket } from '../api/socket';

interface AuthContextType {
  user: AuthUser | null;
  officerData: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshOfficerData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [officerData, setOfficerData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await storage.getItem('ner_access_token') || await storage.getItem('accessToken');
        if (token) {
          const profile = await fieldOfficerApi.getMe();
          setOfficerData(profile);
          setUser(profile.user as any);
        }
        initSocket().catch(() => {});
      } catch (err) {
        await storage.removeItem('ner_access_token');
        await storage.removeItem('ner_refresh_token');
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const authResult = await authApi.login(identifier, password);
      setUser(authResult.user);
      const profile = await fieldOfficerApi.getMe();
      setOfficerData(profile);
      await initSocket();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
      disconnectSocket();
      setUser(null);
      setOfficerData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOfficerData = async () => {
    try {
      const profile = await fieldOfficerApi.getMe();
      setOfficerData(profile);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        officerData,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshOfficerData,
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
