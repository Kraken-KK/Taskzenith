
// src/components/organization-management-view.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, type AppUser } from '@/contexts/AuthContext';
import type { Organization, Team } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, PlusCircle, LogIn, ClipboardCopy, Check, Settings2, Edit, Trash2, Loader2, UserPlus, Briefcase, UserCircle, Eye, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export function OrganizationManagementView() {
  const {
    currentUser,
    getUserOrganizations,
    getUserTeams,
    setCurrentOrganization,
    createOrganization,
    joinOrganizationByInviteCode,
    createTeam,
    joinTeam,
    getOrganizationMembers,
    getTeamMembers,
  } = useAuth();
  const { toast } = useToast();

  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [teamsInActiveOrg, setTeamsInActiveOrg] = useState<Team[]>([]);
  
  const [orgMembersMap, setOrgMembersMap] = useState<Record<string, AppUser[]>>({});
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, AppUser[]>>({});

  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingOrgMembers, setIsLoadingOrgMembers] = useState<Record<string, boolean>>({});
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState<Record<string, boolean>>({});

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const fetchOrganizationsAndSetActive = useCallback(async () => {
    if (!currentUser || currentUser.isGuest) return;
    setIsLoadingOrgs(true);
    try {
      const orgs = await getUserOrganizations();
      setUserOrganizations(orgs);
      if (currentUser.defaultOrganizationId) {
        const currentActiveOrg = orgs.find(o => o.id === currentUser.defaultOrganizationId);
        setActiveOrganization(currentActiveOrg || null);
        if (currentActiveOrg) setExpandedOrgId(currentActiveOrg.id); // Auto-expand active org
      } else {
        setActiveOrganization(null);
        setExpandedOrgId(null);
      }
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

  // Fetch teams when activeOrganization changes
  useEffect(() => {
    const fetchTeams = async () => {
      if (activeOrganization && currentUser && !currentUser.isGuest) {
        setIsLoadingTeams(true);
        setTeamsInActiveOrg([]); // Clear previous teams
        setExpandedTeamId(null); // Collapse team accordions
        setTeamMembersMap({}); // Clear team members map
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

  // Fetch org members when an org accordion is expanded
  const handleOrgAccordionChange = async (orgId: string | undefined) => {
    setExpandedOrgId(orgId || null);
    if (orgId) {
      const orgToSetActive = userOrganizations.find(o => o.id === orgId);
      setActiveOrganization(orgToSetActive || null); // Also set as active for context
      if (!orgMembersMap[orgId] && orgToSetActive) { // Fetch only if not already fetched
        setIsLoadingOrgMembers(prev => ({ ...prev, [orgId]: true }));
        try {
          const members = await getOrganizationMembers(orgId);
          setOrgMembersMap(prev => ({ ...prev, [orgId]: members }));
        } catch (error) {
          console.error("Error fetching organization members:", error);
          toast({ title: "Error", description: `Could not load members for ${orgToSetActive.name}.`, variant: "destructive" });
        } finally {
          setIsLoadingOrgMembers(prev => ({ ...prev, [orgId]: false }));
        }
      }
    } else {
      setActiveOrganization(null); // Clear active org if accordion closes
    }
  };

  // Fetch team members when a team accordion is expanded
  const handleTeamAccordionChange = async (teamId: string | undefined) => {
    setExpandedTeamId(teamId || null);
    if (teamId && !teamMembersMap[teamId]) { // Fetch only if not already fetched
      setIsLoadingTeamMembers(prev => ({ ...prev, [teamId]: true }));
      try {
        const members = await getTeamMembers(teamId);
        setTeamMembersMap(prev => ({ ...prev, [teamId]: members }));
      } catch (error) {
        console.error(`Error fetching members for team ${teamId}:`, error);
        toast({ title: "Error", description: "Could not load team members.", variant: "destructive" });
      } finally {
        setIsLoadingTeamMembers(prev => ({ ...prev, [teamId]: false }));
      }
    }
  };
  
  const handleSetCurrentOrgAsDefault = async (orgId: string) => {
    if (!currentUser) return;
    // setIsLoadingOrgs(true); // May not be needed, or scope loading indicator
    try {
      await setCurrentOrganization(orgId); // This updates currentUser in AuthContext
      // ActiveOrganization will update via useEffect based on currentUser.defaultOrganizationId
      const selectedOrg = userOrganizations.find(o => o.id === orgId);
      toast({ title: "Active Organization Set", description: `${selectedOrg?.name || 'Organization'} is now your default context.` });
    } catch (error) {
        toast({ title: "Error", description: "Failed to set active organization.", variant: "destructive" });
    } finally {
        // setIsLoadingOrgs(false);
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
    setIsLoadingTeams(true); // Indicate team list might refresh
    const success = await joinTeam(teamId);
    if (success) {
      toast({ title: "Joined Team", description: `You have successfully joined "${teamName}".`});
      const teams = await getUserTeams(activeOrganization.id); // Re-fetch teams for active org
      setTeamsInActiveOrg(teams);
    }
    setIsLoadingTeams(false);
  };

  const handleCreateOrganizationSubmit = async (e: React.FormEvent) => {
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
      await fetchOrganizationsAndSetActive(); // Refresh list and set active if needed
    }
    setIsCreatingOrg(false);
  };

  const handleJoinOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim()) {
      toast({ title: "Validation Error", description: "Invite code cannot be empty.", variant: "destructive" });
      return;
    }
    setIsJoiningOrg(true);
    const joinedOrg = await joinOrganizationByInviteCode(joinInviteCode.trim().toUpperCase());
    if (joinedOrg) {
      setJoinInviteCode('');
      await fetchOrganizationsAndSetActive();
    }
    setIsJoiningOrg(false);
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
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
      const teams = await getUserTeams(activeOrganization.id); // Re-fetch teams for active org
      setTeamsInActiveOrg(teams);
    }
    setIsCreatingTeam(false);
  };


  if (!currentUser || currentUser.isGuest) {
    return (
        <Card className="max-w-2xl mx-auto mt-10 shadow-lg animate-fadeInUp interactive-card-hover">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building className="h-6 w-6 text-primary" />Organization Management</CardTitle>
                <CardDescription>Please log in to manage your organizations and teams.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="default" className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <AlertTitle className="text-yellow-700 dark:text-yellow-300">Login Required</AlertTitle>
                    <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                        This feature is available for registered users.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6 p-1 md:p-4 animate-fadeInUp">
      <Tabs defaultValue="my-organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6 shadow-inner">
          <TabsTrigger value="my-organizations" className="py-2.5">My Organizations & Teams</TabsTrigger>
          <TabsTrigger value="manage-orgs" className="py-2.5">Create / Join Organization</TabsTrigger>
        </TabsList>

        <TabsContent value="my-organizations" className="space-y-6">
          <Card className="shadow-lg interactive-card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Your Organizations</CardTitle>
              <CardDescription>Select an organization to view its details, teams, and members. Click an organization to make it your active context.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrgs && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading organizations...</p>
                </div>
              )}
              {!isLoadingOrgs && userOrganizations.length === 0 && (
                <Alert variant="default" className="bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700">
                    <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">No Organizations Found</AlertTitle>
                    <AlertDescription className="text-blue-600 dark:text-blue-400">
                       You are not part of any organizations yet. Use the 'Create / Join Organization' tab to get started.
                    </AlertDescription>
                </Alert>
              )}
              <ScrollArea className={cn(userOrganizations.length > 0 ? "max-h-[calc(100vh-20rem)]" : "")}>
                 <Accordion
                    type="single"
                    collapsible
                    className="w-full space-y-3"
                    value={expandedOrgId || ""}
                    onValueChange={handleOrgAccordionChange} 
                >
                  {userOrganizations.map(org => (
                    <AccordionItem value={org.id} key={org.id} className="border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden">
                       <AccordionTrigger
                        className="p-4 w-full text-left hover:bg-muted/30 data-[state=open]:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 w-full">
                          <span className="font-semibold text-xl text-primary group-hover:text-primary/90">{org.name}</span>
                          <div
                            onClick={(e) => { e.stopPropagation(); handleSetCurrentOrgAsDefault(org.id); }}
                            className={cn(
                              buttonVariants({
                                variant: currentUser.defaultOrganizationId === org.id ? "default" : "outline",
                                size: "sm"
                              }),
                              currentUser.defaultOrganizationId !== org.id && "hover:bg-primary/10",
                              isLoadingOrgs && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {currentUser.defaultOrganizationId === org.id ? <Check className="mr-1.5 h-4 w-4"/> : <Settings2 className="mr-1.5 h-4 w-4"/>}
                            {currentUser.defaultOrganizationId === org.id ? 'Active Context' : 'Set Active'}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 pt-2 border-t bg-background/30 dark:bg-neutral-800/20">
                        {org.description && <p className="text-sm text-muted-foreground mt-1 mb-3 italic">{org.description}</p>}
                        {org.ownerId === currentUser.id && org.inviteCode && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 p-2 bg-muted/50 rounded-md">
                              <span className="font-medium">Invite Code:</span>
                              <strong className="text-foreground tracking-wider text-base">{org.inviteCode}</strong>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyInviteCode(org.inviteCode)} title="Copy invite code">
                                  {copiedCode === org.inviteCode ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                              </Button>
                          </div>
                        )}
                        <Separator className="my-4" />
                        
                        {/* Organization Members */}
                        <div className="mb-4">
                            <h4 className="text-lg font-semibold mb-2 text-foreground">Members ({orgMembersMap[org.id]?.length || 0})</h4>
                            {isLoadingOrgMembers[org.id] && <div className="flex items-center text-sm text-muted-foreground py-2"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading members...</div>}
                            {!isLoadingOrgMembers[org.id] && orgMembersMap[org.id]?.length === 0 && <p className="text-xs text-muted-foreground">No members found.</p>}
                            {!isLoadingOrgMembers[org.id] && orgMembersMap[org.id] && orgMembersMap[org.id]!.length > 0 && (
                            <ScrollArea className="max-h-[200px] pr-2 border rounded-md p-2 bg-muted/20 dark:bg-neutral-900/30">
                                <ul className="space-y-2">
                                {orgMembersMap[org.id]!.map(member => (
                                    <li key={member.id} className="flex items-center gap-2.5 text-sm p-2 rounded hover:bg-muted/40 dark:hover:bg-neutral-700/50 transition-colors">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={member.photoURL || undefined} alt={member.displayName || 'User'} />
                                        <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                                            {member.displayName ? member.displayName.charAt(0).toUpperCase() : <UserCircle size={16}/>}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{member.displayName || member.email}</span>
                                    </li>
                                ))}
                                </ul>
                            </ScrollArea>
                            )}
                        </div>
                        <Separator className="my-4" />

                        {/* Teams within this Organization */}
                        <div className="mb-4">
                            <h4 className="text-lg font-semibold mb-2 text-foreground">Teams in {org.name} ({teamsInActiveOrg.filter(t => t.organizationId === org.id).length})</h4>
                            {isLoadingTeams && activeOrganization?.id === org.id && <div className="flex items-center text-sm text-muted-foreground py-2"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading teams...</div>}
                            {!isLoadingTeams && teamsInActiveOrg.filter(t => t.organizationId === org.id).length === 0 && <p className="text-sm text-muted-foreground">No teams in this organization yet.</p>}
                            
                            <Accordion type="single" collapsible className="w-full space-y-2" value={expandedTeamId || ""} onValueChange={handleTeamAccordionChange}>
                                {teamsInActiveOrg.filter(t => t.organizationId === org.id).map(team => {
                                const isMember = team.memberIds.includes(currentUser.id);
                                return (
                                    <AccordionItem value={team.id} key={team.id} className="border rounded-md shadow-sm bg-card/50 dark:bg-neutral-800/40 overflow-hidden">
                                    <AccordionTrigger className="p-3 w-full text-left hover:bg-muted/20 dark:hover:bg-neutral-700/30 data-[state=open]:bg-muted/30 dark:data-[state=open]:bg-neutral-700/40 transition-colors">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 w-full">
                                            <span className="font-medium text-md">{team.name}</span>
                                            {isMember ? (
                                            <Badge variant="outline" className="text-xs self-start sm:self-center px-2 py-0.5 border-green-500/50 text-green-700 dark:text-green-400">
                                                <Check className="mr-1 h-3 w-3" /> Member
                                            </Badge>
                                            ) : (
                                            <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); handleJoinTeamAttempt(team.id, team.name);}} className="h-7 text-xs" disabled={isLoadingTeams}>
                                                <UserPlus className="mr-1 h-3.5 w-3.5" /> Join
                                            </Button>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-3 pt-1 border-t bg-background/20 dark:bg-neutral-900/20">
                                        {team.description && <p className="text-xs text-muted-foreground mb-2 italic">{team.description}</p>}
                                        <p className="text-xs text-muted-foreground mb-1.5">Total Members: {team.memberIds.length}</p>
                                        
                                        <h5 className="text-sm font-semibold mb-1.5 text-foreground">Team Members</h5>
                                        {isLoadingTeamMembers[team.id] && <div className="flex items-center text-xs text-muted-foreground py-1"><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Loading members...</div>}
                                        {!isLoadingTeamMembers[team.id] && teamMembersMap[team.id]?.length === 0 && <p className="text-xs text-muted-foreground">No members in this team.</p>}
                                        {!isLoadingTeamMembers[team.id] && teamMembersMap[team.id] && teamMembersMap[team.id]!.length > 0 && (
                                        <ScrollArea className="max-h-[150px] pr-1.5">
                                            <ul className="space-y-1">
                                            {teamMembersMap[team.id]!.map(member => (
                                                <li key={member.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/30 dark:hover:bg-neutral-700/40 transition-colors">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={member.photoURL || undefined} alt={member.displayName || 'User'} />
                                                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                                                        {member.displayName ? member.displayName.charAt(0).toUpperCase() : <UserCircle size={12}/>}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate">{member.displayName || member.email}</span>
                                                </li>
                                            ))}
                                            </ul>
                                        </ScrollArea>
                                        )}
                                    </AccordionContent>
                                    </AccordionItem>
                                );
                                })}
                            </Accordion>
                        </div>
                        <Separator className="my-4"/>
                        {/* Create Team Form */}
                         <form onSubmit={handleCreateTeamSubmit} className="space-y-3 p-2 border-t mt-4 pt-4">
                            <h4 className="text-md font-semibold text-foreground">Create New Team in &quot;{org.name}&quot;</h4>
                            <div>
                                <Label htmlFor={`new-team-name-${org.id}`}>Team Name</Label>
                                <Input
                                    id={`new-team-name-${org.id}`}
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="e.g., Marketing Crew"
                                    disabled={isCreatingTeam}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor={`new-team-description-${org.id}`}>Team Description (Optional)</Label>
                                <Textarea
                                    id={`new-team-description-${org.id}`}
                                    value={newTeamDescription}
                                    onChange={(e) => setNewTeamDescription(e.target.value)}
                                    placeholder="Purpose of this team"
                                    disabled={isCreatingTeam}
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>
                            <Button type="submit" disabled={isCreatingTeam || !newTeamName.trim()} className="w-full sm:w-auto">
                                {isCreatingTeam ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                                Create Team
                            </Button>
                        </form>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-orgs" className="space-y-6">
           <Card className="shadow-lg interactive-card-hover">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/>Create New Organization</CardTitle>
                <CardDescription>Set up a new workspace for your projects and teams.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleCreateOrganizationSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="new-org-name-form">Organization Name</Label>
                        <Input
                            id="new-org-name-form"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            placeholder="e.g., Innovatech Solutions"
                            disabled={isCreatingOrg}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="new-org-description-form">Description (Optional)</Label>
                        <Textarea
                            id="new-org-description-form"
                            value={newOrgDescription}
                            onChange={(e) => setNewOrgDescription(e.target.value)}
                            placeholder="Briefly describe your organization's purpose"
                            disabled={isCreatingOrg}
                            className="mt-1"
                            rows={3}
                        />
                    </div>
                    <Button type="submit" disabled={isCreatingOrg || !newOrgName.trim()} className="w-full sm:w-auto">
                        {isCreatingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Create Organization
                    </Button>
                </form>
            </CardContent>
           </Card>

            <Card className="shadow-lg interactive-card-hover">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-primary"/>Join Existing Organization</CardTitle>
                    <CardDescription>Enter an invite code to become a member of an organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleJoinOrganizationSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="join-invite-code-form">Invite Code</Label>
                            <Input
                                id="join-invite-code-form"
                                value={joinInviteCode}
                                onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                                placeholder="ABC12"
                                maxLength={5}
                                disabled={isJoiningOrg}
                                className="mt-1 uppercase tracking-widest text-center text-lg h-12"
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
