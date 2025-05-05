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
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { KanbanBoard } from "@/components/kanban-board";
import { Button } from "@/components/ui/button";
import { Bot, CheckSquare, ListTodo, Settings, Star } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex h-screen">
      <Sidebar side="left" variant="inset" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
             {/* Replace with a proper logo later if available */}
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
               <SidebarMenuButton tooltip="Board">
                  <ListTodo />
                  Board
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton tooltip="AI Assistant">
                  <Bot />
                  AI Assistant
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton tooltip="Prioritize Tasks">
                  <Star />
                  Prioritize Tasks
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton tooltip="Smart Task Creation">
                  <CheckSquare />
                  Smart Task Creation
                </SidebarMenuButton>
             </SidebarMenuItem>
           </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border">
           <SidebarMenu>
             <SidebarMenuItem>
               <SidebarMenuButton tooltip="Settings">
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
           <h1 className="text-xl font-semibold">Kanban Board</h1>
           <Button size="sm">Add Task</Button>
         </header>
        <main className="flex-1 overflow-y-auto p-4">
          <KanbanBoard />
        </main>
      </SidebarInset>
    </div>
  );
}
