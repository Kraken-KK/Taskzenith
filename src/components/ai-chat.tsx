
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
  type MessageHistoryItem // Changed from ToolCallRequest due to previous simplification
} from '@/ai/flows/chat-flow';
// import { nameChatSession } from '@/ai/flows/name-chat-session-flow'; // Removed for simplification
import type { AiChatSession } from '@/types'; // AiChatSession might be unused if we revert to single history
import { useTasks } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AiChatSessionList } from './ai-chat/AiChatSessionList';
import {
  getAiChatSessionsStream,
  createAiChatSession,
  updateAiChatSession,
  deleteAiChatSession,
  getAiChatSessionMessages,
} from '@/services/aiChatService';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; // For single chat history
import { db } from '@/lib/firebase'; // For single chat history


interface DisplayMessage {
  id: string;
  sender: 'user' | 'ai' | 'system' ; // Removed 'tool_code' for simplification
  text: string | React.ReactNode;
  timestamp: number;
  // toolCalls?: ToolCallRequest[]; // Re-evaluate if needed with simplified chat-flow
}

const MAX_HISTORY_FOR_AI = 20;
// const MIN_MESSAGES_FOR_AUTONAME = 4; // No longer needed for AI naming

export function AiChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Simplified: No activeSessionId or activeSessionName for single chat history model
  // const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // const [activeSessionName, setActiveSessionName] = useState<string>("New Chat");

  // For listing multiple sessions - keep for future, but functionality might be paused
  const [savedSessions, setSavedSessions] = useState<AiChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);


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

  // Load initial/last chat history (single session model)
  useEffect(() => {
    if (currentUser && !isGuest) {
      setIsLoadingHistory(true);
      const userDocRef = doc(db, 'users', currentUser.id);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (userData.aiChatHistory && Array.isArray(userData.aiChatHistory.messages)) {
            setMessages(convertHistoryItemsToDisplayMessages(userData.aiChatHistory.messages));
          } else {
            setMessages([]); // Start fresh if no history or malformed
          }
        } else {
          setMessages([]);
        }
      }).catch(error => {
        console.error("Error loading single chat history:", error);
        setMessages([]);
      }).finally(() => {
        setIsLoadingHistory(false);
        scrollToBottom();
      });
    } else {
      // For guests, chat is ephemeral or could use localStorage if needed later
      setMessages([]);
      setIsLoadingHistory(false);
    }
  }, [currentUser, isGuest]);


  // Fetch list of saved sessions (for sidebar, if we re-enable multi-session browsing)
  // This part is currently not fully utilized if we stick to single-session view
  useEffect(() => {
    if (currentUser && !isGuest) {
      setIsLoadingSessions(true);
      const unsubscribe = getAiChatSessionsStream(currentUser.id, (fetchedSessions) => {
        setSavedSessions(fetchedSessions);
        setIsLoadingSessions(false);
      });
      return () => unsubscribe();
    } else {
      setSavedSessions([]);
      setIsLoadingSessions(false);
    }
  }, [currentUser, isGuest]);


  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const convertDisplayMessagesToHistoryItems = (displayMessages: DisplayMessage[]): MessageHistoryItem[] => {
    return displayMessages
      .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : 'Structured AI Message' }]
      }));
  };
  
  const convertHistoryItemsToDisplayMessages = (historyItems: MessageHistoryItem[]): DisplayMessage[] => {
    return historyItems.map((item, index) => ({
      id: `hist-${Date.now()}-${index}`,
      sender: item.role === 'model' ? 'ai' : 'user',
      text: item.parts[0]?.text || '',
      timestamp: Date.now() - (historyItems.length - index) * 1000, 
    }));
  };

  // Simplified saveChatHistory for single session model
  const saveChatHistory = useCallback(async (currentDisplayMessages: DisplayMessage[]) => {
    if (!currentUser || isGuest || currentDisplayMessages.length === 0) return;

    const historyForFirestore = convertDisplayMessagesToHistoryItems(currentDisplayMessages);
    const userDocRef = doc(db, 'users', currentUser.id);

    try {
      await updateDoc(userDocRef, {
        aiChatHistory: {
          messages: historyForFirestore,
          lastUpdatedAt: serverTimestamp() 
        }
      });
    } catch (error) {
      console.error("Error saving single chat history:", error);
      // Optionally toast an error, but might be too noisy for background saves
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

    let foundTask: any | undefined; 
    let sourceColumn: any | undefined;

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
  
  // These handlers are for multi-session UI, which is currently de-emphasized
  // but kept for potential future re-integration.
  const handleSelectSession = async (sessionId: string, sessionName: string) => {
    // This would load messages for sessionId and set them to `messages`
    // For now, it's a placeholder if we're in single-session mode
    console.log("Session selected (multi-session UI placeholder):", sessionId, sessionName);
    toast({ title: "Info", description: "Multi-session browsing not fully active in this version."});
  };

  const handleNewChat = () => {
    // For single-session, this means clearing current messages and starting fresh
    setMessages([]);
    // activeSessionId = null; // Not used in single-session
    // activeSessionName = "New Chat"; // Not used in single-session
    inputRef.current?.focus();
    toast({title: "New Chat Started"});
  };

  const handleDeleteCurrentSession = async (sessionIdToDelete: string) => {
    // This would delete a specific session from the list
    // For single-session mode, this isn't directly applicable for the current view
    console.log("Delete session (multi-session UI placeholder):", sessionIdToDelete);
     if (!currentUser || !sessionIdToDelete) return;
    try {
      await deleteAiChatSession(currentUser.id, sessionIdToDelete);
      // If active session is deleted, call handleNewChat() for single-session model.
      // This might require knowing if the deleted session was somehow "active"
      // or simply clearing the current view.
      handleNewChat(); 
      toast({ title: "Chat Deleted", description: `Chat session has been deleted.` });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the chat session.", variant: "destructive"});
    }
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

    const historyForAI: MessageHistoryItem[] = convertDisplayMessagesToHistoryItems(currentMessagesWithUser)
      .slice(-MAX_HISTORY_FOR_AI);

    const aiInput: ChatInput = {
      query: trimmedInput,
      history: historyForAI,
      activeBoardContext: prepareBoardContext(),
      userPreferences: prepareUserPreferences(),
    };

    try {
      const aiResponse: ChatOutput | null = await chatWithAI(aiInput);

      let aiTextResponse: string | React.ReactNode;
      let finalToolCalls;

      if (aiResponse && typeof aiResponse.response === 'string') {
        aiTextResponse = aiResponse.response;
        finalToolCalls = aiResponse.toolCalls;
      } else {
        console.error('Invalid AI response structure from chatWithAI:', aiResponse);
        aiTextResponse = ( <span className="text-destructive"> Sorry, Jack could not process that. Please try again. (Response Error) </span> );
        finalToolCalls = undefined;
      }
      
      const aiResponseMessage: DisplayMessage = {
        id: thinkingMessageId, 
        sender: 'ai',
        text: aiTextResponse,
        timestamp: Date.now(),
        // toolCalls: finalToolCalls, // toolCalls are not directly part of DisplayMessage anymore
      };
      
      // Replace thinking message with actual response or error
      setMessages(prevMessages => 
        prevMessages.map(msg => msg.id === thinkingMessageId ? aiResponseMessage : msg)
      );
      
      // Save the updated conversation (including user and AI message)
      // The messages array passed to saveChatHistory should be the one *after* the AI response.
      const messagesToSave = [...currentMessagesWithUser.filter(msg => msg.id !== thinkingMessageId), aiResponseMessage];
      await saveChatHistory(messagesToSave);


      if (aiResponse?.taskAction) {
        handleTaskAction(aiResponse.taskAction);
      }
      if (aiResponse?.preferenceUpdate) {
        handlePreferenceUpdate(aiResponse.preferenceUpdate);
      }
      // Tool call display simplified, as `toolCalls` isn't on DisplayMessage.
      // Could add a system message if `aiResponse.toolCalls` exists.
      if (aiResponse?.toolCalls && aiResponse.toolCalls.length > 0) {
         addSystemMessage(`Jack attempted to use a tool: ${aiResponse.toolCalls[0].name}.`);
      }


    } catch (error) {
      console.error('Error fetching AI response in AiChat.tsx:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorDisplayMessage: DisplayMessage = {
        id: thinkingMessageId,
        sender: 'ai',
        text: ( <span className="text-destructive"> Sorry, Jack encountered an issue: {errorMessageText} </span> ),
        timestamp: Date.now(),
      };
      setMessages(prevMessages => 
        prevMessages.map(msg => msg.id === thinkingMessageId ? errorDisplayMessage : msg)
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      scrollToBottom();
    }
  };


  return (
    <Card className="flex h-full w-full shadow-2xl overflow-hidden rounded-xl">
      {/* Session List Sidebar - Kept for potential future re-integration */}
      <div className="w-1/3 min-w-[250px] max-w-[320px] border-r border-border dark:border-neutral-700 hidden md:flex flex-col">
        <AiChatSessionList
          sessions={savedSessions} // This will be empty or not fully functional if multi-session is paused
          currentUserId={currentUser?.id || null}
          activeSessionId={null} // No active session ID in single-session mode
          onSelectSession={handleSelectSession} // Placeholder
          onNewChat={handleNewChat} // Clears current chat
          onDeleteSession={handleDeleteCurrentSession} // Placeholder
          isLoadingSessions={isLoadingSessions}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        <CardHeader className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-10">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-6 w-6 text-primary" /> AI Assistant (Jack)
            {/* activeSessionName removed for single-session simplicity */}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
            {isLoadingHistory ? (
                 <div className="flex flex-col h-full w-full items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading chat messages...</p>
                </div>
            ) : (
          <ScrollArea className="h-full p-4 pt-6" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-end gap-3 animate-fadeInUp',
                    message.sender === 'user' ? 'justify-end' : 'justify-start',
                    message.sender === 'system' && 'justify-center'
                    // message.sender === 'tool_code' && 'justify-center my-2' // tool_code sender removed
                  )}
                >
                  {message.sender === 'ai' && message.sender !== 'system' && ( // tool_code sender removed
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
                          // : message.sender === 'tool_code' // tool_code sender removed
                          // ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg w-full sm:w-auto'
                          : 'bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                      )}
                      >
                      {/* {message.sender === 'tool_code' && typeof message.text === 'string' ? ( // tool_code sender removed
                          <pre className="whitespace-pre-wrap text-xs p-2 bg-black/5 dark:bg-white/5 rounded">
                              <code>{message.text}</code>
                          </pre>
                      ) : null} */}
                      {typeof message.text === 'string' ? ( // Simplified: always treat text as string or ReactNode
                          <p className="whitespace-pre-wrap leading-relaxed break-words">{message.text}</p>
                      ) : (
                          message.text
                      )}
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
            )}
        </CardContent>
        <CardFooter className="p-3 sm:p-4 border-t bg-card/80 backdrop-blur-md sticky bottom-0 z-10">
          <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 sm:space-x-3">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Jack..."
              disabled={isLoading || isLoadingHistory}
              className="flex-1 h-10 sm:h-11 text-sm sm:text-base transition-shadow duration-200 focus:shadow-xl focus:border-primary/50 rounded-lg"
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg" disabled={isLoading || isLoadingHistory || !inputValue.trim()} >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardFooter>
      </div>
    </Card>
  );
}

