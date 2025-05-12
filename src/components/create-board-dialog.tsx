// src/components/create-board-dialog.tsx
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
  targetGroupId?: string | null; // Optional: ID of the group to add this board to
}

export function CreateBoardDialog({ open, onOpenChange, children, targetGroupId }: CreateBoardDialogProps) {
  const [boardName, setBoardName] = useState('');
  const { addBoard } = useTasks();

  const handleCreateBoard = () => {
    if (boardName.trim()) {
      addBoard(boardName.trim(), targetGroupId);
      setBoardName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setBoardName(''); // Reset name if dialog is closed
        onOpenChange(isOpen);
    }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Enter a name for your new Kanban board.
            {targetGroupId && <span className="block text-xs text-muted-foreground mt-1">This board will be added to the selected group.</span>}
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
