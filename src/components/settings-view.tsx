
'use client';

import React, { useEffect, useState } from 'react'; 
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
import { Moon, Sun, Laptop, Zap, MessageCircle, LogOut, UserCircle, Database, Chrome, Building, Users, PlusCircle, Briefcase, ClipboardCopy, Check, LogIn } from 'lucide-react'; 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; 
import { cn } from '@/lib/utils';
import type { Organization, Team } from '@/types'; 
// Dialog imports removed as functionality is moved to OrganizationManagementView
// import { CreateOrganizationDialog } from './create-organization-dialog'; 
// import { CreateTeamDialog } from './create-team-dialog'; 
// import { JoinOrganizationDialog } from './join-organization-dialog'; 
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';


const interactionStyleOptions: { value: InteractionStyle; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Casual and approachable.' },
  { value: 'formal', label: 'Formal', description: 'Professional and direct.' },
  { value: 'concise', label: 'Concise', description: 'Short and to the point.' },
  { value: 'detailed', label: 'Detailed', description: 'Provides thorough explanations.' },
];

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { isBetaModeEnabled, setIsBetaModeEnabled, interactionStyle, setInteractionStyle } = useSettings();
  const { 
    currentUser, logout, loading: authLoading, currentProvider, isGuest, 
    // Org/Team management functions will be used by OrganizationManagementView
  } = useAuth(); 
  const { toast } = useToast();


  const getUserInitial = () => {
    if (isGuest) return "G";
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
    <ScrollArea className="h-[calc(100vh-8rem)]"> 
    <div className="max-w-2xl mx-auto space-y-8 p-1 sm:p-4">
      <Card className="shadow-xl interactive-card-hover">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Manage your preferences and application settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(currentUser && !isGuest) && (
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

          {isGuest && (
             <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
              <Label className="text-base font-medium flex items-center gap-2 mb-3">
                  <UserCircle className="h-5 w-5 text-primary" /> Guest Session
              </Label>
              <p className="text-sm text-muted-foreground">You are currently exploring as a guest. Your data is stored locally and will be lost if you clear your browser data or switch browsers.</p>
               <Button 
                  variant="default" 
                  onClick={() => router.push('/login')} // Assuming exitGuestMode in AuthContext handles redirect
                  className="w-full mt-4"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login or Sign Up
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
      
      {/* Organization and Team management sections are removed from here and will be part of OrganizationManagementView */}
      
    </div>
    </ScrollArea>
  );
}

