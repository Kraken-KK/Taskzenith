
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings, type InteractionStyle } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Laptop, Zap, MessageCircle, LogOut, UserCircle, Database, Chrome } from 'lucide-react'; // Added Chrome
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; 
import { cn } from '@/lib/utils';

const interactionStyleOptions: { value: InteractionStyle; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Casual and approachable.' },
  { value: 'formal', label: 'Formal', description: 'Professional and direct.' },
  { value: 'concise', label: 'Concise', description: 'Short and to the point.' },
  { value: 'detailed', label: 'Detailed', description: 'Provides thorough explanations.' },
];

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { isBetaModeEnabled, setIsBetaModeEnabled, interactionStyle, setInteractionStyle } = useSettings();
  const { currentUser, logout, loading: authLoading, currentProvider } = useAuth(); 

  const getUserInitial = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.charAt(0).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.charAt(0).toUpperCase();
    }
    return <UserCircle className="h-5 w-5"/>;
  }
  
  const getProviderIcon = () => {
    if (currentProvider === 'firebase') {
      return <Database className="h-4 w-4 text-orange-500" title="Firebase" />;
    }
    if (currentProvider === 'supabase') {
      return <Zap className="h-4 w-4 text-green-500" title="Supabase" />;
    }
    if (currentProvider === 'google') {
      return <Chrome className="h-4 w-4 text-blue-500" title="Google" />;
    }
    return null;
  }


  return (
    <Card className="max-w-2xl mx-auto shadow-xl interactive-card-hover">
      <CardHeader>
        <CardTitle>Application Settings</CardTitle>
        <CardDescription>Manage your preferences and application settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentUser && (
          <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            <Label className="text-base font-medium flex items-center gap-2 mb-3">
                <UserCircle className="h-5 w-5 text-primary" /> Account Information
            </Label>
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                 {currentUser.photoURL ? <AvatarImage src={currentUser.photoURL} alt={currentUser.displayName || "User"} /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">{getUserInitial()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {currentUser.displayName || 'User'}
                  {getProviderIcon()}
                </p>
                <p className="text-xs text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
            <Button 
                variant="outline" 
                onClick={logout} 
                disabled={authLoading} 
                className="w-full mt-4"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {authLoading ? 'Logging out...' : 'Log Out'}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="theme-select" className="text-base font-medium">
              Theme
            </Label>
            <p className="text-sm text-muted-foreground">
              Select the application theme.
            </p>
          </div>
          <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
            <SelectTrigger id="theme-select" className="w-[180px] transition-all duration-150 ease-in-out hover:border-primary focus:shadow-outline-primary">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent className="transition-opacity duration-150 ease-in-out">
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4" />
                  System
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="interaction-style-select" className="text-base font-medium flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> AI Interaction Style
            </Label>
            <p className="text-sm text-muted-foreground">
              Choose how Jack, the AI Assistant, communicates with you.
            </p>
          </div>
          <Select value={interactionStyle} onValueChange={(value) => setInteractionStyle(value as InteractionStyle)}>
            <SelectTrigger id="interaction-style-select" className="w-[180px] transition-all duration-150 ease-in-out hover:border-primary focus:shadow-outline-primary">
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent className="transition-opacity duration-150 ease-in-out">
              {interactionStyleOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="beta-mode-switch" className="text-base font-medium flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" /> Beta Features
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable experimental features. May be unstable.
            </p>
          </div>
          <Switch
            id="beta-mode-switch"
            checked={isBetaModeEnabled}
            onCheckedChange={setIsBetaModeEnabled}
            aria-label="Toggle beta features"
          />
        </div>
      </CardContent>
      <CardFooter>
         <div className="w-full p-4 border-t rounded-b-lg text-center">
            <h3 className="text-base font-medium mb-1">About TaskZenith</h3>
            <p className="text-xs text-muted-foreground">
                Version 1.0.0 | AI-Powered Productivity
            </p>
        </div>
      </CardFooter>
    </Card>
  );
}
