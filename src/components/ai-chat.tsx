
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, AlertTriangle, Loader2 } from 'lucide-react'; // Added Loader2
import { Skeleton } from '@/components/ui/skeleton';
import { 
  chatWithAI, 
  type ChatInput, 
  type ChatOutput, 
  type MessageHistoryItem,
  type BoardContextTask,
  type UserPreferences,
  type TaskAction,
  type PreferenceUpdate
} from '@/ai/flows/chat-flow';
import { useTasks } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { db } from '@/lib/firebase'; // Import db
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; // Firestore imports
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Task, Column } from '@/types'; 

interface DisplayMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string | React.ReactNode;
  timestamp: number;
}

const MAX_HISTORY_LENGTH = 20; // Keep last 20 messages for AI context

export function AiChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getActiveBoard, updateTask, moveTask } = useTasks();
  const { interactionStyle, setInteractionStyle: setSettingsInteractionStyle } = useSettings();
  const { currentUser, isGuest } = useAuth(); // Get user status
  const { toast } = useToast();

  // Load chat history from Firestore for logged-in users
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
              const firestoreMessages = userData.aiChatHistory.messages as MessageHistoryItem[];
              // Convert Firestore messages to DisplayMessage format
              const displayMessages: DisplayMessage[] = firestoreMessages.map((msg, index) => ({
                id: `hist-${index}-${Date.now()}`, // Generate a display ID
                sender: msg.role === 'user' ? 'user' : 'ai',
                text: msg.parts[0]?.text || '',
                timestamp: Date.now() - (firestoreMessages.length - index) * 1000 // Approximate timestamp
              }));
              setMessages(displayMessages);
            }
          }
        } catch (error) {
          console.error("Error loading chat history:", error);
          toast({ title: "Chat History Error", description: "Could not load previous chat messages.", variant: "destructive" });
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setIsLoadingHistory(false); // No history for guests or if not logged in
      }
    };
    loadChatHistory();
  }, [currentUser, isGuest, toast]);

  // Save chat history to Firestore for logged-in users
  const saveChatHistory = useCallback(async (currentDisplayMessages: DisplayMessage[]) => {
    if (currentUser && !isGuest && currentDisplayMessages.length > 0) {
      const userDocRef = doc(db, 'users', currentUser.id);
      // Convert DisplayMessages back to MessageHistoryItem for Firestore
      const historyForFirestore: MessageHistoryItem[] = currentDisplayMessages
        .filter(msg => msg.sender === 'user' || msg.sender === 'ai') // Only save user and AI messages
        .slice(-MAX_HISTORY_LENGTH * 2) // Keep a reasonable amount of full history for storage, AI gets less
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: typeof msg.text === 'string' ? msg.text : 'Structured AI Message' }]
        }));
      
      try {
        // Check if user document exists, create if not (should be handled by AuthContext, but as a fallback)
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            await updateDoc(userDocRef, { 
                'aiChatHistory.messages': historyForFirestore 
            });
        } else {
            // This is a fallback, user doc should ideally exist.
            await setDoc(userDocRef, { 
                aiChatHistory: { messages: historyForFirestore } 
            }, { merge: true });
        }
      } catch (error) {
        console.error("Error saving chat history:", error);
        // Don't toast every time, could be annoying. Log is sufficient.
      }
    }
  }, [currentUser, isGuest]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if(scrollViewport) {
        scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const prepareBoardContext = (): ChatInput['activeBoardContext'] => {
    const activeBoard = getActiveBoard();
    if (!activeBoard) return undefined;

    const tasks: BoardContextTask[] = activeBoard.columns.flatMap(col =>
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
  
  const prepareUserPreferences = (): UserPreferences | undefined => {
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
      foundTask = col.tasks.find(t => t.content.toLowerCase() === action.taskIdentifier.toLowerCase() || t.id === action.taskIdentifier);
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
      moveTask(foundTask.id, sourceColumn.id, targetColumn.id, false); // Assuming isBetaMode false for this generic action
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
      setSettingsInteractionStyle(update.styleValue); // Use the setter from SettingsContext
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

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
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
    }
    setMessages((prev) => [...prev, thinkingMessage]);

    const historyForAI: MessageHistoryItem[] = updatedMessages
      .filter(msg => msg.id !== thinkingMessageId && (msg.sender === 'user' || msg.sender === 'ai')) 
      .slice(-MAX_HISTORY_LENGTH) // Send only the last N messages to AI
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : 'System message or UI element.' }]
      }));
    
    const aiInput: ChatInput = { 
      query: trimmedInput, 
      history: historyForAI.slice(0, -1), 
      activeBoardContext: prepareBoardContext(),
      userPreferences: prepareUserPreferences(),
    };

    try {
      const aiResponse: ChatOutput = await chatWithAI(aiInput);

      const aiMessage: DisplayMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: aiResponse.response,
        timestamp: Date.now(),
      };
      
      const finalMessages = updatedMessages.map(msg => msg.id === thinkingMessageId ? aiMessage : msg);
      if(!updatedMessages.find(m => m.id === thinkingMessageId)){ // if thinking message was removed by fast reply
          finalMessages.push(aiMessage);
      } else {
         finalMessages.splice(finalMessages.findIndex(m => m.id === thinkingMessageId), 1, aiMessage);
      }
      
      setMessages(finalMessages);
      await saveChatHistory(finalMessages); // Save history after AI response

      if (aiResponse.taskAction) {
        handleTaskAction(aiResponse.taskAction);
      }
      if (aiResponse.preferenceUpdate) {
        handlePreferenceUpdate(aiResponse.preferenceUpdate);
      }

    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorDisplayMessage: DisplayMessage = {
        id: `msg-${Date.now()}-error`,
        sender: 'ai',
        text: (
            <span className="text-destructive">
                Sorry, Jack encountered an issue: {errorMessageText}
            </span>
        ),
        timestamp: Date.now(),
      };
      setMessages((prev) => prev.map(msg => msg.id === thinkingMessageId ? errorDisplayMessage : msg));
      await saveChatHistory(messages.map(msg => msg.id === thinkingMessageId ? errorDisplayMessage : msg));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  if (isLoadingHistory) {
    return (
      <Card className="flex flex-col h-full max-h-[calc(100vh-10rem)] w-full shadow-2xl overflow-hidden rounded-xl">
        <CardHeader className="border-b bg-card/80 backdrop-blur-md">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-6 w-6 text-primary" /> AI Assistant (Jack)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading chat history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-10rem)] w-full shadow-2xl overflow-hidden rounded-xl">
      <CardHeader className="border-b bg-card/80 backdrop-blur-md">
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
                  message.sender === 'system' && 'justify-center'
                )}
              >
                {message.sender === 'ai' && (
                  <Avatar className="h-9 w-9 border-2 border-primary/50 shadow-md">
                     <AvatarFallback className="bg-primary/10"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
                 {message.sender === 'system' && (
                   <div className="w-full flex justify-center">
                    <div className="max-w-[80%] text-xs text-muted-foreground bg-muted/50 p-2 rounded-md shadow-sm flex items-center gap-2">
                       <AlertTriangle className="h-4 w-4 text-amber-500" />
                       <span>{message.text}</span>
                    </div>
                   </div>
                )}
                {message.sender !== 'system' && (
                    <div
                    className={cn(
                        'max-w-[80%] rounded-2xl p-3.5 text-sm shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.01]',
                        message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-lg' 
                        : 'bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                    )}
                    >
                    {typeof message.text === 'string' ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    ) : (
                        message.text
                    )}
                    </div>
                )}
                 {message.sender === 'user' && (
                  <Avatar className="h-9 w-9 border shadow-md">
                     <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
             {isLoading && messages.length > 0 && messages[messages.length -1].sender !== 'ai' &&  ( // Show thinking indicator if last message isn't AI and loading
                <div className="flex items-end gap-3 justify-start animate-fadeInUp">
                     <Avatar className="h-9 w-9 border-2 border-primary/50 shadow-md">
                         <AvatarFallback className="bg-primary/10"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                     </Avatar>
                     <div className="max-w-[80%] rounded-2xl p-3.5 text-sm shadow-lg bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100">
                        <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Jack is thinking...</span>
                        </div>
                     </div>
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-card/80 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-3">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Jack about your tasks or preferences..."
            disabled={isLoading}
            className="flex-1 h-11 text-base transition-shadow duration-200 focus:shadow-xl focus:border-primary/50 rounded-lg"
            autoComplete="off"
          />
          <Button type="submit" size="lg" disabled={isLoading || !inputValue.trim()} className="transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg">
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
