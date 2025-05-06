'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Moon, Sun, Laptop } from 'lucide-react';

export function SettingsView() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Application Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Label htmlFor="theme-select" className="text-lg font-medium">
            Theme
          </Label>
          <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
            <SelectTrigger className="w-[180px]" id="theme-select">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4" />
                  System
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Add more settings here as needed */}
         <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-medium mb-2">About TaskZenith</h3>
            <p className="text-sm text-muted-foreground">
                TaskZenith is an AI-powered task management application designed to help you stay organized and productive.
                Leverage smart features like AI task prioritization, intelligent task creation, and an AI assistant to streamline your workflow.
            </p>
            <p className="text-xs text-muted-foreground mt-4">Version 1.0.0</p>
        </div>
      </CardContent>
    </Card>
  );
}