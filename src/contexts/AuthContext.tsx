// src/contexts/AuthContext.tsx
'use client';

import type { User, AuthError } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string) => Promise<User | null>;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup subscription on unmount
  }, []);

  const signup = async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
       // Set a default display name if needed, e.g., from email prefix
      const displayName = email.split('@')[0];
      await updateProfile(userCredential.user, { displayName });
      
      toast({ title: 'Signup Successful', description: 'Welcome aboard!' });
      setCurrentUser(userCredential.user); // Update state immediately
      return userCredential.user;
    } catch (error) {
      const authError = error as AuthError;
      toast({ title: 'Signup Failed', description: authError.message, variant: 'destructive' });
      console.error('Signup error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      setCurrentUser(userCredential.user); // Update state immediately
      return userCredential.user;
    } catch (error) {
      const authError = error as AuthError;
      toast({ title: 'Login Failed', description: authError.message, variant: 'destructive' });
      console.error('Login error:', authError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      setCurrentUser(null); // Clear user state
      router.push('/login'); // Redirect to login after logout
    } catch (error) {
      const authError = error as AuthError;
      toast({ title: 'Logout Failed', description: authError.message, variant: 'destructive' });
      console.error('Logout error:', authError);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    loading,
    signup,
    login,
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
