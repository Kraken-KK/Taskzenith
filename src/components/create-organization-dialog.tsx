// src/components/create-organization-dialog.tsx
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
import { Briefcase, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function CreateOrganizationDialog({ open, onOpenChange, children }: CreateOrganizationDialogProps) {
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const { createOrganization } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast({ title: "Validation Error", description: "Organization name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const newOrg = await createOrganization(orgName.trim(), orgDescription.trim());
    setIsLoading(false);
    if (newOrg) {
      setOrgName('');
      setOrgDescription('');
      onOpenChange(false); // This will trigger refresh in parent if onOpenChange callback is set up for it
    }
    // Error toasts are handled within createOrganization context function
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setOrgName('');
            setOrgDescription('');
        }
        onOpenChange(isOpen);
    }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Create New Organization
          </DialogTitle>
          <DialogDescription>
            Set up a new organization to manage your teams and boards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Acme Corp"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-description">Description (Optional)</Label>
            <Textarea
              id="org-description"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="A brief description of your organization"
              className="resize-none"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleCreateOrg} disabled={!orgName.trim() || isLoading}>
            {isLoading ? "Creating..." : <><PlusCircle className="mr-2 h-4 w-4" /> Create Organization</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
