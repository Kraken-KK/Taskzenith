// src/contexts/AuthContext.tsx
'use client';

import type { User as FirebaseUser, AuthError as FirebaseAuthError } from 'firebase/auth';
import type { User as SupabaseUser, AuthError as SupabaseAuthError, Session as SupabaseSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { auth as firebaseAuth, db } from '@/lib/firebase'; // Import db
import { supabase } from '@/lib/supabaseClient';
import { 
  onAuthStateChanged as onFirebaseAuthStateChanged, 
  createUserWithEmailAndPassword as createUserWithFirebase, 
  signInWithEmailAndPassword as signInWithFirebase, 
  signOut as signOutFirebase,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firestore imports
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Board, Task, Column } from '@/types'; // Ensure types are available
import { formatISO } from 'date-fns';
import type { InteractionStyle } from './SettingsContext';
import type { MessageHistoryItem } from '@/ai/flows/chat-flow';


// Default data structures for new users in Firestore
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const getDefaultColumnsForNewUser = (): Column[] => [
  {
    id: generateId('col'),
    title: 'To Do',
    tasks: [
      { id: generateId('task'), content: 'Welcome! Plan your day', status: '', priority: 'high', createdAt: formatISO(new Date()), dependencies:[], checklist:[], tags:[] },
    ],
  },
  { id: generateId('col'), title: 'In Progress', tasks: [] },
  { id: generateId('col'), title: 'Done', tasks: [] },
];

const assignTaskStatusToDefaultColumns = (columns: Column[]): Column[] => {
  return columns.map(col => ({
    ...col,
    tasks: col.tasks.map(task => ({
      ...task,
      status: col.id,
    }))
  }));
};

const getDefaultBoardForNewUser = (): Board => ({
  id: generateId('board-user'),
  name: 'My First Board',
  columns: assignTaskStatusToDefaultColumns(getDefaultColumnsForNewUser()),
  createdAt: formatISO(new Date()),
  theme: {},
});

const defaultUserSettings = {
  theme: 'system' as 'light' | 'dark' | 'system',
  isBetaModeEnabled: false,
  interactionStyle: 'friendly' as InteractionStyle,
};

const defaultAiChatHistory = {
  messages: [] as MessageHistoryItem[],
};


export type AuthProviderType = 'firebase' | 'supabase';

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  provider: AuthProviderType | 'google';
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  currentProvider: AuthProviderType | 'google' | null;
  isGuest: boolean;
  signupWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  loginWithFirebase: (email: string, password: string) => Promise<AppUser | null>;
  signInWithGoogleFirebase: () => Promise<AppUser | null>;
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
  const [currentProvider, setCurrentProvider] = useState<AuthProviderType | 'google' | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser, providerOverride?: 'google'): AppUser => ({
    id: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    provider: providerOverride || 'firebase',
  });

  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): AppUser => ({
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName: supabaseUser.user_metadata?.displayName || supabaseUser.email?.split('@')[0] || 'User',
    photoURL: supabaseUser.user_metadata?.avatar_url,
    provider: 'supabase',
  });

  /**
   * Initializes or updates user data in Firestore.
   * This function is crucial for ensuring user data persistence.
   * 
   * IF DATA IS NOT SAVING TO FIRESTORE or COLLECTIONS ARE NOT BEING CREATED:
   * 1. CHECK YOUR FIRESTORE SECURITY RULES: This is the MOST COMMON cause.
   *    Ensure that authenticated users have write permission to the `users/{userId}` path.
   *    A basic rule for development might be:
   *    ```
   *    rules_version = '2';
   *    service cloud.firestore {
   *      match /databases/{database}/documents {
   *        match /users/{userId} {
   *          allow read, write: if request.auth != null && request.auth.uid == userId;
   *        }
   *      }
   *    }
   *    ```
   * 2. VERIFY FIREBASE CONFIGURATION: Ensure your `.env.local` file has the correct
   *    Firebase project details (apiKey, projectId, etc.).
   * 3. CHECK CONSOLE LOGS: Look for any Firestore-related errors in the browser console.
   *    The detailed logs added below should help pinpoint where the process might be failing.
   */
  const initializeFirestoreUserData = async (appUser: AppUser) => {
    if (!appUser || !appUser.id) {
      console.error("Firestore Init: `appUser` or `appUser.id` is undefined. Cannot initialize user data.", appUser);
      toast({ title: 'Critical Error', description: 'User identification failed. Cannot save data.', variant: 'destructive' });
      return;
    }

    const userDocRef = doc(db, 'users', appUser.id);
    console.log(`Firestore Init: Starting for user ID: ${appUser.id} (Email: ${appUser.email}, Provider: ${appUser.provider})`);

    try {
      const userDocSnap = await getDoc(userDocRef);
      const defaultBoard = getDefaultBoardForNewUser();

      if (!userDocSnap.exists()) {
        console.log(`Firestore Init: User document for ${appUser.id} does NOT exist. Attempting to CREATE new document.`);
        const newUserDocumentData = {
          email: appUser.email,
          displayName: appUser.displayName,
          photoURL: appUser.photoURL || null,
          provider: appUser.provider,
          createdAt: serverTimestamp() as Timestamp,
          lastLogin: serverTimestamp() as Timestamp,
          boards: [defaultBoard],
          activeBoardId: defaultBoard.id,
          settings: defaultUserSettings,
          aiChatHistory: defaultAiChatHistory,
        };
        console.log(`Firestore Init: Data for new user ${appUser.id}:`, JSON.stringify(newUserDocumentData, null, 2));
        await setDoc(userDocRef, newUserDocumentData);
        console.log(`Firestore Init: SUCCESS - Document CREATED for new user: ${appUser.id}`);
        toast({ title: 'Welcome!', description: 'Your account has been set up and data initialized.' });
      } else {
        console.log(`Firestore Init: User document for ${appUser.id} EXISTS. Attempting to UPDATE existing document.`);
        const userData = userDocSnap.data();
        const updates: Record<string, any> = { lastLogin: serverTimestamp() as Timestamp };
        let needsUpdate = false;

        // Ensure essential structures exist
        if (!userData.boards || !Array.isArray(userData.boards) || userData.boards.length === 0) {
          updates.boards = [defaultBoard];
          updates.activeBoardId = defaultBoard.id;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - boards missing or empty. Adding default board.`);
        } else if (!userData.activeBoardId && updates.boards && updates.boards.length > 0) {
          // If boards were just added, ensure activeBoardId is also set
          updates.activeBoardId = updates.boards[0].id;
          needsUpdate = true; // Technically covered by above, but explicit
        } else if (userData.activeBoardId && !userData.boards.find((b: Board) => b.id === userData.activeBoardId) && userData.boards.length > 0) {
          // Active board ID is invalid, set to first available board
          updates.activeBoardId = userData.boards[0].id;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - invalid activeBoardId. Resetting to first board.`);
        }


        if (!userData.settings) {
          updates.settings = defaultUserSettings;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - settings missing. Adding default settings.`);
        }
        if (!userData.aiChatHistory) {
          updates.aiChatHistory = defaultAiChatHistory;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - AI chat history missing. Adding default history.`);
        }
        
        // Update user profile info if changed
        if (appUser.email && userData.email !== appUser.email) {
            updates.email = appUser.email;
            needsUpdate = true;
        }
        if (appUser.displayName && userData.displayName !== appUser.displayName) {
            updates.displayName = appUser.displayName;
            needsUpdate = true;
        }
        if (appUser.photoURL !== undefined && userData.photoURL !== appUser.photoURL) {
            updates.photoURL = appUser.photoURL || null;
            needsUpdate = true;
        }
        if(userData.provider !== appUser.provider) {
            updates.provider = appUser.provider;
            needsUpdate = true;
        }

        if (needsUpdate) {
          console.log(`Firestore Init: Updating existing document for ${appUser.id} with changes:`, Object.keys(updates));
          console.log(`Firestore Init: Update data for user ${appUser.id}:`, JSON.stringify(updates, null, 2));
          await updateDoc(userDocRef, updates);
          console.log(`Firestore Init: SUCCESS - Document UPDATED for user: ${appUser.id}`);
        } else {
          console.log(`Firestore Init: No major field updates needed for ${appUser.id}. Updating lastLogin only.`);
          await updateDoc(userDocRef, { lastLogin: serverTimestamp() as Timestamp });
          console.log(`Firestore Init: SUCCESS - lastLogin UPDATED for user: ${appUser.id}`);
        }
      }
    } catch (error) {
      console.error(`Firestore Init: CRITICAL ERROR during Firestore operation for user ${appUser.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: 'Data Sync Error', 
        description: `Could not save user data: ${errorMessage}. Please check console and Firestore rules.`, 
        variant: 'destructive', 
        duration: 15000 
      });
    }
  };


  useEffect(() => {
    setLoading(true);
    const storedGuestMode = typeof window !== 'undefined' ? localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true' : false;
    setIsGuest(storedGuestMode);

    if (storedGuestMode) {
      setCurrentUser(null);
      setCurrentProvider(null);
      setLoading(false);
      console.log("Auth: Guest mode active from localStorage.");
      return; 
    }

    console.log("Auth: Setting up Firebase and Supabase auth listeners.");
    const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      console.log("Auth: Firebase onAuthStateChanged triggered. User:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser && !isGuest) { 
        const isGoogleSignIn = firebaseUser.providerData.some(pd => pd.providerId === GoogleAuthProvider.PROVIDER_ID);
        const appUser = mapFirebaseUserToAppUser(firebaseUser, isGoogleSignIn ? 'google' : undefined);
        console.log("Auth: Firebase user identified:", appUser);
        setCurrentUser(appUser);
        setCurrentProvider(isGoogleSignIn ? 'google' : 'firebase');
        if (typeof window !== 'undefined') localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, isGoogleSignIn ? 'google' : 'firebase');
        await initializeFirestoreUserData(appUser); 
      } else if (typeof window !== 'undefined' && (localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'firebase' || localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'google')) { 
        console.log("Auth: Firebase user logged out or no user, clearing Firebase session.");
        setCurrentUser(null);
        setCurrentProvider(null);
       if (typeof window !== 'undefined') localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
      }
      setLoading(false);
    });

    const { data: { subscription: supabaseAuthSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth: Supabase onAuthStateChange triggered. Event:", event, "Session:", session ? session.user.id : 'null');
      setLoading(true); 
      if (!isGuest) { 
        const supabaseUser = session?.user;
        if (supabaseUser) {
          const appUser = mapSupabaseUserToAppUser(supabaseUser);
          console.log("Auth: Supabase user identified:", appUser);
          setCurrentUser(appUser);
          setCurrentProvider('supabase');
          if (typeof window !== 'undefined') localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'supabase');
          await initializeFirestoreUserData(appUser); 
        } else if (typeof window !== 'undefined' && localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'supabase') {
          console.log("Auth: Supabase user logged out or no session, clearing Supabase session.");
          setCurrentUser(null);
          setCurrentProvider(null);
          if (typeof window !== 'undefined') localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
        }
      }
      setLoading(false);
    });
    
    const persistedProvider = typeof window !== 'undefined' ? localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) as AuthProviderType | 'google' | null : null;
    if (!persistedProvider && !storedGuestMode) { 
        console.log("Auth: No persisted provider and not in guest mode. Initial load complete.");
        setLoading(false); 
    }


    return () => {
      console.log("Auth: Unsubscribing auth listeners.");
      unsubscribeFirebase();
      supabaseAuthSubscription?.unsubscribe();
    };
  }, [isGuest]); 

  const commonLoginSuccess = async (appUser: AppUser, provider: AuthProviderType | 'google') => {
    console.log(`Auth: Common login success for user ${appUser.id} via ${provider}`);
    setCurrentUser(appUser);
    setCurrentProvider(provider);
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    await initializeFirestoreUserData(appUser); 
    router.push('/');
  };

  const commonSignupSuccess = async (appUser: AppUser, provider: AuthProviderType | 'google') => {
    console.log(`Auth: Common signup success for user ${appUser.id} via ${provider}`);
    setCurrentUser(appUser); 
    setCurrentProvider(provider);
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    await initializeFirestoreUserData(appUser); 
    router.push('/');
  };


  const signupWithFirebase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    console.log(`Auth: Attempting Firebase signup for ${email}`);
    try {
      const userCredential = await createUserWithFirebase(firebaseAuth, email, password);
      const displayName = email.split('@')[0];
      await updateFirebaseProfile(userCredential.user, { displayName });
      
      const appUser = mapFirebaseUserToAppUser(userCredential.user);
      appUser.displayName = displayName; 
      
      toast({ title: 'Firebase Signup Successful', description: 'Welcome aboard!' });
      await commonSignupSuccess(appUser, 'firebase');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      if (authError.code === 'auth/email-already-in-use') {
        toast({ 
          title: 'Firebase Signup Failed', 
          description: 'This email address is already in use. Please log in or use a different email.', 
          variant: 'destructive',
          duration: 7000,
        });
      } else {
        toast({ title: 'Firebase Signup Failed', description: authError.message, variant: 'destructive' });
      }
      console.error('Firebase Signup error:', authError.code, authError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithFirebase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    console.log(`Auth: Attempting Firebase login for ${email}`);
    try {
      const userCredential = await signInWithFirebase(firebaseAuth, email, password);
      const appUser = mapFirebaseUserToAppUser(userCredential.user);
      toast({ title: 'Firebase Login Successful', description: 'Welcome back!' });
      await commonLoginSuccess(appUser, 'firebase');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      toast({ title: 'Firebase Login Failed', description: authError.message, variant: 'destructive' });
      console.error('Firebase Login error:', authError.code, authError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleFirebase = async (): Promise<AppUser | null> => {
    setLoading(true);
    console.log(`Auth: Attempting Google Sign-In`);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const appUser = mapFirebaseUserToAppUser(result.user, 'google');
      toast({ title: 'Google Sign-In Successful', description: `Welcome, ${appUser.displayName || 'User'}!` });
      await commonLoginSuccess(appUser, 'google');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      
      if (authError.code === 'auth/account-exists-with-different-credential') {
        toast({
          title: 'Account Exists',
          description: 'An account already exists with this email using a different sign-in method (e.g., email/password). Please sign in with that method.',
          variant: 'destructive',
          duration: 8000,
        });
      } else {
        toast({ title: 'Google Sign-In Failed', description: authError.message, variant: 'destructive' });
      }
      console.error('Google Sign-In error:', authError.code, authError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };


  const signupWithSupabase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    console.log(`Auth: Attempting Supabase signup for ${email}`);
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
      await commonSignupSuccess(appUser, 'supabase'); 
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Signup Failed', description: authError.message, variant: 'destructive' });
      console.error('Supabase Signup error:', authError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithSupabase = async (email: string, password: string): Promise<AppUser | null> => {
    setLoading(true);
    console.log(`Auth: Attempting Supabase login for ${email}`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase login did not return a user.');
      
      const appUser = mapSupabaseUserToAppUser(data.user);
      toast({ title: 'Supabase Login Successful', description: 'Welcome back!' });
      await commonLoginSuccess(appUser, 'supabase');
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Login Failed', description: authError.message, variant: 'destructive' });
      console.error('Supabase Login error:', authError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    const providerToLogout = currentProvider; 
    console.log(`Auth: Logging out user from ${providerToLogout || 'guest session'}`);
    try {
      if (providerToLogout === 'firebase' || providerToLogout === 'google') {
        await signOutFirebase(firebaseAuth);
      } else if (providerToLogout === 'supabase') {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      const authError = error as FirebaseAuthError | SupabaseAuthError;
      toast({ title: 'Logout Failed', description: authError.message, variant: 'destructive' });
      console.error('Logout error:', authError.message);
    } finally {
      setCurrentUser(null);
      setCurrentProvider(null);
      setIsGuest(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
      }
      setLoading(false);
      router.push('/login');
    }
  };

  const enterGuestMode = useCallback(() => {
    console.log("Auth: Entering guest mode.");
    setCurrentUser(null);
    setCurrentProvider(null);
    setIsGuest(true);
    if (typeof window !== 'undefined') {
        localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
        localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY); 
    }
    router.push('/');
  }, [router]);

  const exitGuestMode = useCallback(() => {
    console.log("Auth: Exiting guest mode.");
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    // CurrentUser should already be null, provider null.
    // The useEffect will then try to re-evaluate auth state.
    router.push('/login'); 
  }, [router]);

  const value = {
    currentUser,
    loading,
    currentProvider,
    isGuest,
    signupWithFirebase,
    loginWithFirebase,
    signInWithGoogleFirebase,
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

