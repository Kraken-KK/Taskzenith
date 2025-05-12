
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { KanbanBoard } from "@/components/kanban-board";
import { AiChat } from "@/components/ai-chat";
import { SettingsView } from '@/components/settings-view';
import { PrioritizeTasksView } from '@/components/prioritize-tasks-view';
import { SmartTaskCreationView } from '@/components/smart-task-creation-view';
import { Bot, CheckSquare, ListTodo, Settings, Star, Menu, FolderKanban, PlusCircle, Edit3, Trash2, Palette, LogOut, Database, Zap, User, Chrome, FolderPlus, FolderSymlink, Folders, Users, Building, Briefcase } from "lucide-react"; // Added Users, Building for org/team
import { useSidebar } from '@/components/ui/sidebar';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasks } from '@/contexts/TaskContext';
import type { Board, BoardGroup, Organization, Team } from '@/types';
import { CreateBoardDialog } from '@/components/create-board-dialog';
import { RenameBoardDialog } from '@/components/rename-board-dialog';
import { BoardThemeCustomizer } from '@/components/board-theme-customizer';
import { CreateBoardGroupDialog } from '@/components/create-board-group-dialog';
import { RenameBoardGroupDialog } from '@/components/rename-board-group-dialog';
import { CreateOrganizationDialog } from '@/components/create-organization-dialog';
import { CreateTeamDialog } from '@/components/create-team-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type ActiveView = 'board' | 'ai-assistant' | 'prioritize' | 'smart-create' | 'settings' | 'organizations' | 'teams';

