
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type InteractionStyle = 'concise' | 'detailed' | 'friendly' | 'formal';

interface SettingsContextType {
  isBetaModeEnabled: boolean;
  setIsBetaModeEnabled: (enabled: boolean) => void;
  interactionStyle: InteractionStyle;
  setInteractionStyle: (style: InteractionStyle) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'taskzenith-settings';

const defaultSettings = {
  isBetaModeEnabled: false,
  interactionStyle: 'friendly' as InteractionStyle,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isBetaModeEnabled, setIsBetaModeEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          return !!parsedSettings.isBetaModeEnabled;
        } catch (e) {
          console.error("Failed to parse isBetaModeEnabled from localStorage", e);
          return defaultSettings.isBetaModeEnabled;
        }
      }
    }
    return defaultSettings.isBetaModeEnabled; // Default if not found or SSR
  });

  const [interactionStyle, setInteractionStyleState] = useState<InteractionStyle>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          return parsedSettings.interactionStyle || defaultSettings.interactionStyle;
        } catch (e) {
          console.error("Failed to parse interactionStyle from localStorage", e);
          return defaultSettings.interactionStyle;
        }
      }
    }
    return defaultSettings.interactionStyle; // Default if not found or SSR
  });


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentSettings = { isBetaModeEnabled, interactionStyle };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
    }
  }, [isBetaModeEnabled, interactionStyle]);

  const setIsBetaModeEnabled = (enabled: boolean) => {
    setIsBetaModeEnabledState(enabled);
  };

  const setInteractionStyle = (style: InteractionStyle) => {
    setInteractionStyleState(style);
  };

  return (
    <SettingsContext.Provider value={{ isBetaModeEnabled, setIsBetaModeEnabled, interactionStyle, setInteractionStyle }}>
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
