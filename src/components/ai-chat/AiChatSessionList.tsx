
// src/components/ai-chat/AiChatSessionList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import type { AiChatSession } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button'; // Added buttonVariants
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
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


interface AiChatSessionListProps {
  sessions: AiChatSession[];
  currentUserId: string | null;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string, sessionName: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  isLoadingSessions: boolean;
}

export function AiChatSessionList({
  sessions,
  currentUserId,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isLoadingSessions,
}: AiChatSessionListProps) {
  const { toast } = useToast();
  const [sessionToDelete, setSessionToDelete] = useState<AiChatSession | null>(null);

  const handleDelete = async () => {
    if (sessionToDelete && currentUserId) {
      try {
        await onDeleteSession(sessionToDelete.id);
        toast({ title: "Chat Deleted", description: `Chat "${sessionToDelete.name}" has been deleted.` });
      } catch (error) {
        toast({ title: "Error", description: "Could not delete chat session.", variant: "destructive" });
      } finally {
        setSessionToDelete(null);
      }
    }
  };
  
  const formatTimestamp = (isoString: string) => {
    try {
      return formatDistanceToNowStrict(parseISO(isoString), { addSuffix: true });
    } catch (e) {
      return "Invalid date";
    }
  };


  return (
    <div className="flex flex-col h-full bg-muted/30 dark:bg-neutral-800/50 border-r border-border/70 dark:border-neutral-700/70">
      <div className="p-3 border-b border-border/70 dark:border-neutral-700/70">
        <Button variant="outline" className="w-full justify-start text-sm" onClick={onNewChat}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      {isLoadingSessions && (
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      {!isLoadingSessions && sessions.length === 0 && (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">No chat history yet.</p>
          <p className="text-xs">Start a new chat to begin.</p>
        </div>
      )}
      {!isLoadingSessions && sessions.length > 0 && (
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {sessions.map((session) => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => onSelectSession(session.id, session.name)}
                  className={cn(
                    'w-full flex flex-col items-start gap-0.5 p-2.5 rounded-lg text-left transition-colors duration-150 ease-in-out',
                    activeSessionId === session.id
                      ? 'bg-primary/15 text-primary shadow-sm'
                      : 'hover:bg-muted/60 dark:hover:bg-neutral-700/60',
                    !activeSessionId || activeSessionId !== session.id ? 'text-foreground' : ''
                  )}
                >
                  <h3 className="text-sm font-medium truncate w-full">{session.name}</h3>
                  <p className={cn(
                      "text-xs truncate w-full",
                      activeSessionId === session.id ? "text-primary/80" : "text-muted-foreground"
                  )}>
                      Updated {formatTimestamp(session.lastUpdatedAt)}
                  </p>
                </button>
                <AlertDialogTrigger asChild>
                   <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    onClick={(e) => { 
                        e.stopPropagation(); // Prevent session selection
                        setSessionToDelete(session);
                    }}
                    title="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </div>
            ))}
          </nav>
        </ScrollArea>
      )}
        <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Delete Chat &quot;{sessionToDelete?.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this chat session.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSessionToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDelete}
                    className={buttonVariants({ variant: "destructive" })}
                >
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
