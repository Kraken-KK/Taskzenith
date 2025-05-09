
'use client';

import React, { useState, useEffect } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { prioritizeTasks, type PrioritizeTasksInput, type PrioritizeTasksOutput } from '@/ai/flows/ai-powered-task-prioritization';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

export function PrioritizeTasksView() {
  const { getAllTasksOfActiveBoard, getActiveBoard } = useTasks(); // Use getAllTasksOfActiveBoard
  const [isLoading, setIsLoading] = useState(false);
  const [prioritizedResult, setPrioritizedResult] = useState<PrioritizeTasksOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  
  const activeBoard = getActiveBoard();

  useEffect(() => {
    if (activeBoard) {
      setCurrentTasks(getAllTasksOfActiveBoard());
    } else {
      setCurrentTasks([]);
    }
  }, [getAllTasksOfActiveBoard, activeBoard]);

  const handlePrioritizeTasks = async () => {
    setIsLoading(true);
    setError(null);
    setPrioritizedResult(null);

    if (!activeBoard) {
        setError("No active board selected. Please select a board to prioritize its tasks.");
        setIsLoading(false);
        return;
    }

    const tasksToPrioritize = currentTasks
      .filter(task => task.status !== 'done') // Only prioritize non-done tasks
      .map(task => ({
        id: task.id,
        description: task.content + (task.description ? ` (${task.description})` : ''),
        deadline: task.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default to 1 week if no deadline
        importance: task.priority || 'medium',
        dependencies: task.dependencies || [],
      }));

    if (tasksToPrioritize.length === 0) {
      setError(`No active tasks in board "${activeBoard.name}" to prioritize. Add some tasks first!`);
      setIsLoading(false);
      return;
    }

    const input: PrioritizeTasksInput = { tasks: tasksToPrioritize };

    try {
      const result = await prioritizeTasks(input);
      setPrioritizedResult(result);
    } catch (err) {
      console.error("Error prioritizing tasks:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during prioritization.";
      setError(`Failed to prioritize tasks: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getTaskContentById = (taskId: string): string => {
    const task = currentTasks.find(t => t.id === taskId);
    return task ? task.content : "Unknown Task";
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-xl interactive-card-hover">
      <CardHeader>
        <CardTitle>AI Task Prioritization {activeBoard ? `for "${activeBoard.name}"` : ''}</CardTitle>
        <CardDescription>
          Let AI help you decide what to work on next from your active board. It considers deadlines, importance, and dependencies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive" className="animate-fadeIn">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!activeBoard && !isLoading && (
            <Alert className="animate-fadeIn">
                <Info className="h-4 w-4" />
                <AlertTitle>No Active Board</AlertTitle>
                <AlertDescription>
                    Please select or create a board first to prioritize its tasks.
                </AlertDescription>
            </Alert>
        )}

        {activeBoard && currentTasks.filter(task => task.status !== 'done').length === 0 && !isLoading && !prioritizedResult && !error && (
            <Alert className="animate-fadeIn">
                <Info className="h-4 w-4" />
                <AlertTitle>No Tasks to Prioritize</AlertTitle>
                <AlertDescription>
                    Board "{activeBoard.name}" currently has no active (To Do or In Progress) tasks. Add some tasks to this board to use the feature.
                </AlertDescription>
            </Alert>
        )}

        <Button
          onClick={handlePrioritizeTasks}
          disabled={isLoading || !activeBoard || currentTasks.filter(task => task.status !== 'done').length === 0}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Prioritizing...
            </>
          ) : (
            'Prioritize Tasks on This Board'
          )}
        </Button>

        {prioritizedResult && prioritizedResult.prioritizedTasks.length > 0 && (
          <div className="space-y-4 animate-fadeInUp">
            <h3 className="text-lg font-semibold text-center">Prioritization Results</h3>
             <Alert variant="default" className="bg-primary/10 border-primary/30">
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Prioritization Complete!</AlertTitle>
                <AlertDescription>
                    Here are your tasks sorted by AI-determined priority. Focus on the tasks at the top of the list first.
                </AlertDescription>
            </Alert>
            <ScrollArea className="h-[400px] rounded-md border p-4 shadow-inner bg-background/50 dark:bg-neutral-800/30">
              <ul className="space-y-3">
                {prioritizedResult.prioritizedTasks.sort((a,b) => a.priority - b.priority).map((pTask, index) => (
                  <li key={pTask.id} className={cn("p-3 rounded-md shadow-sm bg-muted/50 dark:bg-muted/20 interactive-card-hover transform hover:scale-[1.01]", "animate-fadeInUp")} style={{ animationDelay: `${index * 50}ms`}}>
                    <div className="flex items-start justify-between">
                        <h4 className="font-medium text-base">
                           {index + 1}. {getTaskContentById(pTask.id)}
                        </h4>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground shadow-sm">
                            Priority: {pTask.priority}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 pl-1">{pTask.reason}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
         {prioritizedResult && prioritizedResult.prioritizedTasks.length === 0 && !isLoading && (
             <Alert className="animate-fadeIn">
                <Terminal className="h-4 w-4" />
                <AlertTitle>No Prioritized Tasks Returned</AlertTitle>
                <AlertDescription>
                    The AI didn't return any prioritized tasks. This might happen if there were issues processing your current tasks or if they couldn't be meaningfully prioritized.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
       <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
            Note: AI prioritization is a suggestion. Use your best judgment to adjust as needed. These priorities are not automatically applied to your tasks.
       </CardFooter>
    </Card>
  );
}
