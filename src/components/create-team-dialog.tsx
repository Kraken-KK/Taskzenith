// src/components/create-team-dialog.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Users, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null; // ID of the organization this team will belong to
  children?: React.ReactNode;
}

export function CreateTeamDialog({ open, onOpenChange, organizationId, children }: CreateTeamDialogProps) {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const { createTeam } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateTeam = async () => {
    if (!organizationId) {
        toast({ title: "Error", description: "No organization selected to add this team to.", variant: "destructive" });
        return;
    }
    if (!teamName.trim()) {
      toast({ title: "Validation Error", description: "Team name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const newTeam = await createTeam(teamName.trim(), organizationId, teamDescription.trim());
    setIsLoading(false);
    if (newTeam) {
      setTeamName('');
      setTeamDescription('');
      onOpenChange(false); // Triggers refresh in parent if callback is set
    }
    // Error toasts are handled within createTeam context function
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setTeamName('');
            setTeamDescription('');
        }
        onOpenChange(isOpen);
    }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Create New Team
          </DialogTitle>
          <DialogDescription>
            Organize members into teams for focused collaboration.
            {organizationId ? ` This team will be part of your selected organization.` : " No organization selected."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., Marketing, Engineering"
              disabled={isLoading || !organizationId}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-description">Description (Optional)</Label>
            <Textarea
              id="team-description"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="What this team is about"
              className="resize-none"
              disabled={isLoading || !organizationId}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleCreateTeam} disabled={!teamName.trim() || isLoading || !organizationId}>
            {isLoading ? "Creating..." : <><PlusCircle className="mr-2 h-4 w-4" /> Create Team</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
