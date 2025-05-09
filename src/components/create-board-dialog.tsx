
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/contexts/TaskContext';
import { PlusCircle } from 'lucide-react';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function CreateBoardDialog({ open, onOpenChange, children }: CreateBoardDialogProps) {
  const [boardName, setBoardName] = useState('');
  const { addBoard } = useTasks();

  const handleCreateBoard = () => {
    if (boardName.trim()) {
      addBoard(boardName.trim());
      setBoardName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Enter a name for your new Kanban board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="board-name" className="text-right">
              Name
            </Label>
            <Input
              id="board-name"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Project Phoenix"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateBoard} disabled={!boardName.trim()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
