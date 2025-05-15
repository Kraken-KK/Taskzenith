
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
import type { MessageHistoryItem, AiChatSession, BoardContextTask as BoardContextTaskType } from '@/types';
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
import { formatISO } from 'date-fns';


interface DisplayMessage {
  id: string;
  sender: 'user' | 'ai' | 'system' ;
  text: string | React.ReactNode;
  timestamp: number;
}

const MAX_HISTORY_FOR_AI = 20; 
const MIN_MESSAGES_FOR_NEW_SESSION_SAVE = 1; 

export function AiChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); 

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState<string>("New Chat");

  const [savedSessions, setSavedSessions] = useState<AiChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true); 


  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getActiveBoard, updateTask, moveTask, addTask: addBoardTask } = useTasks();
  const { interactionStyle, setInteractionStyle: setSettingsInteractionStyle } = useSettings();
  const { currentUser, isGuest } = useAuth();
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      setTimeout(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }, 150); 
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch list of saved sessions
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
      handleNewChat();
    }
  }, [currentUser, isGuest]);

  const convertDisplayMessagesToHistoryItems = useCallback((displayMessages: DisplayMessage[]): MessageHistoryItem[] => {
    return displayMessages
      .filter(msg => (msg.sender === 'user' || msg.sender === 'ai') && typeof msg.text === 'string')
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : 'Structured AI Message' }]
      }));
  }, []);

  const convertHistoryItemsToDisplayMessages = useCallback((historyItems: MessageHistoryItem[]): DisplayMessage[] => {
    return historyItems.map((item, index) => ({
      id: `hist-${Date.now()}-${index}-${Math.random()}`, 
      sender: item.role === 'model' ? 'ai' : 'user',
      text: item.parts[0]?.text || '',
      timestamp: Date.now() - (historyItems.length - index) * 1000,
    }));
  }, []);

  const saveOrUpdateSession = useCallback(async (historyToSave: MessageHistoryItem[]) => {
    if (!currentUser || isGuest || historyToSave.length === 0) return;

    const historyForFirestore = historyToSave; 

    if (historyForFirestore.length === 0 && !activeSessionId) return;

    if (activeSessionId) {
      await updateAiChatSession(currentUser.id, activeSessionId, historyForFirestore, activeSessionName);
    } else {
      
      const userMessagesInHistory = historyForFirestore.filter(m => m.role === 'user');
      if (userMessagesInHistory.length >= MIN_MESSAGES_FOR_NEW_SESSION_SAVE) {
        let newSessionName = "New Chat";
        const firstUserMessagePart = userMessagesInHistory[0]?.parts[0]?.text;
        if (firstUserMessagePart && firstUserMessagePart.trim() !== '') {
          const text = firstUserMessagePart.trim();
          newSessionName = text.split(' ').slice(0, 5).join(' ') + (text.split(' ').length > 5 ? '...' : '');
        } else {
          newSessionName = `Chat - ${new Date().toLocaleDateString()}`;
        }

        const newId = await createAiChatSession(currentUser.id, newSessionName, historyForFirestore);
        if (newId) {
          setActiveSessionId(newId);
          setActiveSessionName(newSessionName);
        }
      }
    }
  }, [currentUser, isGuest, activeSessionId, activeSessionName]);


  const prepareBoardContext = (): ChatInput['activeBoardContext'] => {
    const currentActiveBoard = getActiveBoard();
    if (!currentActiveBoard) return undefined;

    const tasks = currentActiveBoard.columns.flatMap(col =>
      col.tasks.map(task => {
        const taskForAI: Partial<BoardContextTaskType> & { id: string; content: string; statusTitle: string } = {
          id: task.id,
          content: task.content,
          statusTitle: col.title,
        };
        if (task.priority) {
          taskForAI.priority = task.priority;
        }
        // Only include deadline if it's a non-null, non-empty string (valid ISO string)
        if (task.deadline && typeof task.deadline === 'string' && task.deadline.trim() !== '') {
          taskForAI.deadline = task.deadline;
        }
        return taskForAI as BoardContextTaskType; // Cast after conditional properties
      })
    );
    const columnNames = currentActiveBoard.columns.map(col => col.title);
    return { boardName: currentActiveBoard.name, tasks, columnNames };
  };

  const prepareUserPreferences = (): ChatInput['userPreferences'] => {
    return { interactionStyle };
  };

  const handleTaskAction = (action: TaskAction) => {
    const currentActiveBoard = getActiveBoard();
    if (!currentActiveBoard) {
      toast({ title: "Action Failed", description: "No active board selected.", variant: "destructive" });
      return;
    }

    let foundTask: any | undefined;
    let sourceColumn: any | undefined;

    for (const col of currentActiveBoard.columns) {
      foundTask = col.tasks.find(t =>
        (t.content?.toLowerCase() === action.taskIdentifier?.toLowerCase()) ||
        (t.id === action.taskIdentifier)
      );
      if (foundTask) {
        sourceColumn = col;
        break;
      }
    }

    if (action.type === 'createTask' && action.taskDetails) {
        const firstColumnId = currentActiveBoard.columns.length > 0 ? currentActiveBoard.columns[0].id : undefined;
        if (!firstColumnId) {
            toast({ title: "Task Creation Failed", description: "No columns available to add the task.", variant: "destructive" });
            addSystemMessage("I couldn't create the task because there are no columns on your board.");
            return;
        }
        const newTaskData = {
            content: action.taskDetails.content,
            priority: action.taskDetails.priority || 'medium',
            deadline: action.taskDetails.deadline,
            // description: action.taskDetails.description, // Assuming description might come from AI
        };
        addBoardTask(newTaskData, firstColumnId);
        toast({ title: "Task Created", description: `Task "${action.taskDetails.content}" created.` });
        addSystemMessage(`I've created the task: "${action.taskDetails.content}".`);
        return;
    }


    if (!foundTask || !sourceColumn) {
      toast({ title: "Task Not Found", description: `Could not find task: "${action.taskIdentifier}".`, variant: "destructive" });
      addSystemMessage(`I couldn't find the task "${action.taskIdentifier}" on your board. Could you be more specific or check the task name/ID?`);
      return;
    }

    if (action.type === 'updateStatus') {
      const targetColumn = currentActiveBoard.columns.find(col => col.title.toLowerCase() === action.targetValue?.toLowerCase());
      if (!targetColumn) {
        toast({ title: "Status Not Found", description: `Could not find status/column: "${action.targetValue}".`, variant: "destructive" });
        addSystemMessage(`I couldn't find the column "${action.targetValue}" on your board. Available columns are: ${currentActiveBoard.columns.map(c => c.title).join(', ')}.`);
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
        id: `msg-${Date.now()}-system-${Math.random()}`,
        sender: 'system',
        text,
        timestamp: Date.now(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleSelectSession = async (sessionId: string, sessionName: string) => {
    if (!currentUser || activeSessionId === sessionId) return; 
    setIsLoadingHistory(true);
    setMessages([]);
    try {
      const fetchedMessages = await getAiChatSessionMessages(currentUser.id, sessionId);
      setMessages(convertHistoryItemsToDisplayMessages(fetchedMessages));
      setActiveSessionId(sessionId);
      setActiveSessionName(sessionName);
    } catch (error) {
      console.error("Error loading session messages:", error);
      toast({title: "Load Error", description: "Could not load chat history.", variant: "destructive"});
      setMessages([]);
      setActiveSessionId(null);
      setActiveSessionName("New Chat");
    } finally {
      setIsLoadingHistory(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setActiveSessionName("New Chat");
    setMessages([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (sessionIdToDelete: string) => {
    if (!currentUser || !sessionIdToDelete) return;
    try {
      await deleteAiChatSession(currentUser.id, sessionIdToDelete);
      toast({ title: "Chat Deleted", description: `Chat session has been deleted.` });
      if (activeSessionId === sessionIdToDelete) {
        handleNewChat();
      }
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
      id: `msg-${Date.now()}-user-${Math.random()}`,
      sender: 'user',
      text: trimmedInput,
      timestamp: Date.now(),
    };

    const currentDisplayMessagesForAI = [...messages, userMessage];
    const historyForAIInput = convertDisplayMessagesToHistoryItems(currentDisplayMessagesForAI).slice(-MAX_HISTORY_FOR_AI);

    setMessages(currentDisplayMessagesForAI); 
    setInputValue('');
    setIsLoading(true);

    const thinkingMessageId = `msg-${Date.now()}-ai-thinking-${Math.random()}`;
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
    scrollToBottom();

    const aiInput: ChatInput = {
      query: trimmedInput,
      history: historyForAIInput, 
      activeBoardContext: prepareBoardContext(),
      userPreferences: prepareUserPreferences(),
    };

    try {
      const aiResponse: ChatOutput | null = await chatWithAI(aiInput);

      let aiTextResponse: string | React.ReactNode;
      let modelResponseMessagePart: { text: string };

      if (aiResponse && typeof aiResponse.response === 'string') {
        aiTextResponse = aiResponse.response;
        modelResponseMessagePart = { text: aiResponse.response };
      } else {
        console.error('Invalid AI response structure from chatWithAI:', aiResponse);
        aiTextResponse = ( <span className="text-destructive"> Sorry, Jack could not process that. Please try again. (Response Error) </span> );
        modelResponseMessagePart = { text: "Sorry, Jack could not process that. Please try again. (Response Error)" };
      }
      
      const aiResponseMessageForDisplay: DisplayMessage = {
        id: thinkingMessageId, 
        sender: 'ai',
        text: aiTextResponse,
        timestamp: Date.now(),
      };
      
      setMessages(prevMessages => 
        prevMessages.map(msg => msg.id === thinkingMessageId ? aiResponseMessageForDisplay : msg)
      );
      
      const fullHistoryForSaving: MessageHistoryItem[] = [
        ...historyForAIInput.slice(0, -1), // All history *before* the current user message
        { role: 'user', parts: [{ text: trimmedInput }] },
        { role: 'model', parts: [modelResponseMessagePart] }
      ];
      await saveOrUpdateSession(fullHistoryForSaving);


      if (aiResponse?.taskAction) {
        handleTaskAction(aiResponse.taskAction);
      }
      if (aiResponse?.preferenceUpdate) {
        handlePreferenceUpdate(aiResponse.preferenceUpdate);
      }
      if (aiResponse?.toolCalls && aiResponse.toolCalls.length > 0) {
         addSystemMessage(`Jack attempted to use a tool: ${aiResponse.toolCalls[0].name}. (Tool functionality is currently placeholder).`);
      }

    } catch (error) {
      console.error('Error fetching AI response in AiChat.tsx:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorDisplayMessageForChat: DisplayMessage = {
        id: thinkingMessageId, 
        sender: 'ai',
        text: ( <span className="text-destructive"> Sorry, Jack encountered an issue: {errorMessageText} </span> ),
        timestamp: Date.now(),
      };
      const modelErrorResponseMessagePart: { text: string } = { text: `Sorry, Jack encountered an issue: ${errorMessageText}` };
      
      setMessages(prevMessages => 
        prevMessages.map(msg => msg.id === thinkingMessageId ? errorDisplayMessageForChat : msg)
      );

      const fullHistoryForSavingOnError: MessageHistoryItem[] = [
        ...historyForAIInput.slice(0, -1),
        { role: 'user', parts: [{ text: trimmedInput }] },
        { role: 'model', parts: [modelErrorResponseMessagePart] }
      ];
      await saveOrUpdateSession(fullHistoryForSavingOnError);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      scrollToBottom();
    }
  };


  return (
    <Card className="flex h-full w-full shadow-2xl overflow-hidden rounded-xl">
      <div className="w-1/3 min-w-[250px] max-w-[320px] border-r border-border dark:border-neutral-700 hidden md:flex flex-col">
        <AiChatSessionList
          sessions={savedSessions}
          currentUserId={currentUser?.id || null}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isLoadingSessions={isLoadingSessions}
        />
      </div>

      <div className="flex flex-col flex-1">
        <CardHeader className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-10">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-6 w-6 text-primary" /> 
            {activeSessionName}
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
                  )}
                >
                  {message.sender === 'ai' && message.sender !== 'system' && ( 
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
                          : 'bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                      )}
                      >
                      {typeof message.text === 'string' ? (
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
              disabled={isLoading || isLoadingHistory || isLoadingSessions}
              className="flex-1 h-10 sm:h-11 text-sm sm:text-base transition-shadow duration-200 focus:shadow-xl focus:border-primary/50 rounded-lg"
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg" disabled={isLoading || isLoadingHistory || isLoadingSessions || !inputValue.trim()} >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardFooter>
      </div>
    </Card>
  );
}

