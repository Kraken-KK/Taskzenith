
// src/components/create-board-dialog.tsx
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTasks } from '@/contexts/TaskContext';
import { useAuth } from '@/contexts/AuthContext';
import { PlusCircle, User, Building } from 'lucide-react';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  targetGroupId?: string | null; // Optional: ID of the group to add this board to
}

type BoardScope = 'personal' | 'organization';

export function CreateBoardDialog({ open, onOpenChange, children, targetGroupId }: CreateBoardDialogProps) {
  const [boardName, setBoardName] = useState('');
  const [boardScope, setBoardScope] = useState<BoardScope>('personal');
  const { addBoard } = useTasks();
  const { currentUser } = useAuth();

  const canCreateOrgBoard = !!currentUser && !!currentUser.defaultOrganizationId;

  useEffect(() => {
    // If organization boards cannot be created, ensure scope is personal
    if (!canCreateOrgBoard) {
      setBoardScope('personal');
    }
  }, [canCreateOrgBoard, open]);


  const handleCreateBoard = async () => {
    if (boardName.trim()) {
      let orgIdToPass: string | null = null;
      if (boardScope === 'organization' && canCreateOrgBoard) {
        orgIdToPass = currentUser.defaultOrganizationId!;
      }
      
      await addBoard(boardName.trim(), { 
        groupId: targetGroupId, 
        organizationId: orgIdToPass 
        // teamId will be null by default unless explicitly handled later
      });
      
      setBoardName('');
      setBoardScope('personal'); // Reset scope
      onOpenChange(false);
    }
  };

  const handleOpenChangeWithReset = (isOpen: boolean) => {
    if (!isOpen) {
        setBoardName('');
        setBoardScope(canCreateOrgBoard ? 'personal' : 'personal'); // Reset to personal, or default if org possible
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeWithReset}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Enter a name for your new Kanban board and choose its scope.
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

          {currentUser && !currentUser.isGuest && ( // Only show scope for logged-in users
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Scope</Label>
              <RadioGroup
                value={boardScope}
                onValueChange={(value) => setBoardScope(value as BoardScope)}
                className="col-span-3 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="scope-personal" />
                  <Label htmlFor="scope-personal" className="font-normal flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground"/> Personal
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organization" id="scope-organization" disabled={!canCreateOrgBoard} />
                  <Label htmlFor="scope-organization" className={`font-normal flex items-center gap-1.5 ${!canCreateOrgBoard ? 'text-muted-foreground/50 cursor-not-allowed' : ''}`}>
                    <Building className="h-4 w-4 text-muted-foreground"/> Organization
                  </Label>
                </div>
                {!canCreateOrgBoard && (
                  <p className="text-xs text-muted-foreground col-span-full pl-[calc(25%+0.5rem)]">
                    To create an organization board, please set a default organization in your settings.
                  </p>
                )}
                 {boardScope === 'organization' && canCreateOrgBoard && (
                    <p className="text-xs text-muted-foreground col-span-full pl-[calc(25%+0.5rem)]">
                        Board will be created in your default organization.
                    </p>
                 )}
              </RadioGroup>
            </div>
          )}

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
