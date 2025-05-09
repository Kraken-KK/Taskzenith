// src/app/signup/page.tsx
'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { FC } from 'react';
import { useEffect } from 'react';

const SignupPage: FC = () => {
  const { signup, currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && currentUser) {
      router.push('/'); // Redirect if already logged in
    }
  }, [currentUser, authLoading, router]);

  const handleSignup = async (data: { email: string; password: string }) => {
    const user = await signup(data.email, data.password);
    if (user) {
      router.push('/'); // Or to /login to make them log in after signup
    }
  };

  if (authLoading || (!authLoading && currentUser)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return <AuthForm mode="signup" onSubmit={handleSignup} loading={authLoading} />;
};

export default SignupPage;
