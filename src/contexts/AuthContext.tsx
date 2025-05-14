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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, arrayUnion, arrayRemove, writeBatch, query, where, getDocs, orderBy, limit } from 'firebase/firestore'; // Firestore imports
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Board, Task, Column, BoardGroup, Organization, Team, ChatRoom } from '@/types'; // Ensure types are available
import { formatISO } from 'date-fns';
import type { InteractionStyle } from './SettingsContext';
import type { MessageHistoryItem } from '@/ai/schemas';


// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Helper to generate invite codes
const generateInviteCode = (length: number = 5): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Using only uppercase and numbers for simpler codes
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};


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
  groupId: null, // Initialize groupId
  organizationId: null,
  teamId: null,
  isPublic: false,
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
  organizationMemberships?: string[];
  teamMemberships?: string[];
  defaultOrganizationId?: string | null;
  chatRoomIds?: string[]; // Added for chat feature
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
  createOrganization: (name: string, description?: string) => Promise<Organization | null>;
  createTeam: (name: string, organizationId: string, description?: string) => Promise<Team | null>;
  joinTeam: (teamId: string) => Promise<boolean>;
  getUserOrganizations: () => Promise<Organization[]>;
  getUserTeams: (organizationId?: string) => Promise<Team[]>;
  setCurrentOrganization: (organizationId: string | null) => Promise<void>;
  joinOrganizationByInviteCode: (inviteCode: string) => Promise<Organization | null>;
  getUsersForChat: () => Promise<AppUser[]>; // New function for chat
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
    organizationMemberships: [],
    teamMemberships: [],
    defaultOrganizationId: null,
    chatRoomIds: [], // Initialize chatRoomIds
  });

  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): AppUser => ({
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName: supabaseUser.user_metadata?.displayName || supabaseUser.email?.split('@')[0] || 'User',
    photoURL: supabaseUser.user_metadata?.avatar_url,
    provider: 'supabase',
    organizationMemberships: [],
    teamMemberships: [],
    defaultOrganizationId: null,
    chatRoomIds: [], // Initialize chatRoomIds
  });

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
          aiChatHistory: defaultAiChatHistory, // Initialize with new structure
          boardGroups: [] as BoardGroup[],
          organizationMemberships: [],
          teamMemberships: [],
          defaultOrganizationId: null,
          chatRoomIds: [], // Initialize chatRoomIds for new user
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

        if (!userData.boards || !Array.isArray(userData.boards) || userData.boards.length === 0) {
          updates.boards = [defaultBoard];
          updates.activeBoardId = defaultBoard.id;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - boards missing or empty. Adding default board.`);
        } else {
          updates.boards = userData.boards.map((board: Board) => ({
            ...board,
            groupId: board.groupId === undefined ? null : board.groupId,
            organizationId: board.organizationId === undefined ? null : board.organizationId,
            teamId: board.teamId === undefined ? null : board.teamId,
            isPublic: board.isPublic === undefined ? false : board.isPublic,
          }));
          if (JSON.stringify(updates.boards) !== JSON.stringify(userData.boards)) {
             needsUpdate = true;
             console.log(`Firestore Init: User ${appUser.id} - updated boards with groupId/orgId/teamId.`);
          }
        }

        if (!userData.activeBoardId && updates.boards && updates.boards.length > 0) {
          updates.activeBoardId = updates.boards[0].id;
          needsUpdate = true;
        } else if (userData.activeBoardId && userData.boards && !userData.boards.find((b: Board) => b.id === userData.activeBoardId) && userData.boards.length > 0) {
          updates.activeBoardId = userData.boards[0].id;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - invalid activeBoardId. Resetting to first board.`);
        }


        if (!userData.settings) {
          updates.settings = defaultUserSettings;
          needsUpdate = true;
        }
        // Ensure aiChatHistory field exists with the correct structure
        if (!userData.aiChatHistory || typeof userData.aiChatHistory.messages === 'undefined') {
          updates.aiChatHistory = defaultAiChatHistory;
          needsUpdate = true;
        }
        if (!userData.boardGroups || !Array.isArray(userData.boardGroups)) {
          updates.boardGroups = [];
          needsUpdate = true;
        }
        if (!userData.organizationMemberships || !Array.isArray(userData.organizationMemberships)) {
          updates.organizationMemberships = [];
          needsUpdate = true;
        }
        if (!userData.teamMemberships || !Array.isArray(userData.teamMemberships)) {
          updates.teamMemberships = [];
          needsUpdate = true;
        }
        if (userData.defaultOrganizationId === undefined) {
          updates.defaultOrganizationId = null;
          needsUpdate = true;
        }
        if (!userData.chatRoomIds || !Array.isArray(userData.chatRoomIds)) { // Check for chatRoomIds
          updates.chatRoomIds = [];
          needsUpdate = true;
        }

        if (appUser.email && userData.email !== appUser.email) {
            updates.email = appUser.email; needsUpdate = true;
        }
        if (appUser.displayName && userData.displayName !== appUser.displayName) {
            updates.displayName = appUser.displayName; needsUpdate = true;
        }
        if (appUser.photoURL !== undefined && userData.photoURL !== appUser.photoURL) {
            updates.photoURL = appUser.photoURL || null; needsUpdate = true;
        }
        if(userData.provider !== appUser.provider) {
            updates.provider = appUser.provider; needsUpdate = true;
        }

        if (needsUpdate) {
          console.log(`Firestore Init: Updating existing document for ${appUser.id} with changes:`, Object.keys(updates));
          await updateDoc(userDocRef, updates);
          console.log(`Firestore Init: SUCCESS - Document UPDATED for user: ${appUser.id}`);
        } else {
          console.log(`Firestore Init: No major field updates needed for ${appUser.id}. Updating lastLogin only.`);
          await updateDoc(userDocRef, { lastLogin: serverTimestamp() as Timestamp });
        }
      }
    } catch (error) {
      console.error(`Firestore Init: CRITICAL ERROR during Firestore operation for user ${appUser.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Data Sync Error',
        description: `Could not save user data: ${errorMessage}.`,
        variant: 'destructive',
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
      return;
    }

    const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser && !isGuest) {
        const isGoogleSignIn = firebaseUser.providerData.some(pd => pd.providerId === GoogleAuthProvider.PROVIDER_ID);
        const baseAppUser = mapFirebaseUserToAppUser(firebaseUser, isGoogleSignIn ? 'google' : undefined);

        const userDocRef = doc(db, 'users', baseAppUser.id);
        const userDocSnap = await getDoc(userDocRef);
        let finalAppUser = baseAppUser;
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            finalAppUser = {
                ...baseAppUser,
                organizationMemberships: userData.organizationMemberships || [],
                teamMemberships: userData.teamMemberships || [],
                defaultOrganizationId: userData.defaultOrganizationId || null,
                chatRoomIds: userData.chatRoomIds || [], // Load chatRoomIds
            };
        }

        setCurrentUser(finalAppUser);
        setCurrentProvider(isGoogleSignIn ? 'google' : 'firebase');
        if (typeof window !== 'undefined') localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, isGoogleSignIn ? 'google' : 'firebase');
        await initializeFirestoreUserData(finalAppUser);
      } else if (typeof window !== 'undefined' && (localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'firebase' || localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'google')) {
        setCurrentUser(null);
        setCurrentProvider(null);
       if (typeof window !== 'undefined') localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
      }
      setLoading(false);
    });

    const { data: { subscription: supabaseAuthSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      if (!isGuest) {
        const supabaseUser = session?.user;
        if (supabaseUser) {
          const baseAppUser = mapSupabaseUserToAppUser(supabaseUser);
          const userDocRef = doc(db, 'users', baseAppUser.id);
          const userDocSnap = await getDoc(userDocRef);
          let finalAppUser = baseAppUser;
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                finalAppUser = {
                    ...baseAppUser,
                    organizationMemberships: userData.organizationMemberships || [],
                    teamMemberships: userData.teamMemberships || [],
                    defaultOrganizationId: userData.defaultOrganizationId || null,
                    chatRoomIds: userData.chatRoomIds || [], // Load chatRoomIds
                };
            }
          setCurrentUser(finalAppUser);
          setCurrentProvider('supabase');
          if (typeof window !== 'undefined') localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'supabase');
          await initializeFirestoreUserData(finalAppUser);
        } else if (typeof window !== 'undefined' && localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) === 'supabase') {
          setCurrentUser(null);
          setCurrentProvider(null);
          if (typeof window !== 'undefined') localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
        }
      }
      setLoading(false);
    });

    const persistedProvider = typeof window !== 'undefined' ? localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) as AuthProviderType | 'google' | null : null;
    if (!persistedProvider && !storedGuestMode) {
        setLoading(false);
    }

    return () => {
      unsubscribeFirebase();
      supabaseAuthSubscription?.unsubscribe();
    };
  }, [isGuest]);

  const commonLoginSuccess = async (appUser: AppUser, provider: AuthProviderType | 'google') => {
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
      await commonLoginSuccess(appUser, 'firebase');
      return appUser;
    } catch (error) {
      const authError = error as FirebaseAuthError;
      toast({ title: 'Firebase Login Failed', description: authError.message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleFirebase = async (): Promise<AppUser | null> => {
    setLoading(true);
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
          description: 'An account already exists with this email using a different sign-in method.',
          variant: 'destructive',
          duration: 8000,
        });
      } else {
        toast({ title: 'Google Sign-In Failed', description: authError.message, variant: 'destructive' });
      }
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
      await commonSignupSuccess(appUser, 'supabase');
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Signup Failed', description: authError.message, variant: 'destructive' });
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
      await commonLoginSuccess(appUser, 'supabase');
      return appUser;
    } catch (error) {
      const authError = error as SupabaseAuthError;
      toast({ title: 'Supabase Login Failed', description: authError.message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    const providerToLogout = currentProvider;
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
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    router.push('/login');
  }, [router]);

  // --- Co-working Feature Functions ---
  const createOrganization = async (name: string, description?: string): Promise<Organization | null> => {
    if (!currentUser) {
        toast({ title: "Authentication Required", description: "You must be logged in to create an organization.", variant: "destructive" });
        return null;
    }
    setLoading(true);
    try {
        const inviteCode = generateInviteCode();
        const newOrgRef = await addDoc(collection(db, "organizations"), {
            name,
            description: description || "",
            ownerId: currentUser.id,
            memberIds: [currentUser.id],
            teamIds: [],
            createdAt: serverTimestamp(),
            inviteCode,
        });

        const userDocRef = doc(db, "users", currentUser.id);
        await updateDoc(userDocRef, {
            organizationMemberships: arrayUnion(newOrgRef.id),
            defaultOrganizationId: newOrgRef.id,
        });

        const newOrgData: Organization = {
            id: newOrgRef.id, name, ownerId: currentUser.id, memberIds: [currentUser.id], teamIds: [], createdAt: new Date().toISOString(), description, inviteCode
        };

        setCurrentUser(prevUser => prevUser ? ({
            ...prevUser,
            organizationMemberships: [...(prevUser.organizationMemberships || []), newOrgRef.id],
            defaultOrganizationId: newOrgRef.id,
        }) : null);

        toast({ title: "Organization Created", description: `Organization "${name}" (Code: ${inviteCode}) created.` });
        return newOrgData;
    } catch (error) {
        console.error("Error creating organization:", error);
        toast({ title: "Creation Failed", description: "Could not create the organization.", variant: "destructive" });
        return null;
    } finally {
        setLoading(false);
    }
  };

  const createTeam = async (name: string, organizationId: string, description?: string): Promise<Team | null> => {
    if (!currentUser) {
        toast({ title: "Authentication Required", description: "You must be logged in to create a team.", variant: "destructive" });
        return null;
    }
    if (!organizationId) {
        toast({ title: "Organization Required", description: "A team must belong to an organization.", variant: "destructive" });
        return null;
    }
    setLoading(true);
    try {
        const newTeamRef = await addDoc(collection(db, "teams"), {
            name,
            description: description || "",
            organizationId,
            memberIds: [currentUser.id],
            adminIds: [currentUser.id],
            createdAt: serverTimestamp(),
        });

        const orgDocRef = doc(db, "organizations", organizationId);
        await updateDoc(orgDocRef, {
            teamIds: arrayUnion(newTeamRef.id),
        });

        const userDocRef = doc(db, "users", currentUser.id);
        await updateDoc(userDocRef, {
            teamMemberships: arrayUnion(newTeamRef.id),
        });

        const newTeamData: Team = {
            id: newTeamRef.id, name, organizationId, memberIds: [currentUser.id], adminIds: [currentUser.id], createdAt: new Date().toISOString(), description
        };

        setCurrentUser(prevUser => prevUser ? ({
            ...prevUser,
            teamMemberships: [...(prevUser.teamMemberships || []), newTeamRef.id],
        }) : null);

        toast({ title: "Team Created", description: `Team "${name}" has been successfully created.` });
        return newTeamData;
    } catch (error) {
        console.error("Error creating team:", error);
        toast({ title: "Creation Failed", description: "Could not create the team.", variant: "destructive" });
        return null;
    } finally {
        setLoading(false);
    }
  };

  const joinTeam = async (teamId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
        const batch = writeBatch(db);
        const teamDocRef = doc(db, "teams", teamId);
        batch.update(teamDocRef, { memberIds: arrayUnion(currentUser.id) });

        const userDocRef = doc(db, "users", currentUser.id);
        batch.update(userDocRef, { teamMemberships: arrayUnion(teamId) });

        await batch.commit();

        setCurrentUser(prevUser => prevUser ? ({
            ...prevUser,
            teamMemberships: [...new Set([...(prevUser.teamMemberships || []), teamId])],
        }) : null);
        toast({ title: "Joined Team", description: "Successfully joined the team." });
        return true;
    } catch (error) {
        console.error("Error joining team:", error);
        toast({ title: "Failed to Join", description: "Could not join the team.", variant: "destructive" });
        return false;
    }
  };

  const getUserOrganizations = async (): Promise<Organization[]> => {
    if (!currentUser || !currentUser.id) {
        return [];
    }
    try {
        const orgsQuery = query(collection(db, "organizations"), where("memberIds", "array-contains", currentUser.id));
        const querySnapshot = await getDocs(orgsQuery);
        return querySnapshot.docs.map(docSnap => {
             const data = docSnap.data();
             return {
                id: docSnap.id,
                name: data.name,
                ownerId: data.ownerId,
                memberIds: data.memberIds,
                teamIds: data.teamIds || [],
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                description: data.description,
                inviteCode: data.inviteCode, // Ensure inviteCode is fetched
             } as Organization;
        });
    } catch (error) {
        console.error("Error fetching user organizations:", error);
        return [];
    }
  };

  const getUserTeams = async (organizationId?: string): Promise<Team[]> => {
    if (!currentUser || !currentUser.id) {
        return [];
    }
    try {
        let teamsQuery;
        if (organizationId) {
            teamsQuery = query(collection(db, "teams"), where("organizationId", "==", organizationId), where("memberIds", "array-contains", currentUser.id));
        } else {
            if (!currentUser.teamMemberships || currentUser.teamMemberships.length === 0) return [];
            // Firestore 'in' query limit is 30. If user is in more teams, this needs batching.
            teamsQuery = query(collection(db, "teams"), where("__name__", "in", currentUser.teamMemberships.slice(0,30) ));
        }
        const querySnapshot = await getDocs(teamsQuery);
        return querySnapshot.docs
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    name: data.name,
                    organizationId: data.organizationId,
                    memberIds: data.memberIds,
                    adminIds: data.adminIds,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    description: data.description,
                } as Team;
            })
            .filter(team => team.memberIds.includes(currentUser.id)); // Ensure membership client-side if query was broad

    } catch (error) {
        console.error("Error fetching user teams:", error);
        return [];
    }
  };

  const setCurrentOrganization = async (organizationId: string | null): Promise<void> => {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "users", currentUser.id);
        await updateDoc(userDocRef, { defaultOrganizationId: organizationId });
        setCurrentUser(prev => prev ? { ...prev, defaultOrganizationId: organizationId } : null);
        toast({ title: "Active Organization Set", description: organizationId ? "Default organization updated." : "No default organization selected." });
    } catch (error) {
        console.error("Error setting current organization:", error);
        toast({ title: "Update Failed", description: "Could not set active organization.", variant: "destructive" });
    }
  };

  const joinOrganizationByInviteCode = async (inviteCode: string): Promise<Organization | null> => {
    if (!currentUser) {
      toast({ title: "Authentication Required", description: "You must be logged in to join an organization.", variant: "destructive" });
      return null;
    }
    if (!inviteCode || inviteCode.trim().length === 0) {
      toast({ title: "Invalid Code", description: "Invite code cannot be empty.", variant: "destructive" });
      return null;
    }

    setLoading(true);
    try {
      const orgsQuery = query(collection(db, "organizations"), where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(orgsQuery);

      if (querySnapshot.empty) {
        toast({ title: "Not Found", description: "No organization found with this invite code.", variant: "destructive" });
        return null;
      }

      const orgDoc = querySnapshot.docs[0]; // Assuming invite codes are unique
      const organization = { id: orgDoc.id, ...orgDoc.data() } as Organization;

      if (organization.memberIds.includes(currentUser.id)) {
        toast({ title: "Already a Member", description: `You are already a member of "${organization.name}".` });
        // Optionally set as default if not already
        if(currentUser.defaultOrganizationId !== organization.id) {
            await setCurrentOrganization(organization.id);
        }
        return organization;
      }

      const batch = writeBatch(db);
      const orgDocRef = doc(db, "organizations", organization.id);
      batch.update(orgDocRef, { memberIds: arrayUnion(currentUser.id) });

      const userDocRef = doc(db, "users", currentUser.id);
      batch.update(userDocRef, {
          organizationMemberships: arrayUnion(organization.id),
          defaultOrganizationId: organization.id // Automatically set as default upon joining
      });

      await batch.commit();

      setCurrentUser(prevUser => prevUser ? ({
        ...prevUser,
        organizationMemberships: [...new Set([...(prevUser.organizationMemberships || []), organization.id])],
        defaultOrganizationId: organization.id,
      }) : null);

      toast({ title: "Joined Organization", description: `Successfully joined "${organization.name}". It's now your active organization.` });
      return organization;

    } catch (error) {
      console.error("Error joining organization by invite code:", error);
      toast({ title: "Join Failed", description: "Could not join the organization.", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getUsersForChat = async (): Promise<AppUser[]> => {
    if (!currentUser || isGuest) {
        // toast({ title: "Login Required", description: "Please log in to use the chat feature.", variant: "destructive" });
        return [];
    }

    const usersCollectionRef = collection(db, 'users');
    let usersQuery;

    if (currentUser.defaultOrganizationId) {
        // Fetch users who are part of the current user's default organization
        usersQuery = query(usersCollectionRef, where('organizationMemberships', 'array-contains', currentUser.defaultOrganizationId));
    } else {
        // No default organization, perhaps fetch all users (consider implications for large user bases)
        // For now, let's return a limited set or an empty array if no org context.
        // This part might need refinement based on product decisions (e.g., allow global chat or require org for chat).
        // toast({ title: "Organization Needed", description: "Select a default organization to chat with its members.", variant: "default" });
        usersQuery = query(usersCollectionRef, orderBy('displayName'), limit(50)); // Example: limit to 50 users if no org
    }

    try {
        const querySnapshot = await getDocs(usersQuery);
        const users: AppUser[] = [];
        querySnapshot.forEach(docSnap => {
            if (docSnap.id !== currentUser.id) { // Exclude current user from the list
                const data = docSnap.data();
                users.push({
                    id: docSnap.id,
                    email: data.email,
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    provider: data.provider,
                    organizationMemberships: data.organizationMemberships || [],
                    teamMemberships: data.teamMemberships || [],
                    defaultOrganizationId: data.defaultOrganizationId || null,
                    chatRoomIds: data.chatRoomIds || [],
                });
            }
        });
        return users;
    } catch (error) {
        console.error("Error fetching users for chat:", error);
        toast({ title: "Error Fetching Users", description: "Could not load users for chat.", variant: "destructive" });
        return [];
    }
  };


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
    createOrganization,
    createTeam,
    joinTeam,
    getUserOrganizations,
    getUserTeams,
    setCurrentOrganization,
    joinOrganizationByInviteCode,
    getUsersForChat,
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
