// src/components/chat/MessageArea.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatRoom, ChatMessage } from '@/types';
import type { AppUser } from '@/contexts/AuthContext';
import { sendMessage, getChatRoomMessagesStream } from '@/services/chatService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface MessageAreaProps {
  chatRoom: ChatRoom;
  currentUser: AppUser;
}

export function MessageArea({ chatRoom, currentUser }: MessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoadingMessages(true);
    const unsubscribe = getChatRoomMessagesStream(chatRoom.id, (fetchedMessages) => {
      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    });
    return () => unsubscribe();
  }, [chatRoom.id]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [chatRoom.id]);
  
  const getOtherMemberName = useCallback(() => {
    if (chatRoom.type === 'private') {
        const otherMemberId = chatRoom.memberIds.find(id => id !== currentUser.id);
        return otherMemberId ? chatRoom.memberDisplayNames[otherMemberId] || 'Chat Partner' : 'Chat';
    }
    return chatRoom.name || 'Group Chat';
  }, [chatRoom, currentUser.id]);


  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUser.displayName || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(chatRoom.id, currentUser.id, currentUser.displayName, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Send Error", description: "Could not send your message.", variant: "destructive"});
    } finally {
        setIsSending(false);
        inputRef.current?.focus();
    }
  };

  const formatMessageTimestamp = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      if (isToday(date)) {
        return format(date, 'p'); // e.g., 2:30 PM
      }
      if (isYesterday(date)) {
        return `Yesterday ${format(date, 'p')}`;
      }
      return format(date, 'MMM d, p'); // e.g., Aug 15, 2:30 PM
    } catch (error) {
      console.warn("Error formatting date:", isoString, error);
      return "Invalid date";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b bg-card sticky top-0 z-10 backdrop-blur-sm">
        <h3 className="text-lg font-semibold">{getOtherMemberName()}</h3>
        {/* Add more header info like online status or group member count later */}
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-16 h-16 mb-3 opacity-50" />
                <p className="text-sm">No messages yet in this chat.</p>
                <p className="text-xs">Be the first to send a message!</p>
            </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2.5 animate-fadeInUp',
                  msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.senderId !== currentUser.id && (
                  <Avatar className="h-8 w-8">
                    {/* <AvatarImage src={sender?.photoURL} /> Future: fetch sender photo */}
                    <AvatarFallback className="bg-muted text-xs">
                      {msg.senderDisplayName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[70%] rounded-xl px-3.5 py-2.5 shadow-md text-sm leading-relaxed',
                    msg.senderId === currentUser.id
                      ? 'bg-primary text-primary-foreground rounded-br-lg'
                      : 'bg-muted text-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <p className={cn(
                      "text-xs mt-1.5 opacity-70",
                      msg.senderId === currentUser.id ? "text-right" : "text-left"
                  )}>
                    {formatMessageTimestamp(msg.createdAt)}
                  </p>
                </div>
                {msg.senderId === currentUser.id && (
                  <Avatar className="h-8 w-8">
                    {currentUser.photoURL && <AvatarImage src={currentUser.photoURL} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {currentUser.displayName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <footer className="p-3 border-t bg-card/80 backdrop-blur-sm">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isSending || isLoadingMessages}
            className="flex-1 h-10 text-sm rounded-lg transition-shadow duration-200 focus:shadow-lg"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isSending || !newMessage.trim() || isLoadingMessages} className="rounded-lg h-10 w-10">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </footer>
    </div>
  );
}
