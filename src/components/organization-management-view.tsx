
// src/components/organization-management-view.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Organization, Team } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, PlusCircle, LogIn, ClipboardCopy, Check, Settings2, Edit, Trash2, Loader2, UserPlus, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

export function OrganizationManagementView() {
  const { 
    currentUser, 
    getUserOrganizations, 
    getUserTeams, 
    setCurrentOrganization,
    createOrganization,
    joinOrganizationByInviteCode,
    createTeam,
    joinTeam
  } = useAuth();
  const { toast } = useToast();

  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [teamsInActiveOrg, setTeamsInActiveOrg] = useState<Team[]>([]);
  
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // State for Create Organization Form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // State for Join Organization Form
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);

  // State for Create Team Form
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const fetchOrganizationsAndSetActive = useCallback(async () => {
    if (!currentUser || currentUser.isGuest) return;
    setIsLoadingOrgs(true);
    try {
      const orgs = await getUserOrganizations();
      setUserOrganizations(orgs);
      const currentActiveOrg = orgs.find(o => o.id === currentUser.defaultOrganizationId);
      setActiveOrganization(currentActiveOrg || (orgs.length > 0 ? orgs[0] : null));
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast({ title: "Error", description: "Could not load your organizations.", variant: "destructive" });
    } finally {
      setIsLoadingOrgs(false);
    }
  }, [currentUser, getUserOrganizations, toast]);

  useEffect(() => {
    fetchOrganizationsAndSetActive();
  }, [fetchOrganizationsAndSetActive]);

  useEffect(() => {
    const fetchTeamsForActiveOrg = async () => {
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
    fetchTeamsForActiveOrg();
  }, [activeOrganization, currentUser, getUserTeams, toast]);


  const handleSetCurrentOrg = async (orgId: string) => {
    if (!currentUser) return;
    setIsLoadingOrgs(true); // Indicate loading while context might be changing
    try {
      await setCurrentOrganization(orgId);
      const selectedOrg = userOrganizations.find(o => o.id === orgId);
      setActiveOrganization(selectedOrg || null);
      toast({ title: "Active Organization Set", description: `${selectedOrg?.name || 'Organization'} is now active.` });
    } catch (error) {
        toast({ title: "Error", description: "Failed to set active organization.", variant: "destructive" });
    } finally {
        setIsLoadingOrgs(false);
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
    setIsLoadingTeams(true);
    const success = await joinTeam(teamId);
    if (success) {
      toast({ title: "Joined Team", description: `You have successfully joined "${teamName}".`});
      const teams = await getUserTeams(activeOrganization.id); // Re-fetch teams for current org
      setTeamsInActiveOrg(teams);
    }
    setIsLoadingTeams(false);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toast({ title: "Validation Error", description: "Organization name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsCreatingOrg(true);
    const createdOrg = await createOrganization(newOrgName.trim(), newOrgDescription.trim());
    if (createdOrg) {
      setNewOrgName('');
      setNewOrgDescription('');
      await fetchOrganizationsAndSetActive(); // Refresh org list and set active
    }
    setIsCreatingOrg(false);
  };

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim()) {
      toast({ title: "Validation Error", description: "Invite code cannot be empty.", variant: "destructive" });
      return;
    }
    setIsJoiningOrg(true);
    const joinedOrg = await joinOrganizationByInviteCode(joinInviteCode.trim().toUpperCase());
    if (joinedOrg) {
      setJoinInviteCode('');
      await fetchOrganizationsAndSetActive(); // Refresh org list and set active
    }
    setIsJoiningOrg(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) {
        toast({ title: "Error", description: "No active organization selected to add this team to.", variant: "destructive" });
        return;
    }
    if (!newTeamName.trim()) {
      toast({ title: "Validation Error", description: "Team name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsCreatingTeam(true);
    const createdTeam = await createTeam(newTeamName.trim(), activeOrganization.id, newTeamDescription.trim());
    if (createdTeam) {
      setNewTeamName('');
      setNewTeamDescription('');
      const teams = await getUserTeams(activeOrganization.id); // Re-fetch teams for current org
      setTeamsInActiveOrg(teams);
    }
    setIsCreatingTeam(false);
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
          <TabsTrigger value="manage-orgs">Create / Join</TabsTrigger>
        </TabsList>

        <TabsContent value="my-organizations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Organizations</CardTitle>
              <CardDescription>Select an organization to view its teams or set it as your active context for board creation and other org-specific actions.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrgs && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading organizations...</p>
                </div>
              )}
              {!isLoadingOrgs && userOrganizations.length === 0 && (
                <p className="text-muted-foreground py-10 text-center">You are not part of any organizations yet. Use the 'Create / Join' tab.</p>
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
                          disabled={isLoadingOrgs}
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
                <CardDescription>View teams within your active organization or create a new one.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTeams && (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading teams...</p>
                  </div>
                )}
                {!isLoadingTeams && teamsInActiveOrg.length === 0 && (
                  <p className="text-muted-foreground py-6 text-center">No teams found in this organization yet.</p>
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
                              <Button variant="outline" size="sm" onClick={() => handleJoinTeamAttempt(team.id, team.name)} className="w-full sm:w-auto" disabled={isLoadingTeams}>
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
                <Separator className="my-4" />
                <form onSubmit={handleCreateTeam} className="space-y-3">
                    <h4 className="text-md font-semibold">Create New Team in &quot;{activeOrganization.name}&quot;</h4>
                    <div>
                        <Label htmlFor="new-team-name">Team Name</Label>
                        <Input 
                            id="new-team-name" 
                            value={newTeamName} 
                            onChange={(e) => setNewTeamName(e.target.value)} 
                            placeholder="e.g., Engineering Avengers" 
                            disabled={isCreatingTeam}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="new-team-description">Team Description (Optional)</Label>
                        <Textarea 
                            id="new-team-description" 
                            value={newTeamDescription} 
                            onChange={(e) => setNewTeamDescription(e.target.value)} 
                            placeholder="What this team will conquer" 
                            disabled={isCreatingTeam}
                            className="mt-1"
                        />
                    </div>
                    <Button type="submit" disabled={isCreatingTeam || !newTeamName.trim()} className="w-full sm:w-auto">
                        {isCreatingTeam ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Create Team
                    </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="manage-orgs" className="space-y-6">
           <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5"/>Create New Organization</CardTitle>
                <CardDescription>Set up a new workspace for your projects and teams.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleCreateOrganization} className="space-y-4">
                    <div>
                        <Label htmlFor="new-org-name">Organization Name</Label>
                        <Input 
                            id="new-org-name" 
                            value={newOrgName} 
                            onChange={(e) => setNewOrgName(e.target.value)} 
                            placeholder="e.g., Innovatech Solutions" 
                            disabled={isCreatingOrg}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="new-org-description">Description (Optional)</Label>
                        <Textarea 
                            id="new-org-description" 
                            value={newOrgDescription} 
                            onChange={(e) => setNewOrgDescription(e.target.value)} 
                            placeholder="Briefly describe your organization's purpose" 
                            disabled={isCreatingOrg}
                            className="mt-1"
                        />
                    </div>
                    <Button type="submit" disabled={isCreatingOrg || !newOrgName.trim()} className="w-full sm:w-auto">
                        {isCreatingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Create Organization
                    </Button>
                </form>
            </CardContent>
           </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5"/>Join Existing Organization</CardTitle>
                    <CardDescription>Enter an invite code to become a member of an organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleJoinOrganization} className="space-y-4">
                        <div>
                            <Label htmlFor="join-invite-code">Invite Code</Label>
                            <Input 
                                id="join-invite-code" 
                                value={joinInviteCode} 
                                onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())} 
                                placeholder="ABC12" 
                                maxLength={5}
                                disabled={isJoiningOrg}
                                className="mt-1 uppercase tracking-widest"
                            />
                        </div>
                        <Button type="submit" disabled={isJoiningOrg || joinInviteCode.trim().length !== 5} className="w-full sm:w-auto">
                            {isJoiningOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogIn className="mr-2 h-4 w-4"/>}
                            Join Organization
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
