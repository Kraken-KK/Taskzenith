
// src/components/join-organization-dialog.tsx
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
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, PlusCircle } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';

interface JoinOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  onOrgJoined?: () => void; 
}

export function JoinOrganizationDialog({ open, onOpenChange, children, onOrgJoined }: JoinOrganizationDialogProps) {
  const [inviteCode, setInviteCode] = useState('');
  const { joinOrganizationByInviteCode } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinOrg = async () => {
    if (!inviteCode.trim()) {
      toast({ title: "Validation Error", description: "Invite code cannot be empty.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const joinedOrg = await joinOrganizationByInviteCode(inviteCode.trim().toUpperCase());
    setIsLoading(false);
    if (joinedOrg) {
      setInviteCode('');
      onOpenChange(false); 
      onOrgJoined?.(); 
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setInviteCode('');
        }
        onOpenChange(isOpen);
    }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" /> Join Organization
          </DialogTitle>
          <DialogDescription>
            Enter the 5-character invite code to join an existing organization.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC12"
              maxLength={5}
              disabled={isLoading}
              className="uppercase tracking-widest"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleJoinOrg} disabled={!inviteCode.trim() || isLoading || inviteCode.trim().length !== 5}>
            {isLoading ? "Joining..." : <><LogIn className="mr-2 h-4 w-4" /> Join Organization</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

