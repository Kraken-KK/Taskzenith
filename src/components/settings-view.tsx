
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
import { Moon, Sun, Laptop, Zap, MessageCircle, LogOut, UserCircle, Database, Chrome, Building, Users, PlusCircle, Briefcase, ClipboardCopy, Check } from 'lucide-react'; 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; 
import { cn } from '@/lib/utils';
import type { Organization, Team } from '@/types'; 
import { CreateOrganizationDialog } from './create-organization-dialog'; 
import { CreateTeamDialog } from './create-team-dialog'; 
import { JoinOrganizationDialog } from './join-organization-dialog'; // Import JoinOrganizationDialog
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
    getUserOrganizations, getUserTeams, createOrganization, createTeam, setCurrentOrganization 
  } = useAuth(); 
  const { toast } = useToast();

  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isJoinOrgDialogOpen, setIsJoinOrgDialogOpen] = useState(false); // State for join dialog
  const [selectedOrgForTeamCreation, setSelectedOrgForTeamCreation] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchUserOrgsAndTeams = async () => {
    if (currentUser && !isGuest) {
      const orgs = await getUserOrganizations();
      setUserOrganizations(orgs);
      if (currentUser.defaultOrganizationId) {
        const teams = await getUserTeams(currentUser.defaultOrganizationId);
        setUserTeams(teams);
      } else if (orgs.length > 0) {
        const teams = await getUserTeams(orgs[0].id); 
        setUserTeams(teams);
      } else {
        setUserTeams([]);
      }
    }
  };

  useEffect(() => {
    if (currentUser && !isGuest) {
      fetchUserOrgsAndTeams();
    }
  }, [currentUser, isGuest, currentUser?.defaultOrganizationId]); // Re-fetch if defaultOrganizationId changes

  const handleSetCurrentOrg = async (orgId: string | null) => {
    await setCurrentOrganization(orgId);
    // fetchUserOrgsAndTeams will be triggered by useEffect due to currentUser.defaultOrganizationId change
  };

  const handleOpenCreateTeamDialog = (orgId: string) => {
    setSelectedOrgForTeamCreation(orgId);
    setIsCreateTeamDialogOpen(true);
  };
  
  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast({ title: "Copied!", description: "Invite code copied to clipboard." });
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(err => {
      console.error('Failed to copy invite code: ', err);
      toast({ title: "Copy Failed", description: "Could not copy invite code.", variant: "destructive" });
    });
  };


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
    <ScrollArea className="h-[calc(100vh-8rem)]"> 
    <div className="max-w-2xl mx-auto space-y-8 p-1">
      <Card className="shadow-xl interactive-card-hover">
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
      
      {currentUser && !isGuest && (
        <Card className="shadow-xl interactive-card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/> My Organizations</CardTitle>
            <CardDescription>Manage your organizations, create a new one, or join using an invite code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userOrganizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are not part of any organization yet.</p>
            ) : (
              <ul className="space-y-3">
                {userOrganizations.map(org => (
                  <li key={org.id} className="p-3 border rounded-md shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">{org.name} {org.id === currentUser.defaultOrganizationId && <span className="text-xs text-primary ml-1">(Active)</span>}</span>
                        <Button variant={org.id === currentUser.defaultOrganizationId ? "secondary" : "outline" } size="sm" onClick={() => handleSetCurrentOrg(org.id)} disabled={org.id === currentUser.defaultOrganizationId}>
                        {org.id === currentUser.defaultOrganizationId ? "Active Org" : "Set Active"}
                        </Button>
                    </div>
                    {org.ownerId === currentUser.id && org.inviteCode && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2 mt-2">
                            <span>Invite Code: <strong className="text-foreground tracking-wider">{org.inviteCode}</strong></span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyInviteCode(org.inviteCode)}>
                                {copiedCode === org.inviteCode ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                 <Button onClick={() => setIsCreateOrgDialogOpen(true)} className="flex-1">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Organization
                  </Button>
                  <Button onClick={() => setIsJoinOrgDialogOpen(true)} variant="outline" className="flex-1">
                     <LogIn className="mr-2 h-4 w-4" /> Join Organization
                  </Button>
            </div>
              {currentUser.defaultOrganizationId && (
                 <Button variant="outline" onClick={() => handleSetCurrentOrg(null)} className="w-full mt-2">
                    Clear Default Organization
                 </Button>
              )}
          </CardContent>
        </Card>
      )}

      {currentUser && !isGuest && currentUser.defaultOrganizationId && (
        <Card className="shadow-xl interactive-card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Teams in {userOrganizations.find(o=>o.id === currentUser.defaultOrganizationId)?.name || 'Default Org'}</CardTitle>
            <CardDescription>Manage teams within your active organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams in this organization yet.</p>
            ) : (
              <ul className="space-y-2">
                {userTeams.map(team => (
                  <li key={team.id} className="flex justify-between items-center p-3 border rounded-md shadow-sm">
                    <span>{team.name}</span>
                    <Button variant="outline" size="sm" onClick={() => alert(`Manage team ${team.name} - Not implemented`)}>Manage</Button>
                  </li>
                ))}
              </ul>
            )}
            <Button 
                onClick={() => currentUser.defaultOrganizationId && handleOpenCreateTeamDialog(currentUser.defaultOrganizationId)} 
                className="w-full mt-2"
                disabled={!currentUser.defaultOrganizationId}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Team
            </Button>
          </CardContent>
        </Card>
      )}
      
      <CreateOrganizationDialog 
        open={isCreateOrgDialogOpen} 
        onOpenChange={(isOpen) => {
            setIsCreateOrgDialogOpen(isOpen);
            if(!isOpen) fetchUserOrgsAndTeams(); 
        }} 
      />
      <CreateTeamDialog 
        open={isCreateTeamDialogOpen} 
        onOpenChange={(isOpen) => {
            setIsCreateTeamDialogOpen(isOpen);
            if(!isOpen) fetchUserOrgsAndTeams(); 
        }} 
        organizationId={selectedOrgForTeamCreation} 
      />
       <JoinOrganizationDialog
        open={isJoinOrgDialogOpen}
        onOpenChange={(isOpen) => {
          setIsJoinOrgDialogOpen(isOpen);
        }}
        onOrgJoined={fetchUserOrgsAndTeams} // Refresh org list after successfully joining
      />
    </div>
    </ScrollArea>
  );
}

