// src/components/chat/ChatLayout.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, type AppUser } from '@/contexts/AuthContext';
import type { ChatRoom, ChatMessage } from '@/types';
import { ConversationList } from './ConversationList';
import { MessageArea } from './MessageArea';
import { StartChatDialog } from './StartChatDialog';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, AlertTriangle, Info, MessageSquare, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  getOrCreatePrivateChatRoom, 
  getUserChatRoomsStream 
} from '@/services/chatService'; 
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export function ChatLayout() {
  const { currentUser, getUsersForChat } = useAuth();
  const { toast } = useToast();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [isStartChatDialogOpen, setIsStartChatDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingChatRooms, setIsLoadingChatRooms] = useState(true);
  const isMobile = useIsMobile();
  const [showConversationListMobile, setShowConversationListMobile] = useState(true);


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
      // If there's an active chat room, try to find it in the new list
      // This handles cases where the active room's details might have updated
      if (activeChatRoom) {
        const updatedActiveRoom = rooms.find(room => room.id === activeChatRoom.id);
        if (updatedActiveRoom) {
          setActiveChatRoom(updatedActiveRoom);
        } else {
          // Active room no longer exists or user is no longer part of it
          setActiveChatRoom(null);
          if(isMobile) setShowConversationListMobile(true);
        }
      } else if (rooms.length > 0 && !isMobile) {
        // setActiveChatRoom(rooms[0]); // Optionally auto-select first room on desktop
      }

      if (isMobile && !activeChatRoom) {
        setShowConversationListMobile(true);
      } else if (isMobile && activeChatRoom) {
        setShowConversationListMobile(false);
      }

    });

    return () => unsubscribe();
  }, [currentUser, isMobile]); // Removed activeChatRoom from dep array to avoid potential loops

  useEffect(() => {
    if (isMobile) {
      setShowConversationListMobile(!activeChatRoom);
    }
  }, [activeChatRoom, isMobile]);


  const handleSelectChatRoom = (room: ChatRoom) => {
    setActiveChatRoom(room);
    if (isMobile) {
      setShowConversationListMobile(false);
    }
  };
  
  const handleBackToConversations = () => {
    setActiveChatRoom(null);
    if (isMobile) {
      setShowConversationListMobile(true);
    }
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
        const existingRoom = chatRooms.find(room => room.id === chatRoomId);
        const newRoomData = { 
          id: chatRoomId, 
          type: 'private', 
          memberIds: [currentUser.id, targetUser.id],
          memberDisplayNames: {
              [currentUser.id]: currentUser.displayName,
              [targetUser.id]: targetUser.displayName,
          },
          createdAt: new Date().toISOString() 
        } as ChatRoom;

        setActiveChatRoom(existingRoom || newRoomData);
        setIsStartChatDialogOpen(false);
        if (isMobile) {
          setShowConversationListMobile(false);
        }
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
    <div className={cn("flex h-full border rounded-lg shadow-xl overflow-hidden bg-card", isMobile ? "flex-col" : "flex-row")}>
      <aside 
        className={cn(
            "border-b md:border-b-0 md:border-r bg-muted/20 dark:bg-neutral-800/30 flex flex-col transition-all duration-300 ease-in-out",
            isMobile ? (showConversationListMobile ? "w-full h-full" : "hidden") 
                     : "w-1/3 min-w-[280px] max-w-[350px] h-full"
        )}
      >
        <div className="p-3 sm:p-4 border-b">
          <h2 className="text-lg sm:text-xl font-semibold">Conversations</h2>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2 sm:mt-3 text-xs sm:text-sm" 
            onClick={openStartChatDialog}
            disabled={isLoadingUsers}
          >
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> 
            {isLoadingUsers ? "Loading Users..." : "Start New Chat"}
          </Button>
        </div>
        {isLoadingChatRooms ? (
            <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
            </div>
        ) : chatRooms.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground flex-grow flex flex-col items-center justify-center">
                <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
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

      <main 
        className={cn(
            "flex-1 flex flex-col transition-all duration-300 ease-in-out",
            isMobile ? (showConversationListMobile ? "hidden" : "w-full h-full") : "h-full"
        )}
      >
        {activeChatRoom ? (
          <MessageArea
            key={activeChatRoom.id} 
            chatRoom={activeChatRoom}
            currentUser={currentUser}
            onBack={isMobile ? handleBackToConversations : undefined}
          />
        ) : (
          !isMobile && (
            <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <MessageSquare className="w-20 h-20 sm:w-24 sm:h-24 mb-4 opacity-30" />
              <p className="text-base sm:text-lg">Select a conversation to start messaging</p>
              <p className="text-xs sm:text-sm">or start a new chat with someone from your organization.</p>
            </div>
          )
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
