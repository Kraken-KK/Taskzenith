// src/components/auth/AuthForm.tsx
'use client';

import React, { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LogIn, UserPlus, Database, Zap, User, Chrome } from 'lucide-react'; // Added Chrome as Google icon
import Link from 'next/link';
import { useAuth, type AuthProviderType } from '@/contexts/AuthContext';

const authSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type AuthFormValues = z.infer<typeof authSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (data: AuthFormValues, provider: AuthProviderType) => Promise<void>;
  loading: boolean;
}

export function AuthForm({ mode, onSubmit, loading }: AuthFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<AuthProviderType>('firebase');
  const { enterGuestMode, signInWithGoogleFirebase } = useAuth(); // Added signInWithGoogleFirebase
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  });

  const isLoginMode = mode === 'login';

  const internalOnSubmit: SubmitHandler<AuthFormValues> = async (data) => {
    await onSubmit(data, selectedProvider);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogleFirebase();
    // Navigation is handled within signInWithGoogleFirebase on success
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/20 dark:bg-neutral-900/50 p-4 animate-fadeIn">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
           <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
             {isLoginMode ? <LogIn className="h-10 w-10 text-primary" /> : <UserPlus className="h-10 w-10 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {isLoginMode ? 'Welcome Back!' : 'Create Your Account'}
          </CardTitle>
          <CardDescription>
            {isLoginMode ? 'Log in to access your TaskZenith dashboard.' : 'Sign up to start managing your tasks with AI.'}
            {' Or, use an alternative sign-in method or continue as a guest to explore.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Sign-In Button */}
          {isLoginMode && ( // Show Google Sign-In for login mode, can be shown for signup too if desired
            <Button variant="outline" className="w-full text-lg py-6" onClick={handleGoogleSignIn} disabled={loading}>
              <Chrome className="mr-2 h-5 w-5" /> Sign in with Google
            </Button>
          )}
          {!isLoginMode && ( // Show Google Sign-up for signup mode
             <Button variant="outline" className="w-full text-lg py-6" onClick={handleGoogleSignIn} disabled={loading}>
              <Chrome className="mr-2 h-5 w-5" /> Sign up with Google
            </Button>
          )}
          
          {/* Separator */}
           <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                 Or {isLoginMode ? 'log in' : 'sign up'} with Email
                </span>
            </div>
          </div>

          <Tabs value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as AuthProviderType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="firebase" className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-500" /> Firebase
              </TabsTrigger>
              <TabsTrigger value="supabase" className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" /> Supabase
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="firebase" className="mt-0"> 
               <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6 pt-6">
                 <div className="space-y-2">
                   <Label htmlFor="email-firebase">Email Address</Label>
                   <Input
                    id="email-firebase"
                    type="email"
                    placeholder="you@example.com"
                    {...register('email')}
                    className={errors.email ? 'border-destructive' : ''}
                    disabled={loading}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-firebase">Password</Label>
                  <Input
                    id="password-firebase"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    className={errors.password ? 'border-destructive' : ''}
                    disabled={loading}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : isLoginMode ? (
                    <LogIn className="mr-2 h-5 w-5" />
                  ) : (
                    <UserPlus className="mr-2 h-5 w-5" />
                  )}
                  {isLoginMode ? 'Log In' : 'Sign Up'} with Firebase
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="supabase" className="mt-0">
              <form onSubmit={handleSubmit(internalOnSubmit)} className="space-y-6 pt-6">
                 <div className="space-y-2">
                   <Label htmlFor="email-supabase">Email Address</Label>
                   <Input
                    id="email-supabase"
                    type="email"
                    placeholder="you@example.com"
                    {...register('email')} 
                    className={errors.email ? 'border-destructive' : ''}
                    disabled={loading}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-supabase">Password</Label>
                  <Input
                    id="password-supabase"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    className={errors.password ? 'border-destructive' : ''}
                    disabled={loading}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full text-lg py-6" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : isLoginMode ? (
                    <LogIn className="mr-2 h-5 w-5" />
                  ) : (
                    <UserPlus className="mr-2 h-5 w-5" />
                  )}
                  {isLoginMode ? 'Log In' : 'Sign Up'} with Supabase
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                Or
                </span>
            </div>
          </div>
          <Button variant="outline" className="w-full text-lg py-6" onClick={enterGuestMode} disabled={loading}>
            <User className="mr-2 h-5 w-5" /> Continue as Guest
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {isLoginMode ? "Don't have an account?" : 'Already have an account?'}
            <Link href={isLoginMode ? '/signup' : '/login'} className="font-medium text-primary hover:underline ml-1">
              {isLoginMode ? 'Sign Up' : 'Log In'}
            </Link>
          </p>
           <Link href="/" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Back to TaskZenith (Home)
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
