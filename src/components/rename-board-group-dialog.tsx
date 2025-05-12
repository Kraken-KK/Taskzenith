// src/components/rename-board-group-dialog.tsx
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
import type { BoardGroup } from '@/types';

interface RenameBoardGroupDialogProps {
  group: BoardGroup | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameBoardGroupDialog({ group, open, onOpenChange }: RenameBoardGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const { updateBoardGroupName } = useTasks();

  useEffect(() => {
    if (group) {
      setGroupName(group.name);
    }
  }, [group]);

  const handleRenameGroup = () => {
    if (group && groupName.trim()) {
      updateBoardGroupName(group.id, groupName.trim());
      onOpenChange(false);
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Board Group</DialogTitle>
          <DialogDescription>
            Enter a new name for your board group &quot;{group.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="group-name-rename" className="text-right">
              New Name
            </Label>
            <Input
              id="group-name-rename"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleRenameGroup} disabled={!groupName.trim() || groupName.trim() === group.name}>
            <Edit3 className="mr-2 h-4 w-4" /> Save Name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
