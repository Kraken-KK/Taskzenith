
// src/components/organization-management-view.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Organization, Team } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Will be used for forms later
import { Label } from '@/components/ui/label'; // Will be used for forms later
import { Textarea } from '@/components/ui/textarea'; // Will be used for forms later
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, PlusCircle, LogIn, ClipboardCopy, Check, Settings2, Edit, Trash2, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from './ui/button';
import { cn } from '@/lib/utils';


export function OrganizationManagementView() {
  const { 
    currentUser, 
    getUserOrganizations, 
    getUserTeams, 
    setCurrentOrganization, // Renamed from setDefaultOrganization to setActiveOrganization if needed
    joinTeam
  } = useAuth();
  const { toast } = useToast();

  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [teamsInActiveOrg, setTeamsInActiveOrg] = useState<Team[]>([]);
  
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    if (!currentUser || currentUser.isGuest) return;
    setIsLoadingOrgs(true);
    try {
      const orgs = await getUserOrganizations();
      setUserOrganizations(orgs);
      const currentActiveOrg = orgs.find(o => o.id === currentUser.defaultOrganizationId);
      setActiveOrganization(currentActiveOrg || (orgs.length > 0 ? orgs[0] : null)); // Default to first org if no default set
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast({ title: "Error", description: "Could not load your organizations.", variant: "destructive" });
    } finally {
      setIsLoadingOrgs(false);
    }
  }, [currentUser, getUserOrganizations, toast]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (activeOrganization && currentUser && !currentUser.isGuest) {
        setIsLoadingTeams(true);
        try {
          const teams = await getUserTeams(activeOrganization.id);
          setTeamsInActiveOrg(teams);
        } catch (error) {
          console.error("Error fetching teams:", error);
          toast({ title: "Error", description: `Could not load teams for ${activeOrganization.name}.`, variant: "destructive" });
        } finally {
          setIsLoadingTeams(false);
        }
      } else {
        setTeamsInActiveOrg([]);
      }
    };
    fetchTeams();
  }, [activeOrganization, currentUser, getUserTeams, toast]);


  const handleSetCurrentOrg = async (orgId: string) => {
    if (!currentUser) return;
    try {
      await setCurrentOrganization(orgId); // This updates defaultOrganizationId in AuthContext's currentUser
      const selectedOrg = userOrganizations.find(o => o.id === orgId);
      setActiveOrganization(selectedOrg || null); // Update local activeOrganization state
      toast({ title: "Active Organization Set", description: `${selectedOrg?.name || 'Organization'} is now active.` });
    } catch (error) {
        toast({ title: "Error", description: "Failed to set active organization.", variant: "destructive" });
    }
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

  const handleJoinTeamAttempt = async (teamId: string, teamName: string) => {
    if (!currentUser || !activeOrganization) return;
    const success = await joinTeam(teamId);
    if (success) {
      toast({ title: "Joined Team", description: `You have successfully joined "${teamName}".`});
      // Refresh teams for active org
      setIsLoadingTeams(true);
      const teams = await getUserTeams(activeOrganization.id);
      setTeamsInActiveOrg(teams);
      setIsLoadingTeams(false);
    }
  };

  if (!currentUser || currentUser.isGuest) {
    return (
        <Card className="max-w-2xl mx-auto mt-10 shadow-lg animate-fadeInUp">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="h-6 w-6 text-primary" />Organization Management</CardTitle>
                <CardDescription>Please log in to manage your organizations and teams.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>This feature is available for registered users.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6 p-1 md:p-4 animate-fadeInUp">
      <Tabs defaultValue="my-organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-4">
          <TabsTrigger value="my-organizations">My Organizations & Teams</TabsTrigger>
          <TabsTrigger value="manage-orgs">Create/Join Organization</TabsTrigger>
        </TabsList>

        <TabsContent value="my-organizations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Organizations</CardTitle>
              <CardDescription>Select an organization to view its teams or set it as your active context.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrgs && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading organizations...</p>
                </div>
              )}
              {!isLoadingOrgs && userOrganizations.length === 0 && (
                <p className="text-muted-foreground py-10 text-center">You are not part of any organizations yet. Create one or join using an invite code from the "Create/Join Organization" tab.</p>
              )}
              <ScrollArea className={cn(userOrganizations.length > 0 ? "max-h-[300px]" : "")}>
                <ul className="space-y-3 pr-3">
                  {userOrganizations.map(org => (
                    <li key={org.id} className="p-3.5 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <span className="font-semibold text-lg">{org.name}</span>
                        <Button 
                          variant={currentUser.defaultOrganizationId === org.id ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => handleSetCurrentOrg(org.id)}
                          className="w-full sm:w-auto"
                        >
                          {currentUser.defaultOrganizationId === org.id ? <Check className="mr-2 h-4 w-4"/> : null}
                          {currentUser.defaultOrganizationId === org.id ? 'Active Context' : 'Set Active'}
                        </Button>
                      </div>
                      {org.description && <p className="text-sm text-muted-foreground mt-1">{org.description}</p>}
                      {org.ownerId === currentUser.id && org.inviteCode && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2 mt-2.5">
                            <span>Invite Code: <strong className="text-foreground tracking-wider">{org.inviteCode}</strong></span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyInviteCode(org.inviteCode)}>
                                {copiedCode === org.inviteCode ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                            </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          {activeOrganization && (
            <Card>
              <CardHeader>
                <CardTitle>Teams in &quot;{activeOrganization.name}&quot;</CardTitle>
                <CardDescription>View teams within your active organization. You can join teams or create new ones (in the "Create/Join Organization" tab for now).</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTeams && (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading teams...</p>
                  </div>
                )}
                {!isLoadingTeams && teamsInActiveOrg.length === 0 && (
                  <p className="text-muted-foreground py-10 text-center">No teams found in this organization yet.</p>
                )}
                <ScrollArea className={cn(teamsInActiveOrg.length > 0 ? "max-h-[300px]" : "")}>
                  <ul className="space-y-3 pr-3">
                    {teamsInActiveOrg.map(team => {
                      const isMember = team.memberIds.includes(currentUser.id);
                      return (
                        <li key={team.id} className="p-3.5 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <span className="font-semibold text-lg">{team.name}</span>
                            {isMember ? (
                              <Badge variant="secondary" className="text-xs self-start sm:self-center px-2 py-1">
                                <Check className="mr-1 h-3 w-3 text-green-600" /> Member
                              </Badge>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => handleJoinTeamAttempt(team.id, team.name)} className="w-full sm:w-auto">
                                <UserPlus className="mr-1.5 h-4 w-4" /> Join Team
                              </Button>
                            )}
                          </div>
                          {team.description && <p className="text-sm text-muted-foreground mt-1">{team.description}</p>}
                           <p className="text-xs text-muted-foreground mt-1">Members: {team.memberIds.length}</p>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="manage-orgs">
           <Card>
            <CardHeader>
                <CardTitle>Manage Organizations</CardTitle>
                <CardDescription>Create a new organization or join an existing one using an invite code.</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Forms for create/join org and create team will be added here in the next step */}
                <p className="text-muted-foreground py-10 text-center">
                    Forms for creating and joining organizations, and creating teams will appear here in the next update.
                </p>
            </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

