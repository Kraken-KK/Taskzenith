
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings, type InteractionStyle } from '@/contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Laptop, Zap, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const interactionStyleOptions: { value: InteractionStyle; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Casual and approachable.' },
  { value: 'formal', label: 'Formal', description: 'Professional and direct.' },
  { value: 'concise', label: 'Concise', description: 'Short and to the point.' },
  { value: 'detailed', label: 'Detailed', description: 'Provides thorough explanations.' },
];

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { isBetaModeEnabled, setIsBetaModeEnabled, interactionStyle, setInteractionStyle } = useSettings();

  return (
    <Card className="max-w-2xl mx-auto shadow-xl interactive-card-hover">
      <CardHeader>
        <CardTitle>Application Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Setting */}
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="theme-select" className="text-base font-medium">
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

        {/* AI Interaction Style Setting */}
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="interaction-style-select" className="text-base font-medium flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> AI Interaction Style
            </Label>
            <p className="text-sm text-muted-foreground">
              Choose how Jack, the AI Assistant, communicates with you.
            </p>
          </div>
          <Select value={interactionStyle} onValueChange={(value) => setInteractionStyle(value as InteractionStyle)}>
            <SelectTrigger id="interaction-style-select" className="w-[180px] transition-all duration-150 ease-in-out hover:border-primary focus:shadow-outline-primary">
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent className="transition-opacity duration-150 ease-in-out">
              {interactionStyleOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        {/* Beta Mode Setting */}
        <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-0.5">
            <Label htmlFor="beta-mode-switch" className="text-base font-medium flex items-center gap-2">
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
