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
        // scrollViewport.scrollTop = scrollViewport.scrollHeight; // Immediate scroll
        scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' }); // Smooth scroll
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

    try {
      const aiInput: ChatInput = { query: trimmedInput };
      // Simulate API delay for testing animations
      // await new Promise(resolve => setTimeout(resolve, 1500));
      const aiResponse: ChatOutput = await chatWithAI(aiInput);

      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: aiResponse.response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessageText = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        sender: 'ai',
        text: (
            <span className="text-destructive">
                Sorry, I encountered an error: {errorMessageText}
            </span>
        ),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus(); // Re-focus input after response
    }
  };

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-10rem)] w-full max-w-2xl mx-auto shadow-xl overflow-hidden"> {/* Constrain width and height, add shadow */}
      <CardHeader className="border-b bg-card/80 backdrop-blur-sm">
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <Bot className="h-5 w-5 text-primary" /> AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-3 animate-fadeInUp', // Added animate-fadeInUp
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.sender === 'ai' && (
                  <Avatar className="h-8 w-8 border shadow-sm">
                     <AvatarFallback><Bot className="h-4 w-4 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-xl p-3 text-sm shadow-md transition-all duration-200 ease-in-out', // Rounded-xl, shadow-md
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none' // More distinct user bubble
                      : 'bg-muted text-muted-foreground rounded-bl-none dark:bg-neutral-700 dark:text-neutral-100' // More distinct AI bubble
                  )}
                >
                  {typeof message.text === 'string' ? (
                     <p className="whitespace-pre-wrap">{message.text}</p>
                  ) : (
                    message.text
                  )}
                </div>
                 {message.sender === 'user' && (
                  <Avatar className="h-8 w-8 border shadow-sm">
                     <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3 justify-start animate-fadeIn">
                <Avatar className="h-8 w-8 border">
                    <AvatarFallback><Bot className="h-4 w-4 animate-pulse text-primary" /></AvatarFallback>
                </Avatar>
                <div className="bg-muted dark:bg-neutral-700 rounded-xl p-3 shadow-md">
                    <Skeleton className="h-4 w-24 bg-muted-foreground/20 dark:bg-neutral-600" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-card/80 backdrop-blur-sm">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask the AI about your tasks..."
            disabled={isLoading}
            className="flex-1 transition-shadow duration-200 focus:shadow-md"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} className="transition-transform active:scale-90">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
