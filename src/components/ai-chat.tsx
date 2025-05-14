
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, AlertTriangle, Loader2 } from 'lucide-react';
import {
  chatWithAI,
  type ChatInput,
  type ChatOutput,
  type TaskAction,
  type PreferenceUpdate,
  type ToolCallRequest,
} from '@/ai/flows/chat-flow';
import { MessageHistoryItem } from '@/ai/schemas'; // Import from new schemas file
import { useTasks } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Task, Column } from '@/types';

interface DisplayMessage {
  id: string;
  sender: 'user' | 'ai' | 'system' | 'tool_code';
  text: string | React.ReactNode;
  timestamp: number;
  toolCalls?: ToolCallRequest[];
}

const MAX_HISTORY_LENGTH = 20; // Max messages to send to AI

export function AiChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // For initial load

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getActiveBoard, updateTask, moveTask } = useTasks();
  const { interactionStyle, setInteractionStyle: setSettingsInteractionStyle } = useSettings();
  const { currentUser, isGuest } = useAuth();
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      setTimeout(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, []);

  // Load last chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      if (currentUser && !isGuest) {
        setIsLoadingHistory(true);
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.aiChatHistory && userData.aiChatHistory.messages) {
              const historyFromFirestore: MessageHistoryItem[] = userData.aiChatHistory.messages;
              const displayMessages: DisplayMessage[] = historyFromFirestore.map((item, index) => ({
                id: `hist-${Date.now()}-${index}`,
                sender: item.role === 'model' ? 'ai' : 'user',
                text: item.parts[0]?.text || '',
                timestamp: Date.now() - (historyFromFirestore.length - index) * 1000, // Approximate timestamp
              }));
              setMessages(displayMessages);
            }
          }
        } catch (error) {
          console.error("Error loading chat history:", error);
          toast({ title: "Error", description: "Could not load previous chat.", variant: "destructive"});
        } finally {
          setIsLoadingHistory(false);
          scrollToBottom();
        }
      } else {
        setIsLoadingHistory(false); // No user or guest, no history to load
      }
    };
    // Reset messages to empty when component mounts (new chat)
    setMessages([]);
    setIsLoadingHistory(false); // Assume no history load needed if chat is new on mount
    inputRef.current?.focus();
  }, [currentUser, isGuest, toast, scrollToBottom]);


  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);


  const saveChatHistory = useCallback(async (currentDisplayMessages: DisplayMessage[]) => {
    if (currentUser && !isGuest && currentDisplayMessages.length > 0) {
      const userDocRef = doc(db, 'users', currentUser.id);
      const historyForFirestore: MessageHistoryItem[] = currentDisplayMessages
        .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
        .slice(-MAX_HISTORY_LENGTH * 2) // Keep a reasonable amount
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: typeof msg.text === 'string' ? msg.text : 'Structured AI Message' }]
        }));

      try {
        // Ensure user document and aiChatHistory field exist
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            // This should ideally be handled by AuthContext's initializeFirestoreUserData
            await setDoc(userDocRef, { aiChatHistory: { messages: historyForFirestore, lastUpdatedAt: serverTimestamp() } }, { merge: true });
        } else {
            await updateDoc(userDocRef, {
                'aiChatHistory.messages': historyForFirestore,
                'aiChatHistory.lastUpdatedAt': serverTimestamp()
            });
        }
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    }
  }, [currentUser, isGuest]);


  const prepareBoardContext = (): ChatInput['activeBoardContext'] => {
    const activeBoard = getActiveBoard();
    if (!activeBoard) return undefined;

    const tasks = activeBoard.columns.flatMap(col =>
      col.tasks.map(task => ({
        id: task.id,
        content: task.content,
        statusTitle: col.title,
        priority: task.priority,
        deadline: task.deadline,
      }))
    );
    const columnNames = activeBoard.columns.map(col => col.title);
    return { boardName: activeBoard.name, tasks, columnNames };
  };

  const prepareUserPreferences = (): ChatInput['userPreferences'] => {
    return { interactionStyle };
  };

  const handleTaskAction = (action: TaskAction) => {
    const activeBoard = getActiveBoard();
    if (!activeBoard) {
      toast({ title: "Action Failed", description: "No active board selected.", variant: "destructive" });
      return;
    }

    let foundTask: Task | undefined;
    let sourceColumn: Column | undefined;

    for (const col of activeBoard.columns) {
      foundTask = col.tasks.find(t =>
        (t.content?.toLowerCase() === action.taskIdentifier?.toLowerCase()) ||
        (t.id === action.taskIdentifier)
      );
      if (foundTask) {
        sourceColumn = col;
        break;
      }
    }

    if (!foundTask || !sourceColumn) {
      toast({ title: "Task Not Found", description: `Could not find task: "${action.taskIdentifier}".`, variant: "destructive" });
      addSystemMessage(`I couldn't find the task "${action.taskIdentifier}" on your board. Could you be more specific or check the task name/ID?`);
      return;
    }

    if (action.type === 'updateStatus') {
      const targetColumn = activeBoard.columns.find(col => col.title.toLowerCase() === action.targetValue.toLowerCase());
      if (!targetColumn) {
        toast({ title: "Status Not Found", description: `Could not find status/column: "${action.targetValue}".`, variant: "destructive" });
        addSystemMessage(`I couldn't find the column "${action.targetValue}" on your board. Available columns are: ${activeBoard.columns.map(c => c.title).join(', ')}.`);
        return;
      }
      moveTask(foundTask.id, sourceColumn.id, targetColumn.id, false);
      toast({ title: "Task Status Updated", description: `Task "${foundTask.content}" moved to "${targetColumn.title}".` });
      addSystemMessage(`Task "${foundTask.content}" has been moved to "${targetColumn.title}".`);

    } else if (action.type === 'updatePriority') {
      const newPriority = action.targetValue as 'high' | 'medium' | 'low';
      if (!['high', 'medium', 'low'].includes(newPriority)) {
          toast({ title: "Invalid Priority", description: `"${newPriority}" is not a valid priority.`, variant: "destructive" });
          addSystemMessage(`"${newPriority}" isn't a valid priority. Please use 'high', 'medium', or 'low'.`);
          return;
      }
      updateTask({ id: foundTask.id, priority: newPriority });
      toast({ title: "Task Priority Updated", description: `Priority of "${foundTask.content}" set to ${newPriority}.` });
      addSystemMessage(`Priority of "${foundTask.content}" has been set to ${newPriority}.`);
    }
  };

  const handlePreferenceUpdate = (update: PreferenceUpdate) => {
    if (update.type === 'interactionStyle' && update.styleValue) {
      setSettingsInteractionStyle(update.styleValue);
      toast({ title: "Interaction Style Updated", description: `Jack will now be more ${update.styleValue}.` });
      addSystemMessage(`Okay, I've updated my interaction style to be more ${update.styleValue}.`);
    }
  };

  const addSystemMessage = (text: string) => {
    const systemMessage: DisplayMessage = {
        id: `msg-${Date.now()}-system`,
        sender: 'system',
        text,
        timestamp: Date.now(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: DisplayMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: trimmedInput,
      timestamp: Date.now(),
    };

    const currentMessagesWithUser = [...messages, userMessage];
    setMessages(currentMessagesWithUser);
    setInputValue('');
    setIsLoading(true);

    const thinkingMessageId = `msg-${Date.now()}-ai-thinking`;
    const thinkingMessage: DisplayMessage = {
        id: thinkingMessageId,
        sender: 'ai',
        text: (
            <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Jack is thinking...</span>
            </div>
        ),
        timestamp: Date.now(),
    };
    setMessages(prev => [...prev, thinkingMessage]);

    const historyForAI: MessageHistoryItem[] = currentMessagesWithUser
      .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
      .slice(-MAX_HISTORY_LENGTH)
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : 'Structured message content.' }]
      }));

    const aiInput: ChatInput = {
      query: trimmedInput,
      history: historyForAI,
      activeBoardContext: prepareBoardContext(),
      userPreferences: prepareUserPreferences(),
    };

    try {
      const aiResponse: ChatOutput = await chatWithAI(aiInput);

      const aiResponseMessage: DisplayMessage = {
        id: thinkingMessageId, // Replace thinking message
        sender: 'ai',
        text: aiResponse.response,
        timestamp: Date.now(),
        toolCalls: aiResponse.toolCalls, // Include tool calls if any
      };

      setMessages(prevMessages => {
          const updatedMessages = prevMessages.map(msg =>
            msg.id === thinkingMessageId ? aiResponseMessage : msg
          );
          saveChatHistory(updatedMessages); // Save history after AI responds
          return updatedMessages;
      });


      if (aiResponse.taskAction) {
        handleTaskAction(aiResponse.taskAction);
      }
      if (aiResponse.preferenceUpdate) {
        handlePreferenceUpdate(aiResponse.preferenceUpdate);
      }
      // Handle tool call results if needed (not fully implemented in this simplified version)
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        // For now, just log or display a system message about tool usage
        addSystemMessage(`Jack attempted to use a tool: ${aiResponse.toolCalls[0].name}. Tool execution response is not displayed in this version.`);
      }

    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorDisplayMessage: DisplayMessage = {
        id: thinkingMessageId,
        sender: 'ai',
        text: ( <span className="text-destructive"> Sorry, Jack encountered an issue: {errorMessageText} </span> ),
        timestamp: Date.now(),
      };
      setMessages(prevMessages => {
        const updatedWithError = prevMessages.map(msg =>
          msg.id === thinkingMessageId ? errorDisplayMessage : msg
        );
        saveChatHistory(updatedWithError);
        return updatedWithError;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      scrollToBottom();
    }
  };

  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-full w-full shadow-2xl overflow-hidden rounded-xl">
      <CardHeader className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-6 w-6 text-primary" /> AI Assistant (Jack)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4 pt-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-3 animate-fadeInUp',
                  message.sender === 'user' ? 'justify-end' : 'justify-start',
                  message.sender === 'system' && 'justify-center',
                  message.sender === 'tool_code' && 'justify-center my-2'
                )}
              >
                {(message.sender === 'ai' || message.sender === 'tool_code') && message.sender !== 'system' && (
                  <Avatar className="h-9 w-9 border-2 border-primary/50 shadow-md shrink-0">
                     <AvatarFallback className="bg-primary/10"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
                 {message.sender === 'system' && (
                   <div className="w-full flex justify-center">
                    <div className="max-w-full sm:max-w-[80%] text-xs text-muted-foreground bg-muted/50 p-2 rounded-md shadow-sm flex items-center gap-2">
                       <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                       <span>{message.text}</span>
                    </div>
                   </div>
                )}
                {message.sender !== 'system' && (
                    <div
                    className={cn(
                        'max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 text-sm shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.01]',
                        message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-lg'
                        : message.sender === 'tool_code'
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg w-full sm:w-auto'
                        : 'bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                    )}
                    >
                    {message.sender === 'tool_code' && typeof message.text === 'string' && (
                        <pre className="whitespace-pre-wrap text-xs p-2 bg-black/5 dark:bg-white/5 rounded">
                            <code>{message.text}</code>
                        </pre>
                    )}
                    {message.sender !== 'tool_code' && typeof message.text === 'string' ? (
                        <p className="whitespace-pre-wrap leading-relaxed break-words">{message.text}</p>
                    ) : message.sender !== 'tool_code' ? (
                        message.text
                    ) : null}
                    </div>
                )}
                 {message.sender === 'user' && (
                  <Avatar className="h-9 w-9 border shadow-md shrink-0">
                     <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 sm:p-4 border-t bg-card/80 backdrop-blur-md sticky bottom-0 z-10">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 sm:space-x-3">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Jack..."
            disabled={isLoading}
            className="flex-1 h-10 sm:h-11 text-sm sm:text-base transition-shadow duration-200 focus:shadow-xl focus:border-primary/50 rounded-lg"
            autoComplete="off"
          />
          <Button type="submit" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg" disabled={isLoading || !inputValue.trim()} >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
