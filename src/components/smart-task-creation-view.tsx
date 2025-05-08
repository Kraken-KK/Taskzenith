'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { smartTaskCreation, type SmartTaskCreationInput, type SmartTaskCreationOutput } from '@/ai/flows/smart-task-creation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Check, AlertCircle, Loader2, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const smartCreateFormSchema = z.object({
  userGoals: z.string().min(10, { message: 'Please describe your goals in a bit more detail (min 10 characters).' }).max(500, { message: 'Goals description is too long (max 500 characters).' }),
  currentProjects: z.string().min(5, { message: 'Please list current projects (min 5 characters).' }).max(500, { message: 'Projects description is too long (max 500 characters).' }),
});

type SmartCreateFormValues = z.infer<typeof smartCreateFormSchema>;

export function SmartTaskCreationView() {
  const { addTask } = useTasks();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<string[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SmartCreateFormValues>({
    resolver: zodResolver(smartCreateFormSchema),
    defaultValues: {
      userGoals: '',
      currentProjects: '',
    },
  });

  const onSubmit = async (data: SmartCreateFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuggestedTasks([]);
    setSelectedTasks([]);

    const input: SmartTaskCreationInput = {
      userGoals: data.userGoals,
      currentProjects: data.currentProjects,
    };

    try {
      // Simulate API delay for testing animations
      // await new Promise(resolve => setTimeout(resolve, 1500));
      const result: SmartTaskCreationOutput = await smartTaskCreation(input);
      if (result.suggestedTasks && result.suggestedTasks.length > 0) {
        setSuggestedTasks(result.suggestedTasks);
      } else {
        setSuggestedTasks([]); // Ensure it's an empty array if no tasks
        toast({
          title: "No tasks suggested",
          description: "The AI couldn't suggest any tasks based on your input. Try rephrasing your goals or projects.",
          variant: "default"
        });
      }
    } catch (err) {
      console.error("Error creating smart tasks:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to suggest tasks: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTaskSelection = (taskContent: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskContent) ? prev.filter(t => t !== taskContent) : [...prev, taskContent]
    );
  };

  const handleAddSelectedTasks = () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected",
        description: "Please select at least one suggested task to add.",
        variant: "destructive",
      });
      return;
    }
    selectedTasks.forEach(taskContent => {
      addTask({ content: taskContent, priority: 'medium' }); // Add with default medium priority
    });
    toast({
      title: "Tasks Added!",
      description: `${selectedTasks.length} task(s) added to your 'To Do' list.`,
    });
    setSelectedTasks([]); // Clear selection
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-xl interactive-card-hover">
      <CardHeader>
        <CardTitle>Smart Task Creation</CardTitle>
        <CardDescription>
          Describe your goals and current projects, and let AI suggest relevant tasks for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="userGoals">Your Main Goals</Label>
            <Controller
              name="userGoals"
              control={form.control}
              render={({ field }) => (
                <Textarea
                  id="userGoals"
                  placeholder="e.g., Launch a new product by Q4, Improve team productivity by 15%"
                  {...field}
                  className="mt-1 transition-shadow duration-200 focus:shadow-lg"
                />
              )}
            />
            {form.formState.errors.userGoals && (
              <p className="text-sm text-destructive mt-1 animate-fadeIn">{form.formState.errors.userGoals.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="currentProjects">Current Projects</Label>
            <Controller
              name="currentProjects"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="currentProjects"
                  placeholder="e.g., Website Redesign, Marketing Campaign X, Mobile App v2"
                  {...field}
                  className="mt-1 transition-shadow duration-200 focus:shadow-lg"
                />
              )}
            />
            {form.formState.errors.currentProjects && (
              <p className="text-sm text-destructive mt-1 animate-fadeIn">{form.formState.errors.currentProjects.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Tasks...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Suggest Tasks
              </>
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="animate-fadeIn">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {suggestedTasks.length > 0 && (
          <div className="space-y-4 pt-4 animate-fadeInUp">
            <h3 className="text-lg font-semibold">Suggested Tasks:</h3>
            <ScrollArea className="h-[300px] rounded-md border p-4 shadow-inner bg-background/50 dark:bg-neutral-800/30">
              <ul className="space-y-2">
                {suggestedTasks.map((task, index) => (
                  <li 
                    key={index} 
                    className={cn(
                      "flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 dark:hover:bg-muted/20 interactive-card-hover transform hover:scale-[1.01]",
                      "animate-fadeInUp"
                    )}
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <Checkbox
                      id={`task-${index}`}
                      checked={selectedTasks.includes(task)}
                      onCheckedChange={() => handleToggleTaskSelection(task)}
                      className="transition-transform active:scale-90"
                    />
                    <label htmlFor={`task-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer">
                      {task}
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <Button onClick={handleAddSelectedTasks} disabled={selectedTasks.length === 0 || isLoading} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Selected ({selectedTasks.length}) to Board
            </Button>
          </div>
        )}
        { !isLoading && form.formState.isSubmitSuccessful && suggestedTasks.length === 0 && !error && (
             <Alert className="animate-fadeIn">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Suggestions</AlertTitle>
                <AlertDescription>
                    The AI could not generate any task suggestions based on your input.
                    Please try refining your goals or project descriptions for better results.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
        The more detailed your input, the better the AI's suggestions will be.
      </CardFooter>
    </Card>
  );
}
