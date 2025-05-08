
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
  isBetaModeEnabled: boolean;
  setIsBetaModeEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'taskzenith-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isBetaModeEnabled, setIsBetaModeEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          return !!parsedSettings.isBetaModeEnabled;
        } catch (e) {
          console.error("Failed to parse settings from localStorage", e);
          return false;
        }
      }
    }
    return false; // Default to false if not found or SSR
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentSettings = { isBetaModeEnabled };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
    }
  }, [isBetaModeEnabled]);

  const setIsBetaModeEnabled = (enabled: boolean) => {
    setIsBetaModeEnabledState(enabled);
  };

  return (
    <SettingsContext.Provider value={{ isBetaModeEnabled, setIsBetaModeEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