export default function Home() {
  const { 
    currentUser, loading: authLoading, logout, currentProvider, isGuest, exitGuestMode, 
    createOrganization, createTeam, getUserOrganizations, getUserTeams, setCurrentOrganization 
  } = useAuth();
  const router = useRouter();
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const { isMobile } = useSidebar();
  const { 
    boards, activeBoardId, setActiveBoardId, getActiveBoard, deleteBoard,
    boardGroups, addBoardGroup, deleteBoardGroup, updateBoardGroupName, addBoardToGroup, removeBoardFromGroup, updateBoardGroupId
  } = useTasks();
  const { toast } = useToast();

  const [isCreateBoardDialogOpen, setIsCreateBoardDialogOpen] = useState(false);
  const [isRenameBoardDialogOpen, setIsRenameBoardDialogOpen] = useState(false);
  const [boardToRename, setBoardToRename] = useState<Board | undefined>(undefined);
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [boardToCustomize, setBoardToCustomize] = useState<Board | undefined>(undefined);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isRenameGroupDialogOpen, setIsRenameGroupDialogOpen] = useState(false);
  const [groupToRename, setGroupToRename] = useState<BoardGroup | undefined>(undefined);
  const [targetGroupIdForNewBoard, setTargetGroupIdForNewBoard] = useState<string | null | undefined>(undefined);

  // State for new co-working features
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [selectedOrgForTeamCreation, setSelectedOrgForTeamCreation] = useState<string | null>(null);


  useEffect(() => {
    if (!authLoading && !currentUser && !isGuest) {
      router.push('/login');
    }
  }, [currentUser, authLoading, isGuest, router]);

  useEffect(() => {
    if ((currentUser || isGuest) && !activeBoardId && boards.length > 0) { 
      setActiveBoardId(boards[0].id);
    }
  }, [activeBoardId, boards, setActiveBoardId, currentUser, isGuest]);

  // Fetch user's organizations and teams
  useEffect(() => {
    if (currentUser && !isGuest) {
        const fetchOrgAndTeams = async () => {
            const orgs = await getUserOrganizations();
            setUserOrganizations(orgs);
            if (currentUser.defaultOrganizationId) {
                const teams = await getUserTeams(currentUser.defaultOrganizationId);
                setUserTeams(teams);
            } else if (orgs.length > 0) {
                // If no default org, but orgs exist, fetch teams for the first one as a fallback display
                const teams = await getUserTeams(orgs[0].id);
                setUserTeams(teams);
            } else {
                setUserTeams([]);
            }
        };
        fetchOrgAndTeams();
    } else {
        setUserOrganizations([]);
        setUserTeams([]);
    }
  }, [currentUser, isGuest, getUserOrganizations, getUserTeams]);


  if (authLoading || (!currentUser && !isGuest)) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <svg className="animate-spin h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  const getHeaderText = () => {
    const activeBoard = getActiveBoard();
    const currentOrg = userOrganizations.find(org => org.id === currentUser?.defaultOrganizationId);
    switch (activeView) {
      case 'board': return activeBoard ? activeBoard.name : 'Kanban Board';
      case 'ai-assistant': return 'AI Assistant (Jack)';
      case 'prioritize': return 'AI Task Prioritization';
      case 'smart-create': return 'Smart Task Creation';
      case 'settings': return 'Settings';
      case 'organizations': return 'My Organizations';
      case 'teams': return currentOrg ? `Teams in ${currentOrg.name}` : 'My Teams';
      default: return 'TaskZenith';
    }
  };
  
  const handleRenameBoard = (board: Board) => {
    setBoardToRename(board);
    setIsRenameBoardDialogOpen(true);
  };

  const handleDeleteBoard = (boardId: string, boardName: string) => {
    deleteBoard(boardId); 
    toast({
        title: "Board Deleted",
        description: `Board "${boardName}" has been successfully deleted.`,
    });
  };

  const handleCustomizeTheme = (board: Board) => {
    setBoardToCustomize(board);
    setIsThemeCustomizerOpen(true);
  }

  const handleRenameGroup = (group: BoardGroup) => {
    setGroupToRename(group);
    setIsRenameGroupDialogOpen(true);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    deleteBoardGroup(groupId);
    toast({
        title: "Board Group Deleted",
        description: `Group "${groupName}" has been deleted. Its boards are now ungrouped.`,
    });
  };

  const handleMoveBoardToGroup = (boardId: string, groupId: string | null) => {
    if (groupId === "new_group") {
        setIsCreateGroupDialogOpen(true); 
        toast({ title: "Create Group", description: "Please create a new group first, then move the board."});
    } else if (groupId === "remove_from_group") {
        removeBoardFromGroup(boardId);
    } else if (groupId) {
        addBoardToGroup(boardId, groupId);
    }
  };

  const openCreateBoardDialog = (groupId?: string | null) => {
    setTargetGroupIdForNewBoard(groupId);
    setIsCreateBoardDialogOpen(true);
  };


  const getUserInitial = () => {
    if (isGuest) return "G";
    if (currentUser?.displayName) return currentUser.displayName.charAt(0).toUpperCase();
    if (currentUser?.email) return currentUser.email.charAt(0).toUpperCase();
    return "?";
  }
  
  const getProviderIcon = () => {
    if (currentProvider === 'firebase') {
      return <Database className="h-3 w-3 text-orange-500" title="Firebase" />;
    }
    if (currentProvider === 'supabase') {
      return <Zap className="h-3 w-3 text-green-500" title="Supabase" />;
    }
    if (currentProvider === 'google') {
      return <Chrome className="h-3 w-3 text-blue-500" title="Google" />;
    }
    return null;
  }

  const handleOpenCreateTeamDialog = (orgId: string) => {
    setSelectedOrgForTeamCreation(orgId);
    setIsCreateTeamDialogOpen(true);
  };
  
  const handleSetCurrentOrg = async (orgId: string | null) => {
    await setCurrentOrganization(orgId);
    // Refetch teams for the new current org
    if (orgId) {
        const teams = await getUserTeams(orgId);
        setUserTeams(teams);
    } else {
        setUserTeams([]); // No default org, clear teams or fetch all teams user is part of
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground animate-fadeIn">
      <Sidebar side="left" variant="inset" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2 transition-opacity duration-300 group-data-[collapsible=icon]:opacity-0 group-data-[state=expanded]:opacity-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary transition-transform duration-300 ease-in-out group-hover:scale-110"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
             <span className="font-semibold text-xl group-data-[collapsible=icon]:hidden">TaskZenith</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-2">
          <SidebarMenu>
            {/* Organizations Section */}
            {!isGuest && currentUser && (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton tooltip="Organizations" className="w-full hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50">
                      <Building /> Organizations
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 ml-2" side="right" align="start">
                    <DropdownMenuLabel>My Organizations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userOrganizations.length === 0 && <DropdownMenuItem disabled>No organizations yet.</DropdownMenuItem>}
                    {userOrganizations.map(org => (
                      <DropdownMenuItem 
                        key={org.id} 
                        onClick={() => handleSetCurrentOrg(org.id)}
                        className={cn(org.id === currentUser.defaultOrganizationId && "bg-accent text-accent-foreground")}
                      >
                        {org.name} {org.id === currentUser.defaultOrganizationId && "(Active)"}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                     <DropdownMenuItem onClick={() => setIsCreateOrgDialogOpen(true)}>
                       <PlusCircle className="mr-2 h-4 w-4" /> Create New Organization
                     </DropdownMenuItem>
                     {currentUser.defaultOrganizationId && (
                        <DropdownMenuItem onClick={() => handleSetCurrentOrg(null)}>
                            Clear Default Organization
                        </DropdownMenuItem>
                     )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )}

            {/* Teams Section (contextual to selected organization) */}
            {!isGuest && currentUser && currentUser.defaultOrganizationId && (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton tooltip="Teams" className="w-full hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50">
                      <Users /> Teams
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 ml-2" side="right" align="start">
                    <DropdownMenuLabel>
                        Teams in {userOrganizations.find(o => o.id === currentUser.defaultOrganizationId)?.name || 'Current Org'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userTeams.length === 0 && <DropdownMenuItem disabled>No teams in this org yet.</DropdownMenuItem>}
                    {userTeams.map(team => (
                      <DropdownMenuItem key={team.id} /* onClick={() => setActiveTeam(team.id) - for future use} */ >
                        {team.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => currentUser.defaultOrganizationId && handleOpenCreateTeamDialog(currentUser.defaultOrganizationId)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Create New Team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )}
            <SidebarSeparator />


            {/* Board Groups Section */}
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            tooltip="Board Groups"
                            className="w-full hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                            disabled={authLoading && !currentUser && !isGuest} 
                        >
                            <Folders /> 
                            Board Groups
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 ml-2" side="right" align="start">
                        <DropdownMenuLabel>Your Board Groups</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {boardGroups.length === 0 && <DropdownMenuItem disabled>No groups yet.</DropdownMenuItem>}
                        {boardGroups.map(group => (
                           <AlertDialog key={group.id}> 
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="justify-between">
                                    <span>{group.name} ({group.boardIds.length})</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-48">
                                        <DropdownMenuLabel>Boards in {group.name}</DropdownMenuLabel>
                                        {group.boardIds.length === 0 && <DropdownMenuItem disabled>No boards in this group.</DropdownMenuItem>}
                                        {group.boardIds.map(boardId => {
                                            const board = boards.find(b => b.id === boardId);
                                            return board ? (
                                                <DropdownMenuItem key={boardId} onClick={() => setActiveBoardId(boardId)} className={cn(boardId === activeBoardId && "bg-accent text-accent-foreground")}>
                                                    {board.name}
                                                </DropdownMenuItem>
                                            ) : null;
                                        })}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => openCreateBoardDialog(group.id)}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Board to Group
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleRenameGroup(group)}>
                                            <Edit3 className="mr-2 h-4 w-4" /> Rename Group
                                        </DropdownMenuItem>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Group
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Group &quot;{group.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This will delete the group. Boards within this group will become ungrouped. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                    onClick={() => handleDeleteGroup(group.id, group.name)}
                                    className={buttonVariants({ variant: "destructive" })}
                                    >
                                    Delete Group
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                           </AlertDialog>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsCreateGroupDialogOpen(true)}>
                            <FolderPlus className="mr-2 h-4 w-4" /> Create New Group
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>

            <SidebarSeparator />

            {/* Individual Boards Section (Ungrouped and All) */}
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            tooltip="My Boards"
                            className="w-full hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                            disabled={authLoading && !currentUser && !isGuest} 
                        >
                            <FolderKanban />
                            My Boards
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 ml-2" side="right" align="start">
                        <DropdownMenuLabel>Your Boards</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {boards.length === 0 && <DropdownMenuItem disabled>No boards yet.</DropdownMenuItem>}
                        {boards.map(board => (
                           <AlertDialog key={board.id}> 
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger
                                    className={cn("justify-between", board.id === activeBoardId && "bg-accent text-accent-foreground")}
                                    onClick={() => setActiveBoardId(board.id)}
                                >
                                    <span className="flex items-center">
                                        {board.name}
                                        {board.teamId && <Users className="h-3 w-3 ml-1.5 text-muted-foreground/70" title="Team Board" />}
                                        {board.organizationId && !board.teamId && <Building className="h-3 w-3 ml-1.5 text-muted-foreground/70" title="Org Board"/>}
                                        {board.groupId && <span className="text-xs text-muted-foreground ml-1">({boardGroups.find(g=>g.id===board.groupId)?.name})</span>}
                                    </span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-52">
                                        <DropdownMenuItem onClick={() => handleRenameBoard(board)}>
                                            <Edit3 className="mr-2 h-4 w-4" /> Rename Board
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCustomizeTheme(board)}>
                                            <Palette className="mr-2 h-4 w-4" /> Customize Theme
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <FolderSymlink className="mr-2 h-4 w-4" /> Move to Group
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuRadioGroup 
                                                        value={board.groupId || "ungrouped"} 
                                                        onValueChange={(value) => handleMoveBoardToGroup(board.id, value === "ungrouped" ? "remove_from_group" : value)}
                                                    >
                                                        {board.groupId && (
                                                          <DropdownMenuRadioItem value="remove_from_group">
                                                            Remove from current group
                                                          </DropdownMenuRadioItem>
                                                        )}
                                                        {!board.groupId && (
                                                            <DropdownMenuItem disabled>Not in a group</DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        {boardGroups.length > 0 && <DropdownMenuLabel>Existing Groups</DropdownMenuLabel>}
                                                        {boardGroups.map(group => (
                                                            <DropdownMenuRadioItem key={group.id} value={group.id} disabled={board.groupId === group.id}>
                                                                {group.name}
                                                            </DropdownMenuRadioItem>
                                                        ))}
                                                         <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setIsCreateGroupDialogOpen(true)}>
                                                           <FolderPlus className="mr-2 h-4 w-4" /> Create New Group...
                                                        </DropdownMenuItem>
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Board
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Board &quot;{board.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the board and all its tasks.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                    onClick={() => handleDeleteBoard(board.id, board.name)}
                                    className={buttonVariants({ variant: "destructive" })}
                                    >
                                    Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                           </AlertDialog>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openCreateBoardDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Board
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>

             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="Board"
                  isActive={activeView === 'board'}
                  onClick={() => {
                    if (!activeBoardId && boards.length > 0) setActiveBoardId(boards[0].id);
                    else if (!activeBoardId && boards.length === 0) {
                         toast({title: "No Board Selected", description: "Please create or select a board first.", variant: "destructive"});
                         return;
                    }
                    setActiveView('board');
                  }}
                  className="hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                  disabled={authLoading && !currentUser && !isGuest}
               >
                  <ListTodo />
                  Board
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="AI Assistant"
                  isActive={activeView === 'ai-assistant'}
                  onClick={() => setActiveView('ai-assistant')}
                  className="hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                  disabled={authLoading && !currentUser && !isGuest}
                >
                  <Bot />
                  AI Assistant
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="Prioritize Tasks"
                  isActive={activeView === 'prioritize'}
                  onClick={() => setActiveView('prioritize')}
                  className="hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                  disabled={authLoading && !currentUser && !isGuest}
                >
                  <Star />
                  Prioritize Tasks
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="Smart Task Creation"
                  isActive={activeView === 'smart-create'}
                  onClick={() => setActiveView('smart-create')}
                  className="hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                  disabled={authLoading && !currentUser && !isGuest}
                >
                  <CheckSquare />
                  Smart Task Creation
                </SidebarMenuButton>
             </SidebarMenuItem>
           </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border">
           <SidebarMenu>
             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="Settings"
                  isActive={activeView === 'settings'}
                  onClick={() => setActiveView('settings')}
                  className="hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                  disabled={authLoading && !currentUser && !isGuest}
                >
                  <Settings />
                  Settings
                </SidebarMenuButton>
             </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={isGuest ? "Exit Guest Mode & Login" : "Logout"}
                  onClick={isGuest ? exitGuestMode : logout}
                  className="hover:bg-destructive/20 dark:hover:bg-destructive/30 text-destructive dark:text-red-400"
                  disabled={authLoading}
                >
                  <LogOut />
                  {isGuest ? "Exit Guest Mode" : "Logout"}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {currentUser && !isGuest && (
                <div className="p-2 mt-2 group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      {currentUser.photoURL ? <AvatarImage src={currentUser.photoURL} alt={currentUser.displayName || "User"} /> : null}
                      <AvatarFallback className="bg-primary text-primary-foreground">{getUserInitial()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-sidebar-foreground flex items-center gap-1">
                        {currentUser.displayName || currentUser.email?.split('@')[0]}
                        {getProviderIcon()}
                      </p>
                      <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>
                </div>
              )}
              {isGuest && (
                 <div className="p-2 mt-2 group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-muted text-muted-foreground"><User className="h-5 w-5"/></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-sidebar-foreground">Guest User</p>
                      <p className="text-xs text-muted-foreground">Exploring TaskZenith</p>
                    </div>
                  </div>
                </div>
              )}
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col transition-all duration-300 ease-in-out">
        <header className="flex items-center justify-between p-4 border-b shadow-sm bg-card/50 backdrop-blur-sm">
           <SidebarTrigger />
           <h1 className="text-xl font-semibold">{getHeaderText()}</h1>
           <div className="w-7 h-7"> {/* Placeholder for potential right-side header actions */} </div>
         </header>
        <main className="flex-1 overflow-y-auto p-4 bg-secondary/20 dark:bg-neutral-900/50">
          {activeView === 'board' && (activeBoardId ? <KanbanBoard /> : 
            <div className="flex flex-col items-center justify-center h-full text-center">
                <FolderKanban className="w-24 h-24 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-semibold mb-2">No Board Selected</h2>
                <p className="text-muted-foreground mb-4">Please create or select a board from the sidebar to get started.</p>
                <Button onClick={() => openCreateBoardDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Board
                </Button>
            </div>
          )}
          {activeView === 'ai-assistant' && <AiChat />}
          {activeView === 'prioritize' && <PrioritizeTasksView />}
          {activeView === 'smart-create' && <SmartTaskCreationView />}
          {activeView === 'settings' && <SettingsView />}
          {/* Placeholder for Organizations View */}
          {activeView === 'organizations' && !isGuest && currentUser &&(
            <div className="p-4">
              <h2 className="text-2xl font-semibold mb-4">My Organizations</h2>
              {userOrganizations.length === 0 ? (
                <p>You are not part of any organization yet.</p>
              ) : (
                <ul className="space-y-2">
                  {userOrganizations.map(org => (
                    <li key={org.id} className="p-3 border rounded-md shadow-sm hover:bg-muted/30">
                      {org.name} {org.id === currentUser.defaultOrganizationId && <span className="text-xs text-primary ml-2">(Default)</span>}
                      <Button variant="link" size="sm" onClick={() => handleSetCurrentOrg(org.id)} className="ml-2">Set as Default</Button>
                      <Button variant="link" size="sm" onClick={() => {setSelectedOrgForTeamCreation(org.id); setIsCreateTeamDialogOpen(true)}} className="ml-2">Add Team</Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button onClick={() => setIsCreateOrgDialogOpen(true)} className="mt-4">
                <Briefcase className="mr-2 h-4 w-4" /> Create Organization
              </Button>
            </div>
          )}
          {/* Placeholder for Teams View */}
          {activeView === 'teams' && !isGuest && currentUser && currentUser.defaultOrganizationId && (
            <div className="p-4">
              <h2 className="text-2xl font-semibold mb-4">Teams in {userOrganizations.find(o => o.id === currentUser?.defaultOrganizationId)?.name}</h2>
              {userTeams.length === 0 ? (
                <p>No teams in this organization yet.</p>
              ) : (
                <ul className="space-y-2">
                  {userTeams.map(team => (
                    <li key={team.id} className="p-3 border rounded-md shadow-sm">
                      {team.name}
                      {/* Add join/view team button here later */}
                    </li>
                  ))}
                </ul>
              )}
              <Button onClick={() => currentUser.defaultOrganizationId && handleOpenCreateTeamDialog(currentUser.defaultOrganizationId)} className="mt-4">
                <Users className="mr-2 h-4 w-4" /> Create Team
              </Button>
            </div>
          )}
        </main>
      </SidebarInset>
      <CreateBoardDialog 
        open={isCreateBoardDialogOpen} 
        onOpenChange={setIsCreateBoardDialogOpen} 
        targetGroupId={targetGroupIdForNewBoard}
      />
      <RenameBoardDialog board={boardToRename} open={isRenameBoardDialogOpen} onOpenChange={setIsRenameBoardDialogOpen} />
      <BoardThemeCustomizer board={boardToCustomize} open={isThemeCustomizerOpen} onOpenChange={setIsThemeCustomizerOpen} />
      <CreateBoardGroupDialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen} />
      <RenameBoardGroupDialog group={groupToRename} open={isRenameGroupDialogOpen} onOpenChange={setIsRenameGroupDialogOpen} />
      {/* Co-working Dialogs */}
      <CreateOrganizationDialog 
        open={isCreateOrgDialogOpen} 
        onOpenChange={(isOpen) => {
            setIsCreateOrgDialogOpen(isOpen);
            if(isOpen === false) getUserOrganizations().then(setUserOrganizations); // Refresh list on close
        }}
      />
      <CreateTeamDialog
        open={isCreateTeamDialogOpen}
        onOpenChange={(isOpen) => {
            setIsCreateTeamDialogOpen(isOpen);
            if(isOpen === false && selectedOrgForTeamCreation) getUserTeams(selectedOrgForTeamCreation).then(setUserTeams); // Refresh list on close
        }}
        organizationId={selectedOrgForTeamCreation}
      />
    </div>
  );
}
