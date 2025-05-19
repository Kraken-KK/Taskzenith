
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
import type { Board, Task, Column, BoardGroup, Organization, Team, ChatRoom, AiChatSession } from '@/types';
import { formatISO } from 'date-fns';
import type { InteractionStyle } from './SettingsContext';
import type { MessageHistoryItem } from '@/ai/schemas';


// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Helper to generate invite codes
const generateInviteCode = (length: number = 5): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const assignTaskStatusToDefaultColumns = (columns: Column[]): Column[] => {
  return columns.map(col => ({
    ...col,
    id: col.id || generateId('col-default'),
    title: col.title || 'Untitled Column',
    wipLimit: col.wipLimit === undefined ? 0 : col.wipLimit,
    tasks: Array.isArray(col.tasks) ? col.tasks.map(task => ({
      ...task,
      id: task.id || generateId('task-default'),
      content: task.content || 'Untitled Task',
      status: col.id || '',
      priority: task.priority || 'medium',
      createdAt: task.createdAt || formatISO(new Date()),
      checklist: Array.isArray(task.checklist) ? task.checklist.map(ci => ({ ...ci, id: ci.id || generateId('cl-item')})) : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(st => ({ ...st, id: st.id || generateId('subtask')})) : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      tags: Array.isArray(task.tags) ? task.tags : [],
      assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      description: task.description || null,
      deadline: task.deadline || null,
    })) : [],
  }));
};


const getDefaultBoardForNewUser = (): Board => ({
  id: generateId('board-user'),
  name: 'My First Board',
  columns: assignTaskStatusToDefaultColumns(getDefaultColumnsForNewUser()),
  createdAt: formatISO(new Date()),
  theme: {},
  groupId: null,
  organizationId: null,
  teamId: null,
  isPublic: false,
  ownerId: null, 
});

const getDefaultColumnsForNewUser = (): Column[] => [
  {
    id: generateId('col'),
    title: 'To Do',
    tasks: [
      { id: generateId('task'), content: 'Welcome! Plan your day', status: '', priority: 'high', createdAt: formatISO(new Date()), dependencies:[], checklist:[], tags:[], assignedTo: [], subtasks: [] },
    ],
  },
  { id: generateId('col'), title: 'In Progress', tasks: [], wipLimit: 0 },
  { id: generateId('col'), title: 'Done', tasks: [], wipLimit: 0 },
];


