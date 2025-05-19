
// src/components/organization-management-view.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Organization, Team } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, PlusCircle, LogIn, ClipboardCopy, Check, Settings2, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
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


export function OrganizationManagementView() {
  const { 
    currentUser, 
    createOrganization, 
    joinOrganizationByInviteCode, 
    createTeam, 
    getUserOrganizations, 
    getUserTeams, 
    setCurrentOrganization,
    joinTeam
  } = useAuth();
  const { toast } = useToast();

  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [teamsInActiveOrg, setTeamsInActiveOrg] = useState<Team[]>([]);
  
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [joinOrgCode, setJoinOrgCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    if (!currentUser) return;
    setIsLoadingOrgs(true);
    const orgs = await getUserOrganizations();
    setUserOrganizations(orgs);
    const currentActiveOrg = orgs.find(o => o.id === currentUser.defaultOrganizationId);
    setActiveOrganization(currentActiveOrg || null);
    setIsLoadingOrgs(false);
  };

  useEffect(() => {
    fetchOrganizations();
  }, [currentUser]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (activeOrganization && currentUser) {
        setIsLoadingTeams(true);
        const teams = await getUserTeams(activeOrganization.id);
        setTeamsInActiveOrg(teams);
        setIsLoadingTeams(false);
      } else {
        setTeamsInActiveOrg([]);
      }
    };
    fetchTeams();
  }, [activeOrganization, currentUser]);


  const handleSetCurrentOrg = async (orgId: string) => {
    await setCurrentOrganization(orgId);
    const selected = userOrganizations.find(o => o.id === orgId);
    setActiveOrganization(selected || null);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toast({ title: "Error", description: "Organization name is required.", variant: "destructive"});
      return;
    }
    setIsCreatingOrg(true);
    const org = await createOrganization(newOrgName, newOrgDesc);
    if (org) {
      toast({ title: "Success", description: `Organization "${org.name}" created.`});
      setNewOrgName('');
      setNewOrgDesc('');
      await fetchOrganizations(); // Refresh list
      setActiveOrganization(org); // Set new org as active
    }
    setIsCreatingOrg(false);
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinOrgCode.trim() || joinOrgCode.trim().length !== 5) {
      toast({ title: "Error", description: "A valid 5-character invite code is required.", variant: "destructive"});
      return;
    }
    setIsJoiningOrg(true);
    const org = await joinOrganizationByInviteCode(joinOrgCode.toUpperCase());
    if (org) {
      toast({ title: "Success", description: `Joined organization "${org.name}".`});
      setJoinOrgCode('');
      await fetchOrganizations(); // Refresh list
      setActiveOrganization(org);
    }
    setIsJoiningOrg(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) {
      toast({ title: "Error", description: "Please select an active organization first.", variant: "destructive"});
      return;
    }
    if (!newTeamName.trim()) {
      toast({ title: "Error", description: "Team name is required.", variant: "destructive"});
      return;
    }
    setIsCreatingTeam(true);
    const team = await createTeam(newTeamName, activeOrganization.id, newTeamDesc);
    if (team) {
      toast({ title: "Success", description: `Team "${team.name}" created in ${activeOrganization.name}.`});
      setNewTeamName('');
      setNewTeamDesc('');
      // Refresh teams for active org
      const teams = await getUserTeams(activeOrganization.id);
      setTeamsInActiveOrg(teams);
    }
    setIsCreatingTeam(false);
  };

  const handleJoinTeamAttempt = async (teamId: string, teamName: string) => {
    if (!currentUser || !activeOrganization) return;
    const success = await joinTeam(teamId);
    if (success) {
      toast({ title: "Joined Team", description: `You have successfully joined "${teamName}".`});
      const teams = await getUserTeams(activeOrganization.id); // Refresh teams
      setTeamsInActiveOrg(teams);
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

  if (!currentUser || currentUser.isGuest) {
    return (
        <Card className="max-w-2xl mx-auto mt-10 shadow-lg">
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Organization management is not available for guest users. Please log in or sign up.</p>
                 <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
            </CardContent>
        </Card>
    );
  }


  return (
    <div className="space-y-6 p-1 md:p-4 animate-fadeInUp">
      <Tabs defaultValue="my-organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 mb-4">
          <TabsTrigger value="my-organizations">My Organizations</TabsTrigger>
          <TabsTrigger value="teams" disabled={!activeOrganization}>Teams {activeOrganization ? `in ${activeOrganization.name.substring(0,10)}...` : ''}</TabsTrigger>
          <TabsTrigger value="manage-orgs">Manage Orgs</TabsTrigger>
        </TabsList>

        <TabsContent value="my-organizations">
          <Card>
            <CardHeader>
              <CardTitle>Your Organizations</CardTitle>
              <CardDescription>Select an organization to view its details and teams, or manage your memberships.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrgs && <p>Loading organizations...</p>}
              {!isLoadingOrgs && userOrganizations.length === 0 && (
                <p className="text-muted-foreground">You are not part of any organizations yet. Create one or join using an invite code from the &quot;Manage Orgs&quot; tab.</p>
              )}
              <ScrollArea className="h-[calc(100vh-25rem)]">
                <ul className="space-y-3 pr-3">
                  {userOrganizations.map(org => (
                    <li key={org.id} className="p-3.5 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <span className="font-semibold text-lg">{org.name}</span>
                        <Button 
                          variant={activeOrganization?.id === org.id ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => handleSetCurrentOrg(org.id)}
                          className="w-full sm:w-auto"
                        >
                          {activeOrganization?.id === org.id ? <Check className="mr-2 h-4 w-4"/> : null}
                          {activeOrganization?.id === org.id ? 'Active Organization' : 'Set Active'}
                        </Button>
                      </div>
                      {org.description && <p className="text-sm text-muted-foreground mt-1">{org.description}</p>}
                      {currentUser && org.ownerId === currentUser.id && org.inviteCode && (
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
        </TabsContent>
        
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Teams in {activeOrganization ? `"${activeOrganization.name}"` : "Selected Organization"}</CardTitle>
              <CardDescription>View and manage teams within your active organization. You can create new teams here.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activeOrganization && <p className="text-muted-foreground">Please select an active organization from the &quot;My Organizations&quot; tab first.</p>}
              {activeOrganization && (
                <>
                  {isLoadingTeams && <p>Loading teams...</p>}
                  {!isLoadingTeams && teamsInActiveOrg.length === 0 && (
                    <p className="text-muted-foreground">No teams found in this organization yet. Why not create the first one?</p>
                  )}
                  <ScrollArea className="h-[calc(100vh-30rem)]">
                    <ul className="space-y-3 pr-3 mb-4">
                      {teamsInActiveOrg.map(team => {
                        const isMember = team.memberIds.includes(currentUser!.id);
                        return (
                          <li key={team.id} className="p-3.5 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                              <span className="font-semibold text-lg">{team.name}</span>
                              {isMember ? (
                                <Badge variant="secondary" className="text-xs self-start sm:self-center"><Check className="mr-1 h-3 w-3" /> Member</Badge>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => handleJoinTeamAttempt(team.id, team.name)} className="w-full sm:w-auto">
                                  <UserPlus className="mr-1 h-3 w-3" /> Join Team
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
                  <Separator className="my-6" />
                  <h3 className="text-xl font-semibold mb-3">Create New Team in {activeOrganization.name}</h3>
                   <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <Label htmlFor="new-team-name">Team Name</Label>
                      <Input id="new-team-name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g., Engineering Team" disabled={isCreatingTeam} />
                    </div>
                    <div>
                      <Label htmlFor="new-team-desc">Team Description (Optional)</Label>
                      <Textarea id="new-team-desc" value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} placeholder="Purpose of this team" disabled={isCreatingTeam} />
                    </div>
                    <Button type="submit" disabled={isCreatingTeam || !newTeamName.trim()}>
                      {isCreatingTeam ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                      Create Team
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-orgs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary"/>Create Organization</CardTitle>
                        <CardDescription>Start a new organization for your projects and teams.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateOrg} className="space-y-4">
                            <div>
                                <Label htmlFor="new-org-name">Organization Name</Label>
                                <Input id="new-org-name" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="e.g., My Startup" disabled={isCreatingOrg} />
                            </div>
                            <div>
                                <Label htmlFor="new-org-desc">Description (Optional)</Label>
                                <Textarea id="new-org-desc" value={newOrgDesc} onChange={e => setNewOrgDesc(e.target.value)} placeholder="A brief overview" disabled={isCreatingOrg} />
                            </div>
                            <Button type="submit" className="w-full" disabled={isCreatingOrg || !newOrgName.trim()}>
                                {isCreatingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>} Create Organization
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-primary"/>Join Organization</CardTitle>
                        <CardDescription>Use an invite code to become a member of an existing organization.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleJoinOrg} className="space-y-4">
                            <div>
                                <Label htmlFor="join-org-code">Invite Code</Label>
                                <Input 
                                    id="join-org-code" 
                                    value={joinOrgCode} 
                                    onChange={e => setJoinOrgCode(e.target.value.toUpperCase())} 
                                    placeholder="ABC12" 
                                    maxLength={5} 
                                    className="uppercase tracking-wider"
                                    disabled={isJoiningOrg} 
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isJoiningOrg || joinOrgCode.trim().length !== 5}>
                                {isJoiningOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogIn className="mr-2 h-4 w-4"/>} Join Organization
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
