// src/components/chat/ChatLayout.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, type AppUser } from '@/contexts/AuthContext';
import type { ChatRoom, ChatMessage } from '@/types';
import { ConversationList } from './ConversationList';
import { MessageArea } from './MessageArea';
import { StartChatDialog } from './StartChatDialog';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, AlertTriangle, Info, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  getOrCreatePrivateChatRoom, 
  getUserChatRoomsStream 
} from '@/services/chatService'; 
import { useToast } from '@/hooks/use-toast';

export function ChatLayout() {
  const { currentUser, getUsersForChat } = useAuth();
  const { toast } = useToast();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [isStartChatDialogOpen, setIsStartChatDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingChatRooms, setIsLoadingChatRooms] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setIsLoadingChatRooms(false);
      setChatRooms([]);
      return;
    }

    setIsLoadingChatRooms(true);
    const unsubscribe = getUserChatRoomsStream(currentUser.id, (rooms) => {
      setChatRooms(rooms);
      setIsLoadingChatRooms(false);
      if (rooms.length > 0 && !activeChatRoom) {
        // Optionally select the most recent chat room automatically
        // setActiveChatRoom(rooms[0]); 
      } else if (rooms.length === 0) {
        setActiveChatRoom(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser, activeChatRoom]);

  const handleSelectChatRoom = (room: ChatRoom) => {
    setActiveChatRoom(room);
  };

  const openStartChatDialog = async () => {
    if (!currentUser || !currentUser.defaultOrganizationId) {
        toast({
            title: "Organization Required",
            description: "You need to be part of an organization (and have it set as default) to start new chats.",
            variant: "destructive"
        });
        return;
    }
    setIsLoadingUsers(true);
    try {
      const users = await getUsersForChat();
      setAvailableUsers(users);
      setIsStartChatDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch users for chat:", error);
      toast({ title: "Error", description: "Could not load users to start a chat.", variant: "destructive"});
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleStartNewChat = async (targetUser: AppUser) => {
    if (!currentUser || !currentUser.displayName) {
      toast({ title: "Error", description: "Current user information is missing.", variant: "destructive"});
      return;
    }
    if (!targetUser.displayName) {
      toast({ title: "Error", description: "Target user information is missing.", variant: "destructive"});
      return;
    }

    try {
      const chatRoomId = await getOrCreatePrivateChatRoom(
        currentUser.id, 
        targetUser.id,
        currentUser.displayName,
        targetUser.displayName
      );

      if (chatRoomId) {
        // Find the newly created or existing chat room from the state or re-fetch
        // For now, we'll rely on the stream to update, then find it.
        // A more direct approach might be to return the full ChatRoom object from getOrCreate.
        const foundRoom = chatRooms.find(room => room.id === chatRoomId) || 
                          // Basic room structure if not immediately found in stream
                          ({ 
                            id: chatRoomId, 
                            type: 'private', 
                            memberIds: [currentUser.id, targetUser.id],
                            memberDisplayNames: {
                                [currentUser.id]: currentUser.displayName,
                                [targetUser.id]: targetUser.displayName,
                            },
                            createdAt: new Date().toISOString() 
                          } as ChatRoom);
        setActiveChatRoom(foundRoom);
        setIsStartChatDialogOpen(false);
      } else {
        toast({ title: "Error", description: "Could not start or find chat.", variant: "destructive"});
      }
    } catch (error) {
      console.error("Error starting new chat:", error);
      toast({ title: "Chat Error", description: "Failed to initiate chat session.", variant: "destructive"});
    }
  };

  if (!currentUser) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access the chat feature.</p>
        </div>
    );
  }
   if (!currentUser.defaultOrganizationId) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Info className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Set Default Organization</h2>
            <p className="text-muted-foreground">
                To use the chat feature, please set a default organization in your settings.
                Chat is available for members within the same organization.
            </p>
        </div>
    );
  }


  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-lg shadow-xl overflow-hidden bg-card">
      <aside className="w-1/3 min-w-[280px] max-w-[350px] border-r bg-muted/20 dark:bg-neutral-800/30 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Conversations</h2>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3" 
            onClick={openStartChatDialog}
            disabled={isLoadingUsers}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" /> 
            {isLoadingUsers ? "Loading Users..." : "Start New Chat"}
          </Button>
        </div>
        {isLoadingChatRooms ? (
            <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        ) : chatRooms.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground flex-grow flex flex-col items-center justify-center">
                <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                No conversations yet. <br/> Start a new chat to begin messaging.
             </div>
        ) : (
            <ConversationList
                chatRooms={chatRooms}
                currentUserId={currentUser.id}
                onSelectChatRoom={handleSelectChatRoom}
                activeChatRoomId={activeChatRoom?.id}
            />
        )}
      </aside>

      <main className="flex-1 flex flex-col">
        {activeChatRoom ? (
          <MessageArea
            key={activeChatRoom.id} // Force re-mount when chat room changes
            chatRoom={activeChatRoom}
            currentUser={currentUser}
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-8">
            <MessageSquare className="w-24 h-24 mb-4 opacity-30" />
            <p className="text-lg">Select a conversation to start messaging</p>
            <p className="text-sm">or start a new chat with someone from your organization.</p>
          </div>
        )}
      </main>
      
      <StartChatDialog
        open={isStartChatDialogOpen}
        onOpenChange={setIsStartChatDialogOpen}
        users={availableUsers}
        onSelectUser={handleStartNewChat}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
