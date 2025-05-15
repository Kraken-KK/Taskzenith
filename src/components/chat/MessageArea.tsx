
// src/components/chat/MessageArea.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatRoom, ChatMessage, Poll, FileInfo } from '@/types';
import type { AppUser } from '@/contexts/AuthContext';
import { sendMessage, getChatRoomMessagesStream, voteOnPoll } from '@/services/chatService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Loader2, MessageSquare, ArrowLeft, BarChart3, CheckCircle, Paperclip, FileText, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CreatePollDialog } from './CreatePollDialog'; 
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface MessageAreaProps {
  chatRoom: ChatRoom;
  currentUser: AppUser;
  onBack?: () => void; // For mobile navigation
}

export function MessageArea({ chatRoom, currentUser, onBack }: MessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [votingState, setVotingState] = useState<{ [messageId: string]: boolean }>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isCreatePollDialogOpen, setIsCreatePollDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);


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
        setTimeout(() => { 
            scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
        }, 100);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // This function will be kept for future implementation but the button triggering it will be disabled.
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setSelectedFilePreview(null);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>, pollData?: Poll) => {
    e?.preventDefault();
    const textToSend = newMessage.trim();
    // File sending logic is effectively disabled since the button is disabled.
    // We keep selectedFile check for completeness if it were enabled.
    if ((!textToSend && !pollData && !selectedFile) || !currentUser.displayName || isSending) return;

    setIsSending(true);
    let fileInfoToSend: FileInfo | undefined = undefined;
    // This part will not be reached if the button is disabled
    if (selectedFile) {
      fileInfoToSend = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        placeholderUrl: selectedFile.type.startsWith('image/') ? selectedFilePreview || undefined : undefined,
      };
    }

    try {
      await sendMessage(chatRoom.id, currentUser.id, currentUser.displayName, textToSend, pollData, fileInfoToSend);
      setNewMessage('');
      setSelectedFile(null);
      setSelectedFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Send Error", description: "Could not send your message.", variant: "destructive"});
    } finally {
        setIsSending(false);
        inputRef.current?.focus();
    }
  };
  
  const handleCreatePollSubmit = (poll: Poll, pollMessageText: string) => {
    // Pass empty text if only poll message is there, or if text is empty, the poll question will be used by sendMessage
    const textForMessage = newMessage.trim() || (pollMessageText !== poll.question ? pollMessageText : '');
    setNewMessage(textForMessage); // Set newMessage to ensure it's sent if pollMessageText is used
    handleSendMessage(undefined, poll); 
  };

  const handleVote = async (messageId: string, optionId: string) => {
    if (!currentUser) return;
    setVotingState(prev => ({ ...prev, [messageId]: true }));
    try {
      await voteOnPoll(chatRoom.id, messageId, optionId, currentUser.id);
    } catch (error) {
      console.error("Error voting on poll:", error);
      toast({title: "Vote Error", description: `Could not cast your vote. ${error instanceof Error ? error.message : ''}`, variant: "destructive"});
    } finally {
      setVotingState(prev => ({ ...prev, [messageId]: false }));
    }
  };

  const formatMessageTimestamp = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      if (isToday(date)) {
        return format(date, 'p'); 
      }
      if (isYesterday(date)) {
        return `Yesterday, ${format(date, 'p')}`;
      }
      return format(date, 'MMM d, p'); 
    } catch (error) {
      console.warn("Error formatting date:", isoString, error);
      return "Invalid date";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const PollDisplay = ({ msg }: { msg: ChatMessage }) => {
    if (!msg.poll) return null;
    const poll = msg.poll;
    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voterIds?.length || 0), 0);
    const userVote = poll.options.find(opt => opt.voterIds?.includes(currentUser.id));
    const isCurrentlyVoting = votingState[msg.id];

    return (
        <div className="mt-2 p-3 border rounded-md bg-background/30 dark:bg-neutral-700/50">
            <p className="font-semibold text-sm mb-2">{poll.question}</p>
            <div className="space-y-2.5">
                {poll.options.map(option => {
                    const voteCount = option.voterIds?.length || 0;
                    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const hasVotedForThis = userVote?.id === option.id;
                    return (
                        <div key={option.id}>
                            <div className="flex justify-between items-center text-xs mb-0.5">
                                <span className="truncate mr-2">{option.text}</span>
                                <span className="whitespace-nowrap">{voteCount} vote{voteCount === 1 ? '' : 's'} ({percentage.toFixed(0)}%)</span>
                            </div>
                            <Progress value={percentage} className="h-2 mb-1.5" />
                            <Button 
                                variant={hasVotedForThis ? "default" : "outline"} 
                                size="sm" 
                                className="w-full text-xs h-7"
                                onClick={() => handleVote(msg.id, option.id)}
                                disabled={isCurrentlyVoting || (!!userVote && !hasVotedForThis)} // Disable if voting or already voted for another option. Allow changing vote.
                            >
                                {isCurrentlyVoting && hasVotedForThis ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : 
                                 hasVotedForThis && <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                }
                                {hasVotedForThis ? "Voted" : "Vote"}
                            </Button>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2.5">
                Poll created by {msg.senderId === currentUser.id ? "You" : msg.senderDisplayName || "User"} on {formatMessageTimestamp(poll.createdAt)}.
            </p>
        </div>
    );
  };

  const FileDisplay = ({ msg }: { msg: ChatMessage }) => {
    if (!msg.fileInfo) return null;
    const { name, type, size, placeholderUrl } = msg.fileInfo;

    return (
      <div className="mt-2 p-3 border rounded-md bg-background/40 dark:bg-neutral-700/60">
        <div className="flex items-center gap-2 mb-1">
          {type.startsWith('image/') && placeholderUrl ? (
            <ImageIcon className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <p className="font-medium text-sm truncate flex-1">{name}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {type} - {formatFileSize(size)}
        </p>
        {type.startsWith('image/') && placeholderUrl && (
          <div className="mt-2 max-w-xs max-h-48 overflow-hidden rounded">
            <Image
              src={placeholderUrl}
              alt={`Preview of ${name}`}
              width={200}
              height={200}
              className="object-contain w-full h-full"
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
            File shared by {msg.senderId === currentUser.id ? "You" : msg.senderDisplayName || "User"}.
            <br/> (Note: P2P transfer not yet implemented. This is a metadata placeholder.)
        </p>
      </div>
    );
  };


  return (
    <div className="flex flex-col h-full">
      <header className="p-3 sm:p-4 border-b bg-card sticky top-0 z-10 backdrop-blur-sm flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-1 h-8 w-8 sm:h-9 sm:w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to conversations</span>
          </Button>
        )}
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
           <AvatarFallback className="bg-muted text-xs sm:text-sm">
            {getOtherMemberName().charAt(0).toUpperCase() || <User className="h-4 w-4"/>}
           </AvatarFallback>
        </Avatar>
        <h3 className="text-base sm:text-lg font-semibold truncate">{getOtherMemberName()}</h3>
      </header>

      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollAreaRef}>
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 mb-3 opacity-50" />
                <p className="text-sm sm:text-base">No messages yet in this chat.</p>
                <p className="text-xs sm:text-sm">Be the first to send a message!</p>
            </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2 sm:gap-2.5 animate-fadeInUp',
                  msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.senderId !== currentUser.id && (
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 self-start">
                    <AvatarFallback className="bg-muted text-xs">
                      {msg.senderDisplayName?.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[75%] sm:max-w-[70%] rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-md text-sm leading-relaxed break-words',
                    msg.senderId === currentUser.id
                      ? 'bg-primary text-primary-foreground rounded-br-lg'
                      : 'bg-muted text-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                  )}
                >
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.poll && <PollDisplay msg={msg} />}
                  {msg.fileInfo && <FileDisplay msg={msg} />}
                  <p className={cn(
                      "text-[10px] sm:text-xs mt-1 sm:mt-1.5 opacity-70",
                      msg.senderId === currentUser.id ? "text-right" : "text-left"
                  )}>
                    {formatMessageTimestamp(msg.createdAt)}
                  </p>
                </div>
                {msg.senderId === currentUser.id && (
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 self-start">
                    {currentUser.photoURL && <AvatarImage src={currentUser.photoURL} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {currentUser.displayName?.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {selectedFilePreview && selectedFile?.type.startsWith('image/') && (
        <div className="p-2 border-t bg-card/80">
          <div className="flex items-center gap-2">
            <Image src={selectedFilePreview} alt="Selected preview" width={48} height={48} className="rounded object-cover h-12 w-12" />
            <div className="text-xs text-muted-foreground truncate flex-1">
              <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
              {selectedFile.type} - {formatFileSize(selectedFile.size)}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedFile(null); setSelectedFilePreview(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {selectedFile && !selectedFile.type.startsWith('image/') && (
         <div className="p-2 border-t bg-card/80">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="text-xs text-muted-foreground truncate flex-1">
              <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
              {selectedFile.type} - {formatFileSize(selectedFile.size)}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}


      <footer className="p-2 sm:p-3 border-t bg-card/80 backdrop-blur-sm sticky bottom-0 z-10">
        <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
          <CreatePollDialog
            open={isCreatePollDialogOpen}
            onOpenChange={setIsCreatePollDialogOpen}
            onSubmit={handleCreatePollSubmit}
          >
            <Button variant="ghost" size="icon" type="button" className="rounded-lg h-9 w-9 sm:h-10 sm:w-10 shrink-0 text-muted-foreground hover:text-primary">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Create Poll</span>
            </Button>
          </CreatePollDialog>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" disabled />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 {/* The Button component itself needs to be focusable for TooltipTrigger if it's disabled.
                     A common workaround is to wrap the disabled button in a span or div if direct focus isn't working.
                     However, ShadCN's TooltipTrigger often handles this. Let's try direct first.
                  */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  type="button" 
                  className="rounded-lg h-9 w-9 sm:h-10 sm:w-10 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => { 
                    // fileInputRef.current?.click(); // This line is commented out to keep the button disabled
                    toast({ title: "File Sharing", description: "Psst! File sharing is brewing and will arrive in a future update!", duration: 4000 });
                  }}
                  disabled // Explicitly disable the button
                  title="Attach file (Coming soon!)"
                >
                  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sr-only">Attach file</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                <p>Our digital carrier pigeons are still in training for file delivery. 🚀 Coming soon!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>


          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isSending || isLoadingMessages}
            className="flex-1 h-9 sm:h-10 text-sm rounded-lg transition-shadow duration-200 focus:shadow-lg"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !selectedFile) || isLoadingMessages} className="rounded-lg h-9 w-9 sm:h-10 sm:w-10 shrink-0">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </footer>
    </div>
  );
}