const defaultUserSettings = {
  theme: 'system' as 'light' | 'dark' | 'system',
  isBetaModeEnabled: false,
  interactionStyle: 'friendly' as InteractionStyle,
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
  chatRoomIds?: string[];
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
  getUsersForChat: () => Promise<AppUser[]>;
  getOrganizationMembers: (organizationId: string) => Promise<AppUser[]>;
  getTeamMembers: (teamId: string) => Promise<AppUser[]>; 
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
    chatRoomIds: [],
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
    chatRoomIds: [],
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
      defaultBoard.ownerId = appUser.id; // Set ownerId for the default personal board

      if (!userDocSnap.exists()) {
        console.log(`Firestore Init: User document for ${appUser.id} does NOT exist. Attempting to CREATE new document.`);
        const newUserDocumentData = {
          email: appUser.email,
          displayName: appUser.displayName,
          photoURL: appUser.photoURL || null,
          provider: appUser.provider,
          createdAt: serverTimestamp() as Timestamp,
          lastLogin: serverTimestamp() as Timestamp,
          personalBoards: [defaultBoard], 
          activeBoardId: defaultBoard.id,
          settings: defaultUserSettings,
          aiChatHistory: { // For single, last AI chat session
            messages: [],
            lastUpdatedAt: serverTimestamp(),
          },
          boardGroups: [] as BoardGroup[],
          organizationMemberships: [] as string[],
          teamMemberships: [] as string[],
          defaultOrganizationId: null,
          chatRoomIds: [] as string[],
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

        // Ensure personalBoards field exists and is an array, and boards have ownerId
        if (!Array.isArray(userData.personalBoards)) {
            updates.personalBoards = [defaultBoard]; // Initialize if completely missing
            needsUpdate = true;
            console.log(`Firestore Init: User ${appUser.id} - personalBoards missing. Initialized.`);
        } else {
            updates.personalBoards = userData.personalBoards.map((board: Partial<Board>) => ({
                ...getDefaultBoardForNewUser(), 
                ...board, 
                id: board.id || generateId('board-migrated'),
                ownerId: board.ownerId || appUser.id // Ensure ownerId
            }));
            if (JSON.stringify(updates.personalBoards) !== JSON.stringify(userData.personalBoards)) {
                needsUpdate = true;
                console.log(`Firestore Init: User ${appUser.id} - updated personalBoards structure/ownerId.`);
            }
        }

        if ((!userData.activeBoardId && updates.personalBoards && updates.personalBoards.length > 0) ||
            (userData.activeBoardId && updates.personalBoards && !updates.personalBoards.find((b: Board) => b.id === userData.activeBoardId) && updates.personalBoards.length > 0)) {
          updates.activeBoardId = updates.personalBoards[0].id;
          needsUpdate = true;
          console.log(`Firestore Init: User ${appUser.id} - activeBoardId was invalid or missing. Reset to first personal board.`);
        }


        if (!userData.settings || typeof userData.settings !== 'object') {
          updates.settings = defaultUserSettings;
          needsUpdate = true;
        } else {
            updates.settings = { ...defaultUserSettings, ...userData.settings };
            if(JSON.stringify(updates.settings) !== JSON.stringify(userData.settings)){
                needsUpdate = true;
            }
        }
        
        if (!userData.aiChatHistory || typeof userData.aiChatHistory !== 'object' || !Array.isArray(userData.aiChatHistory.messages) || !(userData.aiChatHistory.lastUpdatedAt instanceof Timestamp)) {
            updates.aiChatHistory = { messages: [], lastUpdatedAt: serverTimestamp() };
            needsUpdate = true;
            console.log(`Firestore Init: User ${appUser.id} - aiChatHistory malformed. Repaired.`);
        }


        if (!Array.isArray(userData.boardGroups)) {
          updates.boardGroups = []; needsUpdate = true;
        }
        if (!Array.isArray(userData.organizationMemberships)) {
          updates.organizationMemberships = []; needsUpdate = true;
        }
        if (!Array.isArray(userData.teamMemberships)) {
          updates.teamMemberships = []; needsUpdate = true;
        }
        if (userData.defaultOrganizationId === undefined) { 
          updates.defaultOrganizationId = null; needsUpdate = true;
        }
        if (!Array.isArray(userData.chatRoomIds)) {
          updates.chatRoomIds = []; needsUpdate = true;
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
      setTimeout(() => toast({
        title: 'Data Sync Error',
        description: `Could not save user data: ${errorMessage}.`,
        variant: 'destructive',
      }), 0);
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
                defaultOrganizationId: userData.defaultOrganizationId === undefined ? null : userData.defaultOrganizationId,
                chatRoomIds: userData.chatRoomIds || [],
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
                    defaultOrganizationId: userData.defaultOrganizationId === undefined ? null : userData.defaultOrganizationId,
                    chatRoomIds: userData.chatRoomIds || [],
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
    await initializeFirestoreUserData(appUser);
    setCurrentUser(appUser);
    setCurrentProvider(provider);
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    router.push('/');
  };

  const commonSignupSuccess = async (appUser: AppUser, provider: AuthProviderType | 'google') => {
    await initializeFirestoreUserData(appUser);
    setCurrentUser(appUser);
    setCurrentProvider(provider);
    setIsGuest(false);
    if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
        localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
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

  const createOrganization = async (name: string, description?: string): Promise<Organization | null> => {
    if (!currentUser) {
        toast({ title: "Authentication Required", description: "You must be logged in to create an organization.", variant: "destructive" });
        return null;
    }
    setLoading(true);
    try {
        const inviteCode = generateInviteCode();
        const orgData = {
            name,
            description: description || "",
            ownerId: currentUser.id,
            memberIds: [currentUser.id],
            teamIds: [] as string[],
            createdAt: serverTimestamp(),
            inviteCode,
        };
        const newOrgRef = await addDoc(collection(db, "organizations"), orgData);

        const userDocRef = doc(db, "users", currentUser.id);
        await updateDoc(userDocRef, {
            organizationMemberships: arrayUnion(newOrgRef.id),
            defaultOrganizationId: newOrgRef.id,
        });

        const newOrgData: Organization = {
            id: newOrgRef.id,
            name: orgData.name,
            ownerId: orgData.ownerId,
            memberIds: orgData.memberIds,
            teamIds: orgData.teamIds,
            createdAt: new Date().toISOString(),
            description: orgData.description,
            inviteCode: orgData.inviteCode
        };

        setCurrentUser(prevUser => prevUser ? ({
            ...prevUser,
            organizationMemberships: [...(prevUser.organizationMemberships || []), newOrgRef.id],
            defaultOrganizationId: newOrgRef.id,
        }) : null);

        toast({ title: "Organization Created", description: `Organization "${name}" (Invite Code: ${inviteCode}) created and set as active.` });
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
    const batch = writeBatch(db);
    try {
      const newTeamRef = doc(collection(db, "teams"));
      const teamData = {
        name,
        description: description || "",
        organizationId,
        memberIds: [currentUser.id],
        adminIds: [currentUser.id],
        createdAt: serverTimestamp(),
      };
      batch.set(newTeamRef, teamData);

      const orgDocRef = doc(db, "organizations", organizationId);
      batch.update(orgDocRef, { teamIds: arrayUnion(newTeamRef.id) });

      const userDocRef = doc(db, "users", currentUser.id);
      batch.update(userDocRef, { teamMemberships: arrayUnion(newTeamRef.id) });

      await batch.commit();

      const newTeamData: Team = {
        id: newTeamRef.id,
        name: teamData.name,
        organizationId: teamData.organizationId,
        memberIds: teamData.memberIds,
        adminIds: teamData.adminIds,
        createdAt: new Date().toISOString(),
        description: teamData.description,
      };

      setCurrentUser(prevUser =>
        prevUser
          ? {
              ...prevUser,
              teamMemberships: [...new Set([...(prevUser.teamMemberships || []), newTeamRef.id])],
            }
          : null
      );

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
    if (!currentUser) {
        toast({ title: "Authentication Required", variant: "destructive" });
        return false;
    }
    setLoading(true);
    const batch = writeBatch(db);
    try {
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
    } finally {
        setLoading(false);
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
                inviteCode: data.inviteCode,
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
            // Fetch all teams for the given organization
            teamsQuery = query(
                collection(db, "teams"),
                where("organizationId", "==", organizationId),
                orderBy("name", "asc")
            );
        } else {
            // Fetch all teams the user is a member of (across all orgs)
             teamsQuery = query(
                collection(db, "teams"),
                where("memberIds", "array-contains", currentUser.id),
                orderBy("name", "asc")
            );
        }
        const querySnapshot = await getDocs(teamsQuery);
        return querySnapshot.docs
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    name: data.name,
                    organizationId: data.organizationId,
                    memberIds: data.memberIds || [],
                    adminIds: data.adminIds || [],
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    description: data.description,
                } as Team;
            });

    } catch (error) {
        console.error("Error fetching user teams:", error);
        return [];
    }
  };

  const setCurrentOrganization = async (organizationId: string | null): Promise<void> => {
    if (!currentUser) return;
    setLoading(true);
    try {
        const userDocRef = doc(db, "users", currentUser.id);
        await updateDoc(userDocRef, { defaultOrganizationId: organizationId });
        setCurrentUser(prev => prev ? { ...prev, defaultOrganizationId: organizationId } : null);
        toast({ title: "Active Organization Set", description: organizationId ? "Default organization updated." : "No default organization selected." });
    } catch (error) {
        console.error("Error setting current organization:", error);
        toast({ title: "Update Failed", description: "Could not set active organization.", variant: "destructive" });
    } finally {
        setLoading(false);
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
    const batch = writeBatch(db);
    try {
      const orgsQuery = query(collection(db, "organizations"), where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(orgsQuery);

      if (querySnapshot.empty) {
        toast({ title: "Not Found", description: "No organization found with this invite code.", variant: "destructive" });
        setLoading(false);
        return null;
      }

      const orgDoc = querySnapshot.docs[0];
      const organizationData = orgDoc.data();
      const organization: Organization = {
          id: orgDoc.id,
          name: organizationData.name,
          ownerId: organizationData.ownerId,
          memberIds: organizationData.memberIds || [],
          teamIds: organizationData.teamIds || [],
          createdAt: organizationData.createdAt?.toDate ? organizationData.createdAt.toDate().toISOString() : new Date().toISOString(),
          description: organizationData.description,
          inviteCode: organizationData.inviteCode,
      };


      if (organization.memberIds.includes(currentUser.id)) {
        toast({ title: "Already a Member", description: `You are already a member of "${organization.name}".` });
        if(currentUser.defaultOrganizationId !== organization.id) {
            const userDocRefForDefaultUpdate = doc(db, "users", currentUser.id);
            batch.update(userDocRefForDefaultUpdate, { defaultOrganizationId: organization.id });
        }
        await batch.commit(); // Commit even if just setting default
        // Update local state for defaultOrganizationId immediately if it changed
        if(currentUser.defaultOrganizationId !== organization.id) {
           setCurrentUser(prevUser => prevUser ? ({...prevUser, defaultOrganizationId: organization.id}) : null);
        }
        setLoading(false);
        return organization;
      }


      const orgDocRef = doc(db, "organizations", organization.id);
      batch.update(orgDocRef, { memberIds: arrayUnion(currentUser.id) });

      const userDocRef = doc(db, "users", currentUser.id);
      batch.update(userDocRef, {
          organizationMemberships: arrayUnion(organization.id),
          defaultOrganizationId: organization.id
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
        return [];
    }

    const usersCollectionRef = collection(db, 'users');
    let usersQuery;

    if (currentUser.defaultOrganizationId) {
        usersQuery = query(usersCollectionRef, where('organizationMemberships', 'array-contains', currentUser.defaultOrganizationId));
    } else {
        // If no default org, maybe fetch users who are not in any org? Or just return empty.
        // For now, let's assume chat is only within an org context.
        return [];
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
                    provider: data.provider, // Assuming provider is stored
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

  const getOrganizationMembers = async (organizationId: string): Promise<AppUser[]> => {
    if (!organizationId) return [];
    try {
        const orgDocRef = doc(db, "organizations", organizationId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
            console.warn(`getOrganizationMembers: Organization ${organizationId} not found.`);
            return [];
        }

        const orgData = orgDocSnap.data() as Organization; // Type assertion
        const memberIds = orgData.memberIds || [];

        if (memberIds.length === 0) return [];
        
        // Firestore 'in' query limit is 30. If more, batching is needed.
        // For simplicity, assuming memberIds.length <= 30.
        // If it can be larger, you'll need to implement batching for getDocs.
        const userDocsQuery = query(collection(db, "users"), where("__name__", "in", memberIds.slice(0,30)));
        const memberDocsSnap = await getDocs(userDocsQuery);

        const members: AppUser[] = memberDocsSnap.docs
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    email: data.email,
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    provider: data.provider,
                } as AppUser; // Type assertion, ensure your user docs have these fields
            });
        return members;

    } catch (error) {
        console.error("Error fetching organization members:", error);
        toast({ title: "Error", description: "Could not load organization members.", variant: "destructive" });
        return [];
    }
  };

  const getTeamMembers = async (teamId: string): Promise<AppUser[]> => {
    if (!teamId) return [];
    try {
        const teamDocRef = doc(db, "teams", teamId);
        const teamDocSnap = await getDoc(teamDocRef);

        if (!teamDocSnap.exists()) {
            console.warn(`getTeamMembers: Team ${teamId} not found.`);
            return [];
        }
        const teamData = teamDocSnap.data() as Team; // Type assertion
        const memberIds = teamData.memberIds || [];

        if (memberIds.length === 0) return [];

        const userDocsQuery = query(collection(db, "users"), where("__name__", "in", memberIds.slice(0,30)));
        const memberDocsSnap = await getDocs(userDocsQuery);


        const members: AppUser[] = memberDocsSnap.docs
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    email: data.email,
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    provider: data.provider,
                } as AppUser; 
            });
        return members;

    } catch (error) {
        console.error("Error fetching team members:", error);
        toast({ title: "Error", description: "Could not load team members.", variant: "destructive" });
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
    getOrganizationMembers,
    getTeamMembers,
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

