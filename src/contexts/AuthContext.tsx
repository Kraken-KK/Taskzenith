// src/contexts/AuthContext.tsx
'use client';

import type { User as FirebaseUser, AuthError as FirebaseAuthError } from 'firebase/auth';
import type { User as SupabaseUser, AuthError as SupabaseAuthError, Session as SupabaseSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { auth as firebaseAuth } from '@/lib/firebase';
import { supabase } from '@/lib/supabaseClient';
import { 
  onAuthStateChanged as onFirebaseAuthStateChanged, 
  createUserWithEmailAndPassword as createUserWithFirebase, 
  signInWithEmailAndPassword as signInWithFirebase, 
  signOut as signOutFirebase,
  updateProfile as updateFirebaseProfile
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export type AuthProviderType = 'firebase' | 'supabase';

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  provider: AuthProviderType;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  currentProvider: AuthProviderType | null;
  isGuest: boolean;
  signupWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  loginWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  signupWithSupabase: (email: string, password: string) => Promise<AppUser | null>;
  loginWithSupabase: (email: string, password: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_MODE_STORAGE_KEY = 'taskzenith-guest-mode';
const AUTH_PROVIDER_STORAGE_KEY = 'taskzenith-auth-provider';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentProvider, setCurrentProvider] = useState<AuthProviderType | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser): AppUser => ({
    id: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    provider: 'firebase',
  });

  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): AppUser => ({
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName: supabaseUser.user_metadata?.displayName || supabaseUser.email?.split('@')[0] || 'User',
    photoURL: supabaseUser.user_metadata?.avatar_url,
    provider: 'supabase',
  });

  useEffect(() => {
    setLoading(true);
    const storedGuestMode = localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
    setIsGuest(storedGuestMode);

    if (storedGuestMode) {
      setCurrentUser(null);
      setCurrentProvider(null);
      setLoading(false);
      return; // Don't initialize Firebase/Supabase listeners if in guest mode initially
    }

    // Firebase Auth State Listener
    const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser && !isGuest) { // Check !isGuest again in case it changed
        const appUser = mapFirebaseUserToAppUser(firebaseUser);
        setCurrentUser(appUser);
        setCurrentProvider('firebase');
        localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'firebase');
      } else if (localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'firebase') { 
        setCurrentUser(null);
        setCurrentProvider(null);
        localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
      }
      setLoading(false);
    });

    // Supabase Auth State Listener
    const { data: { subscription: supabaseAuthSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true); // Set loading true at start of change
      if (!isGuest) { // Check !isGuest again
        const supabaseUser = session?.user;
        if (supabaseUser) {
          const appUser = mapSupabaseUserToAppUser(supabaseUser);
          setCurrentUser(appUser);
          setCurrentProvider('supabase');
          localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'supabase');
        } else if (localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'supabase') {
          setCurrentUser(null);
          setCurrentProvider(null);
          localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
        }
      }
      setLoading(false);
    });
    
    const persistedProvider = localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) as AuthProviderType | null;
    if (!persistedProvider && !storedGuestMode) { // if no provider and not guest
        setLoading(false); 
    }


    return () => {
      unsubscribeFirebase();
      supabaseAuthSubscription?.unsubscribe();
    };
  }, [isGuest]); // Rerun if isGuest changes

  const commonLoginSuccess = (appUser: AppUser, provider: AuthProviderType) => {
    setCurrentUser(appUser);
    setCurrentProvider(provider);
    setIsGuest(false);
    localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
    localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
  };

  const commonSignupSuccess = (appUser: AppUser, provider: AuthProviderType) => {
    setCurrentUser(appUser); // May be overridden by onAuthStateChange for Supabase confirmation
    setCurrentProvider(provider);
    setIsGuest(false);
    localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
    localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
  };


  const signupWithFirebase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithFirebase(firebaseAuth, email, password);
      const displayName = email.split('@')[0];
      await updateFirebaseProfile(userCredential.user, { displayName });
      
      const appUser = mapFirebaseUserToAppUser(userCredential.user);
      appUser.displayName = displayName; 
      
      toast({ title: 'Firebase Signup Successful', description: 'Welcome aboard!' });
      commonSignupSuccess(appUser, 'firebase');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      toast({ title: 'Firebase Signup Failed', description: authError.message, variant: 'destructive' });
      console.error('Firebase Signup error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithFirebase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    try {
      const userCredential = await signInWithFirebase(firebaseAuth, email, password);
      const appUser = mapFirebaseUserToAppUser(userCredential.user);
      toast({ title: 'Firebase Login Successful', description: 'Welcome back!' });
      commonLoginSuccess(appUser, 'firebase');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      toast({ title: 'Firebase Login Failed', description: authError.message, variant: 'destructive' });
      console.error('Firebase Login error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signupWithSupabase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            displayName: email.split('@')[0] 
          }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase signup did not return a user.');

      const appUser = mapSupabaseUserToAppUser(data.user);
      toast({ title: 'Supabase Signup Successful', description: 'Please check your email to confirm registration!' });
      commonSignupSuccess(appUser, 'supabase'); // optimistic update
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Signup Failed', description: authError.message, variant: 'destructive' });
      console.error('Supabase Signup error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithSupabase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase login did not return a user.');
      
      const appUser = mapSupabaseUserToAppUser(data.user);
      toast({ title: 'Supabase Login Successful', description: 'Welcome back!' });
      commonLoginSuccess(appUser, 'supabase');
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Login Failed', description: authError.message, variant: 'destructive' });
      console.error('Supabase Login error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    const providerToLogout = currentProvider; 
    try {
      if (providerToLogout === 'firebase') {
        await signOutFirebase(firebaseAuth);
      } else if (providerToLogout === 'supabase') {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      const authError = error as FirebaseAuthError | SupabaseAuthError;
      toast({ title: 'Logout Failed', description: authError.message, variant: 'destructive' });
      console.error('Logout error:', authError);
    } finally {
      setCurrentUser(null);
      setCurrentProvider(null);
      setIsGuest(false);
      localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
      localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
      setLoading(false);
      router.push('/login');
    }
  };

  const enterGuestMode = useCallback(() => {
    setCurrentUser(null);
    setCurrentProvider(null);
    setIsGuest(true);
    localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY); // Clear any lingering auth provider
    router.push('/');
  }, [router]);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    // Optionally clear guest data here if TaskContext doesn't handle it.
    // For now, TaskContext will switch keys.
    router.push('/login');
  }, [router]);

  const value = {
    currentUser,
    loading,
    currentProvider,
    isGuest,
    signupWithFirebase,
    loginWithFirebase,
    signupWithSupabase,
    loginWithSupabase,
    logout,
    enterGuestMode,
    exitGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
