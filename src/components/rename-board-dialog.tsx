
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/contexts/TaskContext';
import { Edit3 } from 'lucide-react';
import type { Board } from '@/types';

interface RenameBoardDialogProps {
  board: Board | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameBoardDialog({ board, open, onOpenChange }: RenameBoardDialogProps) {
  const [boardName, setBoardName] = useState('');
  const { updateBoardName } = useTasks();

  useEffect(() => {
    if (board) {
      setBoardName(board.name);
    }
  }, [board]);

  const handleRenameBoard = () => {
    if (board && boardName.trim()) {
      updateBoardName(board.id, boardName.trim());
      onOpenChange(false);
    }
  };

  if (!board) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Board</DialogTitle>
          <DialogDescription>
            Enter a new name for your board &quot;{board.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="board-name-rename" className="text-right">
              New Name
            </Label>
            <Input
              id="board-name-rename"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleRenameBoard} disabled={!boardName.trim() || boardName.trim() === board.name}>
            <Edit3 className="mr-2 h-4 w-4" /> Save Name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
