// src/contexts/AuthContext.tsx
'use client';

import type { User as FirebaseUser, AuthError as FirebaseAuthError } from 'firebase/auth';
import type { User as SupabaseUser, AuthError as SupabaseAuthError, Session as SupabaseSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  // You can add more common fields or provider-specific fields if needed
  // e.g., firebaseUser?: FirebaseUser; supabaseUser?: SupabaseUser;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  currentProvider: AuthProviderType | null;
  signupWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  loginWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  signupWithSupabase: (email: string, password: string) => Promise<AppUser | null>;
  loginWithSupabase: (email: string, password: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentProvider, setCurrentProvider] = useState<AuthProviderType | null>(null);
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
    // Firebase Auth State Listener
    const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        const appUser = mapFirebaseUserToAppUser(firebaseUser);
        setCurrentUser(appUser);
        setCurrentProvider('firebase');
        localStorage.setItem('taskzenith-auth-provider', 'firebase');
      } else if (currentProvider === 'firebase') { // Only clear if it was firebase auth
        setCurrentUser(null);
        setCurrentProvider(null);
        localStorage.removeItem('taskzenith-auth-provider');
      }
      setLoading(false); // Firebase is done, Supabase might still be checking
    });

    // Supabase Auth State Listener
    const { data: { subscription: supabaseAuthSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      const supabaseUser = session?.user;
      if (supabaseUser) {
        const appUser = mapSupabaseUserToAppUser(supabaseUser);
        setCurrentUser(appUser);
        setCurrentProvider('supabase');
        localStorage.setItem('taskzenith-auth-provider', 'supabase');
      } else if (currentProvider === 'supabase') { // Only clear if it was supabase auth
        setCurrentUser(null);
        setCurrentProvider(null);
        localStorage.removeItem('taskzenith-auth-provider');
      }
      setLoading(false);
    });
    
    // Initial check for persisted provider preference
    const persistedProvider = localStorage.getItem('taskzenith-auth-provider') as AuthProviderType | null;
    if (persistedProvider) {
        // If a provider was persisted, let its onAuthStateChanged handle user loading.
        // This avoids a race condition or double-setting if both Firebase and Supabase have active sessions.
        // For now, we assume only one can be active in the app's context at a time.
    } else {
        setLoading(false); // No persisted provider, so initial loading done.
    }


    return () => {
      unsubscribeFirebase();
      supabaseAuthSubscription?.unsubscribe();
    };
  }, [currentProvider]); // Rerun if currentProvider changes externally (e.g. logout)

  const signupWithFirebase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithFirebase(firebaseAuth, email, password);
      const displayName = email.split('@')[0];
      await updateFirebaseProfile(userCredential.user, { displayName });
      
      const appUser = mapFirebaseUserToAppUser(userCredential.user);
      appUser.displayName = displayName; // Ensure displayName is set on our appUser
      
      toast({ title: 'Firebase Signup Successful', description: 'Welcome aboard!' });
      setCurrentUser(appUser);
      setCurrentProvider('firebase');
      localStorage.setItem('taskzenith-auth-provider', 'firebase');
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
      setCurrentUser(appUser);
      setCurrentProvider('firebase');
      localStorage.setItem('taskzenith-auth-provider', 'firebase');
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
            displayName: email.split('@')[0] // Store display name in user_metadata
          }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase signup did not return a user.');

      const appUser = mapSupabaseUserToAppUser(data.user);
      toast({ title: 'Supabase Signup Successful', description: 'Please check your email to confirm registration!' });
      // setCurrentUser(appUser); // User will be set by onAuthStateChange after email confirmation usually
      // setCurrentProvider('supabase');
      // localStorage.setItem('taskzenith-auth-provider', 'supabase');
      // For Supabase, often email confirmation is needed. The onAuthStateChange will handle setting the user.
      // We return the user data for immediate feedback if needed, but actual session might pend confirmation.
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
      setCurrentUser(appUser); // Set by onAuthStateChange, but can set here for quicker UI update
      setCurrentProvider('supabase');
      localStorage.setItem('taskzenith-auth-provider', 'supabase');
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
    const provider = currentProvider; // Use the state at the time of logout call
    try {
      if (provider === 'firebase') {
        await signOutFirebase(firebaseAuth);
      } else if (provider === 'supabase') {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      setCurrentUser(null);
      setCurrentProvider(null);
      localStorage.removeItem('taskzenith-auth-provider');
      router.push('/login');
    } catch (error) {
      const authError = error as FirebaseAuthError | SupabaseAuthError;
      toast({ title: 'Logout Failed', description: authError.message, variant: 'destructive' });
      console.error('Logout error:', authError);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    loading,
    currentProvider,
    signupWithFirebase,
    loginWithFirebase,
    signupWithSupabase,
    loginWithSupabase,
    logout,
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
