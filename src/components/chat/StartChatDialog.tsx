// src/components/chat/StartChatDialog.tsx
'use client';

import React, { useState } from 'react';
import type { AppUser } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { UserPlus, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StartChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AppUser[];
  onSelectUser: (user: AppUser) => void;
  currentUserId: string;
}

export function StartChatDialog({
  open,
  onOpenChange,
  users,
  onSelectUser,
  currentUserId,
}: StartChatDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(
    (user) =>
      user.id !== currentUserId &&
      (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> Start New Chat
          </DialogTitle>
          <DialogDescription>
            Select a user from your organization to start a private conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Input
            type="search"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <ScrollArea className="h-[300px] border rounded-md">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No users found matching your search.
              </div>
            ) : (
              <div className="p-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors duration-150 ease-in-out',
                      'hover:bg-muted/80 dark:hover:bg-neutral-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
                      <AvatarFallback className="bg-muted">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName || 'Unnamed User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
