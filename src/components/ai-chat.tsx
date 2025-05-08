'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { chatWithAI, type ChatInput, type ChatOutput } from '@/ai/flows/chat-flow'; // Import the actual Genkit flow
import { cn } from '@/lib/utils';


interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string | React.ReactNode; // Allow ReactNode for potential rich content
  timestamp: number;
}

export function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if(scrollViewport) {
        scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

   // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: trimmedInput,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add a placeholder AI message for a more immediate feel
    const thinkingMessageId = `msg-${Date.now()}-ai-thinking`;
    const thinkingMessage: Message = {
        id: thinkingMessageId,
        sender: 'ai',
        text: (
            <div className="flex items-center space-x-2">
                <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/30 animate-pulse" />
                <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/30 animate-pulse delay-100" />
                <Skeleton className="h-3 w-3 rounded-full bg-muted-foreground/30 animate-pulse delay-200" />
            </div>
        ),
        timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, thinkingMessage]);


    try {
      const aiInput: ChatInput = { query: trimmedInput };
      const aiResponse: ChatOutput = await chatWithAI(aiInput);

      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`, // New ID for the actual response
        sender: 'ai',
        text: aiResponse.response,
        timestamp: Date.now(),
      };
      // Replace the thinking message with the actual response
      setMessages((prev) => prev.map(msg => msg.id === thinkingMessageId ? aiMessage : msg));
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`, // New ID for the error
        sender: 'ai',
        text: (
            <span className="text-destructive">
                Sorry, I encountered an error: {errorMessageText}
            </span>
        ),
        timestamp: Date.now(),
      };
      // Replace the thinking message with the error message
      setMessages((prev) => prev.map(msg => msg.id === thinkingMessageId ? errorMessage : msg));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-10rem)] w-full max-w-3xl mx-auto shadow-2xl overflow-hidden rounded-xl"> {/* Increased max-w, shadow, rounded */}
      <CardHeader className="border-b bg-card/80 backdrop-blur-md"> {/* Slightly more blur */}
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-6 w-6 text-primary" /> AI Assistant (Jack)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4 pt-6" ref={scrollAreaRef}> {/* Added pt-6 for more space from header */}
          <div className="space-y-6"> {/* Increased space-y */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-3 animate-fadeInUp',
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.sender === 'ai' && (
                  <Avatar className="h-9 w-9 border-2 border-primary/50 shadow-md"> {/* Enhanced AI avatar */}
                     <AvatarFallback className="bg-primary/10"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl p-3.5 text-sm shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.02]', // Increased rounding, padding, shadow, added hover effect
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-lg' 
                      : 'bg-muted text-muted-foreground rounded-bl-lg dark:bg-neutral-700 dark:text-neutral-100'
                  )}
                >
                  {typeof message.text === 'string' ? (
                     <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p> /* Added leading-relaxed */
                  ) : (
                    message.text
                  )}
                </div>
                 {message.sender === 'user' && (
                  <Avatar className="h-9 w-9 border shadow-md"> {/* Enhanced User avatar */}
                     <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && messages.length > 0 && messages[messages.length-1].text && typeof messages[messages.length-1].text !== 'string' && (
              // This ensures the loading skeleton for "thinking" is removed once a real message (even an error) replaces it.
              // The actual thinking message is handled by the specific logic in handleSendMessage.
              // This is a fallback / visual cue if the last message IS the loading dots.
              <div className="flex items-start gap-3 justify-start animate-fadeIn">
                <Avatar className="h-9 w-9 border-2 border-primary/50 shadow-md">
                    <AvatarFallback className="bg-primary/10 "><Bot className="h-5 w-5 animate-pulse text-primary" /></AvatarFallback>
                </Avatar>
                <div className="bg-muted dark:bg-neutral-700 rounded-2xl p-3.5 shadow-lg">
                    <Skeleton className="h-4 w-24 bg-muted-foreground/20 dark:bg-neutral-600" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-card/80 backdrop-blur-md"> {/* Slightly more blur */}
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-3"> {/* Increased space */}
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Jack about your tasks..."
            disabled={isLoading}
            className="flex-1 h-11 text-base transition-shadow duration-200 focus:shadow-xl focus:border-primary/50 rounded-lg" /* Taller input, larger text, stronger focus */
            autoComplete="off"
          />
          <Button type="submit" size="lg" disabled={isLoading || !inputValue.trim()} className="transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg"> {/* Larger button, more pronounced effects */}
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

