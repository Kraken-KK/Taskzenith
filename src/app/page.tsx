'use client';

import React, { useState } from 'react';
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
import { SettingsView } from '@/components/settings-view'; // Import SettingsView
import { PrioritizeTasksView } from '@/components/prioritize-tasks-view'; // Import PrioritizeTasksView
import { SmartTaskCreationView } from '@/components/smart-task-creation-view'; // Import SmartTaskCreationView
import { Bot, CheckSquare, ListTodo, Settings, Star, Menu } from "lucide-react"; // Added Menu for SidebarTrigger in mobile
import { useSidebar } from '@/components/ui/sidebar'; // To control sidebar visibility
import { Button } from '@/components/ui/button'; // For a dedicated mobile trigger if needed

type ActiveView = 'board' | 'ai-assistant' | 'prioritize' | 'smart-create' | 'settings';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const { isMobile } = useSidebar(); // Get mobile state

  const getHeaderText = () => {
    switch (activeView) {
      case 'board': return 'Kanban Board';
      case 'ai-assistant': return 'AI Assistant';
      case 'prioritize': return 'Prioritize Tasks';
      case 'smart-create': return 'Smart Task Creation';
      case 'settings': return 'Settings';
      default: return 'TaskZenith';
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar side="left" variant="inset" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
             <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">TaskZenith</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-2">
          <SidebarMenu>
             <SidebarMenuItem>
               <SidebarMenuButton
                  tooltip="Board"
                  isActive={activeView === 'board'}
                  onClick={() => setActiveView('board')}
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
                >
                  <Settings />
                  Settings
                </SidebarMenuButton>
             </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="flex items-center justify-between p-4 border-b">
           {/* Use SidebarTrigger for both desktop and mobile by default. */}
           {/* It will correctly handle mobile (Sheet trigger) and desktop (panel toggle) */}
           <SidebarTrigger />
           <h1 className="text-xl font-semibold">{getHeaderText()}</h1>
           <div>{/* Placeholder for potential future header actions */}</div>
         </header>
        <main className="flex-1 overflow-y-auto p-4 bg-secondary/20 dark:bg-neutral-900">
          {activeView === 'board' && <KanbanBoard />}
          {activeView === 'ai-assistant' && <AiChat />}
          {activeView === 'prioritize' && <PrioritizeTasksView />}
          {activeView === 'smart-create' && <SmartTaskCreationView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </SidebarInset>
    </div>
  );
}