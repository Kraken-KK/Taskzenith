
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
import { useTasks } from '@/contexts/TaskContext';
import type { Board, BoardTheme } from '@/types';
import { Palette } from 'lucide-react';

interface BoardThemeCustomizerProps {
  board: Board | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

// Basic HSL color validation (you might want a more robust library for complex needs)
const isValidHSL = (hsl: string): boolean => {
  if (!hsl) return true; // Allow empty string for clearing
  return /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/i.test(hsl);
};


export function BoardThemeCustomizer({ board, open, onOpenChange, children }: BoardThemeCustomizerProps) {
  const { updateBoardTheme } = useTasks();
  const [theme, setTheme] = useState<Partial<BoardTheme>>({});

  useEffect(() => {
    if (board?.theme) {
      setTheme(board.theme);
    } else {
      setTheme({});
    }
  }, [board]);

  const handleThemeChange = (key: keyof BoardTheme, value: string) => {
    setTheme(prevTheme => ({ ...prevTheme, [key]: value }));
  };

  const handleSaveChanges = () => {
    if (board) {
      // Validate HSL values before saving
      const validatedTheme: Partial<BoardTheme> = {};
      let allValid = true;
      (Object.keys(theme) as Array<keyof BoardTheme>).forEach(key => {
        const val = theme[key];
        if (val && !isValidHSL(val)) {
          allValid = false;
          // Potentially show an error message to the user for this specific field
          console.error(`Invalid HSL value for ${key}: ${val}`);
          alert(`Invalid HSL value for ${String(key)}: ${val}. Please use format like 'hsl(174, 38%, 60%)'.`);
        } else {
           validatedTheme[key] = val;
        }
      });

      if (allValid) {
        updateBoardTheme(board.id, validatedTheme);
        onOpenChange(false);
      }
    }
  };
  
  const colorFields: { key: keyof BoardTheme; label: string; placeholder: string }[] = [
    { key: 'primaryColor', label: 'Primary Color', placeholder: 'e.g., hsl(174, 38%, 60%)' },
    { key: 'backgroundColor', label: 'Board Background', placeholder: 'e.g., hsl(0, 0%, 98%)' },
    { key: 'columnHeaderColor', label: 'Column Header BG', placeholder: 'e.g., hsl(0, 0%, 93%)' },
    { key: 'cardColor', label: 'Task Card BG', placeholder: 'e.g., hsl(0, 0%, 100%)' },
  ];

  if (!board) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Board Theme: {board.name}</DialogTitle>
          <DialogDescription>
            Set custom colors for your board. Use HSL format (e.g., hsl(hue, saturation%, lightness%)).
            Leave blank to use default theme colors.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {colorFields.map(({ key, label, placeholder }) => (
            <div key={key} className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`theme-${key}`} className="text-right col-span-1">
                {label}
              </Label>
              <Input
                id={`theme-${key}`}
                value={theme[key] || ''}
                onChange={(e) => handleThemeChange(key, e.target.value)}
                className="col-span-2"
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleSaveChanges}>
            <Palette className="mr-2 h-4 w-4" /> Save Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
