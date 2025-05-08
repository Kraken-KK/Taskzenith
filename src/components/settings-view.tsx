
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext'; // Import useSettings
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch'; // Import Switch
import { Moon, Sun, Laptop, Zap } from 'lucide-react'; // Added Zap for Beta
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { isBetaModeEnabled, setIsBetaModeEnabled } = useSettings();

  return (
    <Card className="max-w-2xl mx-auto shadow-xl interactive-card-hover">
      <CardHeader>
        <CardTitle>Application Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="theme-select" className="text-base font-medium"> {/* Increased font size */}
              Theme
            </Label>
            <p className="text-sm text-muted-foreground">
              Select the application theme.
            </p>
          </div>
          <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
            <SelectTrigger id="theme-select" className="w-[180px] transition-all duration-150 ease-in-out hover:border-primary focus:shadow-outline-primary">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent className="transition-opacity duration-150 ease-in-out">
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

        {/* Beta Mode Setting */}
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="beta-mode-switch" className="text-base font-medium flex items-center gap-2"> {/* Increased font size */}
              <Zap className="h-5 w-5 text-accent" /> Beta Features
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable experimental features. May be unstable.
            </p>
          </div>
          <Switch
            id="beta-mode-switch"
            checked={isBetaModeEnabled}
            onCheckedChange={setIsBetaModeEnabled}
            aria-label="Toggle beta features"
          />
        </div>

         <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
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

