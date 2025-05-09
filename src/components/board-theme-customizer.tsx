
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
import { Input } from '@/components/ui/input'; // Keep for fallback or future use
import { Label } from '@/components/ui/label';
import { useTasks } from '@/contexts/TaskContext';
import type { Board, BoardTheme } from '@/types';
import { Palette, Paintbrush, RotateCcw, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BoardThemeCustomizerProps {
  board: Board | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

const predefinedThemes: { name: string; theme: BoardTheme }[] = [
  {
    name: 'Ocean Breeze',
    theme: { primaryColor: '#0077B6', backgroundColor: '#E0F7FA', columnHeaderColor: '#B2EBF2', cardColor: '#FFFFFF' },
  },
  {
    name: 'Forest Canopy',
    theme: { primaryColor: '#4CAF50', backgroundColor: '#E8F5E9', columnHeaderColor: '#C8E6C9', cardColor: '#FFFFFF' },
  },
  {
    name: 'Sunset Vibes',
    theme: { primaryColor: '#FF9800', backgroundColor: '#FFF3E0', columnHeaderColor: '#FFE0B2', cardColor: '#FFFFFF' },
  },
  {
    name: 'Lavender Fields',
    theme: { primaryColor: '#673AB7', backgroundColor: '#EDE7F6', columnHeaderColor: '#D1C4E9', cardColor: '#FFFFFF' },
  },
  {
    name: 'Graphite & Gold',
    theme: { primaryColor: '#FFD700', backgroundColor: '#424242', columnHeaderColor: '#616161', cardColor: '#525252' },
  },
  {
    name: 'Default Theme',
    theme: {}, // Empty theme signifies fallback to global CSS variables
  },
];

const colorFields: { key: keyof BoardTheme; label: string; defaultGlobalVar: string }[] = [
  { key: 'primaryColor', label: 'Primary Accent', defaultGlobalVar: 'hsl(var(--primary))' },
  { key: 'backgroundColor', label: 'Board Background', defaultGlobalVar: 'hsl(var(--background))' },
  { key: 'columnHeaderColor', label: 'Column Header BG', defaultGlobalVar: 'hsl(var(--muted))' },
  { key: 'cardColor', label: 'Task Card BG', defaultGlobalVar: 'hsl(var(--card))' },
];

export function BoardThemeCustomizer({ board, open, onOpenChange, children }: BoardThemeCustomizerProps) {
  const { updateBoardTheme } = useTasks();
  const { toast } = useToast();
  const [currentTheme, setCurrentTheme] = useState<Partial<BoardTheme>>({});

  useEffect(() => {
    if (board) {
      setCurrentTheme(board.theme || {});
    } else {
      setCurrentTheme({});
    }
  }, [board, open]); // Reload theme when dialog opens or board changes

  const handleColorChange = (key: keyof BoardTheme, value: string) => {
    setCurrentTheme(prevTheme => ({ ...prevTheme, [key]: value }));
  };

  const handleClearColor = (key: keyof BoardTheme) => {
    setCurrentTheme(prevTheme => {
      const newTheme = { ...prevTheme };
      delete newTheme[key]; // Remove the key to signify using default
      return newTheme;
    });
  };

  const handleSaveChanges = () => {
    if (board) {
      updateBoardTheme(board.id, currentTheme);
      toast({ title: "Theme Saved", description: `Custom theme for "${board.name}" has been updated.` });
      onOpenChange(false);
    }
  };

  const handleSelectPredefinedTheme = (theme: BoardTheme) => {
    if (board) {
      setCurrentTheme(theme); // Update local state for immediate preview in pickers
      updateBoardTheme(board.id, theme); // Update context
      toast({ title: "Predefined Theme Applied", description: `Theme applied to "${board.name}".` });
    }
  };
  
  const handleResetToDefault = () => {
    if (board) {
      setCurrentTheme({});
      updateBoardTheme(board.id, {});
      toast({ title: "Theme Reset", description: `Theme for "${board.name}" reset to default.` });
    }
  };


  if (!board) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paintbrush className="h-6 w-6 text-primary" /> Customize Theme: {board.name}
          </DialogTitle>
          <DialogDescription>
            Personalize the look and feel of your board. Changes are saved automatically when selecting predefined themes or manually below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] p-1">
          <div className="py-4 space-y-6">
            {/* Predefined Themes Section */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Predefined Themes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {predefinedThemes.map((pTheme) => (
                  <Button
                    key={pTheme.name}
                    variant="outline"
                    className="h-auto p-0 flex flex-col items-stretch justify-start shadow-sm hover:shadow-md transition-all duration-200 group"
                    onClick={() => handleSelectPredefinedTheme(pTheme.theme)}
                    title={`Apply ${pTheme.name}`}
                  >
                    <div className="flex-grow p-3 text-center text-sm font-medium">{pTheme.name}</div>
                    <div className="flex h-16 border-t">
                      <div style={{ backgroundColor: pTheme.theme.backgroundColor || '#f0f0f0' }} className="w-1/3 flex items-center justify-center relative">
                        <div style={{ backgroundColor: pTheme.theme.columnHeaderColor || '#e0e0e0' }} className="h-full w-1/2 absolute top-0 left-0 opacity-50"></div>
                      </div>
                      <div style={{ backgroundColor: pTheme.theme.cardColor || '#ffffff' }} className="w-1/3 flex items-center justify-center border-x">
                        <div style={{ backgroundColor: pTheme.theme.primaryColor || '#007bff' }} className="w-4 h-4 rounded-full opacity-70"></div>
                      </div>
                       <div style={{ backgroundColor: pTheme.theme.primaryColor || '#007bff' }} className="w-1/3"></div>
                    </div>
                  </Button>
                ))}
              </div>
            </section>

            <hr className="my-6 border-border" />

            {/* Custom Colors Section */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-foreground">Custom Colors</h3>
                 <Button variant="outline" size="sm" onClick={handleResetToDefault} title="Reset all custom colors to default">
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset All
                  </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Click color boxes to pick custom colors or clear them to use defaults.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {colorFields.map(({ key, label, defaultGlobalVar }) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`theme-${key}`} className="text-sm font-medium">
                      {label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id={`theme-${key}`}
                        value={currentTheme[key] || (typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(defaultGlobalVar.slice(4,-1)) : '#000000')}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="h-10 w-10 p-0 border-none rounded-md cursor-pointer shadow-sm appearance-none"
                        title={`Pick ${label.toLowerCase()}`}
                      />
                       <div className="flex-1 p-2 border rounded-md text-xs bg-background">
                        {currentTheme[key] || `Default (${defaultGlobalVar})`}
                       </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClearColor(key)}
                        title={`Clear custom ${label.toLowerCase()}`}
                        className="h-8 w-8"
                        disabled={currentTheme[key] === undefined}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-2 pt-4 border-t">
           <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Palette className="mr-2 h-4 w-4" /> Save Custom Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
