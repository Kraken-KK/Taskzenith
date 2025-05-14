// src/components/chat/CreatePollDialog.tsx
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, BarChart3 } from 'lucide-react';
import type { Poll } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatISO } from 'date-fns';

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (poll: Poll, pollMessageText: string) => void;
  children?: React.ReactNode;
}

const generateOptionId = () => `opt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

export function CreatePollDialog({
  open,
  onOpenChange,
  onSubmit,
  children,
}: CreatePollDialogProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: generateOptionId(), text: '' },
    { id: generateOptionId(), text: '' },
  ]);
  const [pollMessage, setPollMessage] = useState('');

  const handleAddOption = () => {
    if (options.length < 10) { // Max 10 options
      setOptions([...options, { id: generateOptionId(), text: '' }]);
    } else {
      toast({ title: "Limit Reached", description: "You can add a maximum of 10 options.", variant: "destructive"});
    }
  };

  const handleRemoveOption = (idToRemove: string) => {
    if (options.length > 2) { // Min 2 options
      setOptions(options.filter((option) => option.id !== idToRemove));
    } else {
      toast({ title: "Minimum Options", description: "A poll must have at least 2 options.", variant: "destructive"});
    }
  };

  const handleOptionChange = (id: string, newText: string) => {
    setOptions(
      options.map((option) => (option.id === id ? { ...option, text: newText } : option))
    );
  };

  const handleSubmitPoll = () => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to create a poll.", variant: "destructive"});
      return;
    }
    if (!question.trim()) {
      toast({ title: "Validation Error", description: "Poll question cannot be empty.", variant: "destructive"});
      return;
    }
    const validOptions = options.filter(opt => opt.text.trim() !== '');
    if (validOptions.length < 2) {
      toast({ title: "Validation Error", description: "Please provide at least two valid options.", variant: "destructive"});
      return;
    }

    const newPoll: Poll = {
      question: question.trim(),
      options: validOptions.map(opt => ({ id: opt.id, text: opt.text.trim(), voterIds: [] })),
      createdBy: currentUser.id,
      createdAt: formatISO(new Date()),
    };
    
    const messageForPoll = pollMessage.trim() || `Poll: ${question.trim()}`;
    onSubmit(newPoll, messageForPoll);
    
    // Reset form and close dialog
    setQuestion('');
    setPollMessage('');
    setOptions([{ id: generateOptionId(), text: '' }, { id: generateOptionId(), text: '' }]);
    onOpenChange(false);
  };
  
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
        // Reset state if dialog is closed without submitting
        setQuestion('');
        setPollMessage('');
        setOptions([{ id: generateOptionId(), text: '' }, { id: generateOptionId(), text: '' }]);
    }
    onOpenChange(isOpen);
  };


  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Create New Poll
          </DialogTitle>
          <DialogDescription>
            Ask a question and let your team vote.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="poll-message">Optional message with poll</Label>
            <Input
              id="poll-message"
              value={pollMessage}
              onChange={(e) => setPollMessage(e.target.value)}
              placeholder="e.g., Let's decide on the next feature!"
              className="mt-1"
            />
             <p className="text-xs text-muted-foreground mt-1">If empty, the poll question will be used as the message.</p>
          </div>
          <div>
            <Label htmlFor="poll-question">Poll Question</Label>
            <Textarea
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we focus on next week?"
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div>
            <Label>Options (min 2, max 10)</Label>
            <ScrollArea className="max-h-[200px] mt-1 pr-3">
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.text}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-grow"
                    />
                    {options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(option.id)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Remove option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            {options.length < 10 && (
                <Button variant="outline" size="sm" onClick={handleAddOption} className="mt-2 w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmitPoll}>Create Poll</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
