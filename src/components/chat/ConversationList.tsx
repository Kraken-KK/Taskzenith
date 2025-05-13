// src/components/chat/ConversationList.tsx
'use client';

import type { ChatRoom } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { User } from 'lucide-react';

interface ConversationListProps {
  chatRooms: ChatRoom[];
  currentUserId: string;
  onSelectChatRoom: (room: ChatRoom) => void;
  activeChatRoomId?: string | null;
}

export function ConversationList({ 
  chatRooms, 
  currentUserId, 
  onSelectChatRoom,
  activeChatRoomId 
}: ConversationListProps) {

  const getOtherMemberInfo = (room: ChatRoom) => {
    if (room.type === 'private') {
      const otherMemberId = room.memberIds.find(id => id !== currentUserId);
      if (otherMemberId && room.memberDisplayNames) {
        return {
          id: otherMemberId,
          displayName: room.memberDisplayNames[otherMemberId] || 'Unknown User',
        };
      }
    }
    return { id: '', displayName: room.name || 'Group Chat' }; 
  };

  return (
    <ScrollArea className="flex-1">
      <nav className="p-2 space-y-1">
        {chatRooms.map((room) => {
          const otherMember = getOtherMemberInfo(room);
          const isActive = room.id === activeChatRoomId;
          
          let lastMessageTime = '';
          if (room.lastMessageAt) {
            try {
                lastMessageTime = formatDistanceToNowStrict(new Date(room.lastMessageAt), { addSuffix: true });
            } catch (e) {
                console.warn("Could not parse lastMessageAt for room: ", room.id, room.lastMessageAt);
                lastMessageTime = "Invalid date";
            }
          }

          return (
            <button
              key={room.id}
              onClick={() => onSelectChatRoom(room)}
              className={cn(
                'w-full flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-lg text-left transition-colors duration-150 ease-in-out',
                isActive
                  ? 'bg-primary/15 text-primary font-medium shadow-sm'
                  : 'hover:bg-muted/60 dark:hover:bg-neutral-700/60',
                !isActive && 'text-foreground'
              )}
            >
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-transparent group-hover:border-primary/30 transition-colors shrink-0">
                <AvatarFallback className={cn("text-sm sm:text-base", isActive ? 'bg-primary/20' : 'bg-muted')}>
                    {otherMember.displayName.charAt(0).toUpperCase() || <User className="h-4 w-4 sm:h-5 sm:w-5"/>}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold truncate">{otherMember.displayName}</h3>
                    {room.lastMessageAt && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap ml-1">
                            {lastMessageTime}
                        </span>
                    )}
                </div>
                <p className={cn(
                    "text-xs truncate",
                    isActive ? "text-primary/80" : "text-muted-foreground"
                )}>
                  {room.lastMessageSenderId === currentUserId ? "You: " : ""}
                  {room.lastMessageText || 'No messages yet...'}
                </p>
              </div>
            </button>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
