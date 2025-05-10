
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export type InteractionStyle = 'concise' | 'detailed' | 'friendly' | 'formal';
export type Theme = 'light' | 'dark' | 'system';

interface UserSettings {
  isBetaModeEnabled: boolean;
  interactionStyle: InteractionStyle;
  // Theme is handled by ThemeContext but could be stored here too if needed for other non-UI settings
}

interface SettingsContextType extends UserSettings {
  setIsBetaModeEnabled: (enabled: boolean) => void;
  setInteractionStyle: (style: InteractionStyle) => void;
  // setThemePreference: (theme: Theme) => void; // Example if we were to manage theme here
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const GUEST_SETTINGS_STORAGE_KEY = 'taskzenith-guest-settings';

const defaultSettings: UserSettings = {
  isBetaModeEnabled: false,
  interactionStyle: 'friendly' as InteractionStyle,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser, isGuest, loading: authLoading } = useAuth();
  const [settings, setSettingsState] = useState<UserSettings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      if (authLoading) return;

      if (currentUser && !isGuest) { // Logged-in user
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.settings) {
              setSettingsState({
                isBetaModeEnabled: userData.settings.isBetaModeEnabled ?? defaultSettings.isBetaModeEnabled,
                interactionStyle: userData.settings.interactionStyle ?? defaultSettings.interactionStyle,
              });
            } else {
              // Settings field doesn't exist, initialize it
              setSettingsState(defaultSettings);
              await updateDoc(userDocRef, { settings: defaultSettings });
            }
          } else {
             // User doc itself doesn't exist, AuthContext should handle creation.
             // For safety, use defaults here.
            setSettingsState(defaultSettings);
          }
        } catch (error) {
          console.error("Error loading settings from Firestore:", error);
          setSettingsState(defaultSettings);
        }
      } else if (isGuest) { // Guest user
        const savedSettings = localStorage.getItem(GUEST_SETTINGS_STORAGE_KEY);
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings) as UserSettings;
            setSettingsState({
              isBetaModeEnabled: parsed.isBetaModeEnabled ?? defaultSettings.isBetaModeEnabled,
              interactionStyle: parsed.interactionStyle ?? defaultSettings.interactionStyle,
            });
          } catch (e) {
            console.error("Failed to parse guest settings from localStorage", e);
            setSettingsState(defaultSettings);
          }
        } else {
          setSettingsState(defaultSettings);
        }
      } else { // No user, not guest
        setSettingsState(defaultSettings);
      }
      setIsLoadingSettings(false);
    };
    loadSettings();
  }, [currentUser, isGuest, authLoading]);

  // Save settings
  useEffect(() => {
    if (isLoadingSettings || authLoading) return;

    const saveSettings = async () => {
      if (currentUser && !isGuest) { // Logged-in user
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          await updateDoc(userDocRef, { settings: settings });
        } catch (error) {
          console.error("Error saving settings to Firestore:", error);
          // Optionally notify user of save failure
        }
      } else if (isGuest) { // Guest user
        localStorage.setItem(GUEST_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      }
    };
    saveSettings();
  }, [settings, currentUser, isGuest, isLoadingSettings, authLoading]);


  const setIsBetaModeEnabled = useCallback((enabled: boolean) => {
    setSettingsState(s => ({ ...s, isBetaModeEnabled: enabled }));
  }, []);

  const setInteractionStyle = useCallback((style: InteractionStyle) => {
    setSettingsState(s => ({ ...s, interactionStyle: style }));
  }, []);


  const contextValue = {
    ...settings,
    setIsBetaModeEnabled,
    setInteractionStyle,
  };
  
  // Potentially show a global loading state if settings are critical before rendering children
  // if (isLoadingSettings || authLoading) {
  //   return <div>Loading settings...</div>; 
  // }

  return (
    <SettingsContext.Provider value={contextValue}>
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
