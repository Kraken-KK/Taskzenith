
'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrioritizeTasksView } from '@/components/prioritize-tasks-view';
import { SmartTaskCreationView } from '@/components/smart-task-creation-view';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ListChecks } from 'lucide-react';

export function TaskOptimizationView() {
  return (
    <div className="max-w-4xl mx-auto p-1 sm:p-4">
      <Card className="shadow-xl interactive-card-hover">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl sm:text-3xl">Task Optimization Suite</CardTitle>
          </div>
          <CardDescription className="text-sm sm:text-base">
            Leverage AI to streamline your workflow. Prioritize your existing tasks or get smart suggestions for new ones based on your goals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prioritize" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 rounded-lg shadow-inner">
              <TabsTrigger value="prioritize" className="py-2.5 sm:py-3 text-xs sm:text-sm data-[state=active]:shadow-md">
                <ListChecks className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> AI Task Prioritization
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="py-2.5 sm:py-3 text-xs sm:text-sm data-[state=active]:shadow-md">
                <Sparkles className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Smart Task Suggestions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="prioritize" className="mt-0">
              <PrioritizeTasksView />
            </TabsContent>
            <TabsContent value="suggestions" className="mt-0">
              <SmartTaskCreationView />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
