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
import { Loader2, LogIn, UserPlus, Database, Zap } from 'lucide-react'; // Added Database and Zap icons
import Link from 'next/link';
import type { AuthProviderType } from '@/contexts/AuthContext';

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

  const renderProviderIcon = (provider: AuthProviderType) => {
    if (provider === 'firebase') {
      return <Database className="h-5 w-5 text-orange-400" />;
    }
    if (provider === 'supabase') {
      return <Zap className="h-5 w-5 text-green-400" />;
    }
    return null;
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
            {!isLoginMode && ' Choose your preferred authentication provider below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as AuthProviderType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="firebase" className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-500" /> Firebase
              </TabsTrigger>
              <TabsTrigger value="supabase" className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" /> Supabase
              </TabsTrigger>
            </TabsList>
            
            {/* Common form content for both providers */}
            <TabsContent value="firebase" className="mt-0"> {/* Remove default top margin for TabsContent */}
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
                    {...register('email')} // Re-registering for this form instance, RHF handles it contextually.
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
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {isLoginMode ? "Don't have an account?" : 'Already have an account?'}
            <Link href={isLoginMode ? '/signup' : '/login'} className="font-medium text-primary hover:underline ml-1">
              {isLoginMode ? 'Sign Up' : 'Log In'}
            </Link>
          </p>
           <Link href="/" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Back to TaskZenith
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
