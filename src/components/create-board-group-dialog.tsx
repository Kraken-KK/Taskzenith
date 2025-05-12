// src/components/create-board-group-dialog.tsx
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
import { FolderPlus } from 'lucide-react';

interface CreateBoardGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function CreateBoardGroupDialog({ open, onOpenChange, children }: CreateBoardGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const { addBoardGroup } = useTasks();

  const handleCreateGroup = () => {
    if (groupName.trim()) {
      addBoardGroup(groupName.trim());
      setGroupName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Board Group</DialogTitle>
          <DialogDescription>
            Enter a name for your new board group. You can add boards to this group later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="group-name" className="text-right">
              Name
            </Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Work Projects"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateGroup} disabled={!groupName.trim()}>
            <FolderPlus className="mr-2 h-4 w-4" /> Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
