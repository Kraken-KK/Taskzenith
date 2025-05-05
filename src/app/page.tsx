'use client';

import React, { useState } from 'react'; // Import useState
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
import { AiChat } from "@/components/ai-chat"; // Import AiChat
import { Button } from "@/components/ui/button";
import { Bot, CheckSquare, ListTodo, Settings, Star } from "lucide-react";

type ActiveView = 'board' | 'ai-assistant' | 'prioritize' | 'smart-create' | 'settings';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('board'); // State for active view

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
    <div className="flex h-screen">
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
           <SidebarTrigger />
           <h1 className="text-xl font-semibold">{getHeaderText()}</h1>
           {/* Add Task button removed from here */}
           <div>{/* Placeholder for potential future header actions */}</div>
         </header>
        <main className="flex-1 overflow-y-auto p-4">
          {/* Conditionally render components based on activeView */}
          {activeView === 'board' && <KanbanBoard />}
          {activeView === 'ai-assistant' && <AiChat />}
          {/* Add placeholders or components for other views */}
          {activeView === 'prioritize' && <div>Prioritize Tasks View (Coming Soon)</div>}
          {activeView === 'smart-create' && <div>Smart Task Creation View (Coming Soon)</div>}
          {activeView === 'settings' && <div>Settings View (Coming Soon)</div>}
        </main>
      </SidebarInset>
    </div>
  );
}
