// src/app/login/page.tsx
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth, type AuthProviderType } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { FC } from 'react';
import { useEffect } from 'react';

const LoginPage: FC = () => {
  const { loginWithFirebase, loginWithSupabase, currentUser, loading: authLoading, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (currentUser || isGuest)) {
      router.push('/'); // Redirect if already logged in or in guest mode
    }
  }, [currentUser, authLoading, isGuest, router]);

  const handleLogin = async (data: { email: string; password: string }, provider: AuthProviderType) => {
    let user = null;
    if (provider === 'firebase') {
      user = await loginWithFirebase(data.email, data.password);
    } else if (provider === 'supabase') {
      user = await loginWithSupabase(data.email, data.password);
    }
    
    if (user) {
      router.push('/');
    }
  };

  if (authLoading || (!authLoading && (currentUser || isGuest))) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return <AuthForm mode="login" onSubmit={handleLogin} loading={authLoading} />;
};

export default LoginPage;
