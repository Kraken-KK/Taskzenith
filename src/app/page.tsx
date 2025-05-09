
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
} from "@/components/ui/sidebar";
import { KanbanBoard } from "@/components/kanban-board";
import { AiChat } from "@/components/ai-chat";
import { SettingsView } from '@/components/settings-view';
import { PrioritizeTasksView } from '@/components/prioritize-tasks-view';
import { SmartTaskCreationView } from '@/components/smart-task-creation-view';
import { Bot, CheckSquare, ListTodo, Settings, Star, Menu, FolderKanban, PlusCircle, Edit3, Trash2, Palette, LogOut, Database, Zap } from "lucide-react";
import { useSidebar } from '@/components/ui/sidebar';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasks } from '@/contexts/TaskContext';
import type { Board } from '@/types';
import { CreateBoardDialog } from '@/components/create-board-dialog';
import { RenameBoardDialog } from '@/components/rename-board-dialog';
import { BoardThemeCustomizer } from '@/components/board-theme-customizer';
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
  DropdownMenuPortal
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type ActiveView = 'board' | 'ai-assistant' | 'prioritize' | 'smart-create' | 'settings';

export default function Home() {
  const { currentUser, loading: authLoading, logout, currentProvider } = useAuth();
  const router = useRouter();
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const { isMobile } = useSidebar();
  const { boards, activeBoardId, setActiveBoardId, getActiveBoard, deleteBoard } = useTasks();
  const { toast } = useToast();

  const [isCreateBoardDialogOpen, setIsCreateBoardDialogOpen] = useState(false);
  const [isRenameBoardDialogOpen, setIsRenameBoardDialogOpen] = useState(false);
  const [boardToRename, setBoardToRename] = useState<Board | undefined>(undefined);
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [boardToCustomize, setBoardToCustomize] = useState<Board | undefined>(undefined);


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  // Effect to ensure an active board is selected if possible
  useEffect(() => {
    if (currentUser && !activeBoardId && boards.length > 0) { // Ensure currentUser exists before trying to set active board
      setActiveBoardId(boards[0].id);
    }
  }, [activeBoardId, boards, setActiveBoardId, currentUser]);


  if (authLoading || !currentUser) {
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
    switch (activeView) {
      case 'board': return activeBoard ? activeBoard.name : 'Kanban Board';
      case 'ai-assistant': return 'AI Assistant (Jack)';
      case 'prioritize': return 'AI Task Prioritization';
      case 'smart-create': return 'Smart Task Creation';
      case 'settings': return 'Settings';
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

  const getUserInitial = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.charAt(0).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.charAt(0).toUpperCase();
    }
    return "U";
  }
  
  const getProviderIcon = () => {
    if (currentProvider === 'firebase') {
      return <Database className="h-3 w-3 text-orange-500" title="Firebase" />;
    }
    if (currentProvider === 'supabase') {
      return <Zap className="h-3 w-3 text-green-500" title="Supabase" />;
    }
    return null;
  }


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
            {/* Board Management Dropdown */}
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            tooltip="My Boards"
                            className="w-full hover:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent/50"
                        >
                            <FolderKanban />
                            My Boards
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 ml-2" side="right" align="start">
                        <DropdownMenuLabel>Your Boards</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {boards.map(board => (
                           <AlertDialog key={board.id}> {/* Wrap DropdownMenuSub with AlertDialog for unique key context */}
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger
                                    className={cn("justify-between", board.id === activeBoardId && "bg-accent text-accent-foreground")}
                                    onClick={() => setActiveBoardId(board.id)}
                                >
                                    <span>{board.name}</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => handleRenameBoard(board)}>
                                            <Edit3 className="mr-2 h-4 w-4" /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCustomizeTheme(board)}>
                                            <Palette className="mr-2 h-4 w-4" /> Customize Theme
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Board
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
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
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                           </AlertDialog>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsCreateBoardDialogOpen(true)}>
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
                >
                  <Settings />
                  Settings
                </SidebarMenuButton>
             </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Logout"
                  onClick={logout}
                  className="hover:bg-destructive/20 dark:hover:bg-destructive/30 text-destructive dark:text-red-400"
                >
                  <LogOut />
                  Logout
                </SidebarMenuButton>
              </SidebarMenuItem>
              {currentUser && (
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
                <Button onClick={() => setIsCreateBoardDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Board
                </Button>
            </div>
          )}
          {activeView === 'ai-assistant' && <AiChat />}
          {activeView === 'prioritize' && <PrioritizeTasksView />}
          {activeView === 'smart-create' && <SmartTaskCreationView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </SidebarInset>
      <CreateBoardDialog open={isCreateBoardDialogOpen} onOpenChange={setIsCreateBoardDialogOpen} />
      <RenameBoardDialog board={boardToRename} open={isRenameBoardDialogOpen} onOpenChange={setIsRenameBoardDialogOpen} />
      <BoardThemeCustomizer board={boardToCustomize} open={isThemeCustomizerOpen} onOpenChange={setIsThemeCustomizerOpen} />
    </div>
  );
}
