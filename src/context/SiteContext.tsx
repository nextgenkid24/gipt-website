import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Category, SiteSettings, User } from '../types';

interface SiteContextValue {
  settings: SiteSettings | null;
  categories: Category[];
  user: User | null;
  authLoading: boolean;
  refreshSettings: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export function updateDocumentMeta(title: string, description?: string) {
  if (title) {
    document.title = title;
  }
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await apiFetch<SiteSettings>('/api/settings');
      setSettings(data);
    } catch {
      // Keep previous settings on transient error
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await apiFetch<Category[]>('/api/categories');
      setCategories(data);
    } catch {
      // Ignore
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
    void refreshCategories();
    void refreshAuth();
  }, [refreshSettings, refreshCategories, refreshAuth]);

  return (
    <SiteContext.Provider
      value={{
        settings,
        categories,
        user,
        authLoading,
        refreshSettings,
        refreshCategories,
        refreshAuth,
        setUser,
        logout,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside SiteProvider');
  return ctx;
}
