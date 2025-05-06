'use client';

import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

const taskFormSchema = z.object({
  content: z.string().min(1, { message: 'Task content cannot be empty.' }).max(200, { message: 'Task content is too long.' }),
  description: z.string().max(500, { message: 'Description is too long.' }).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  deadline: z.date().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status'>) => void;
  children?: React.ReactNode;
  initialTaskData?: Partial<Task>; // For editing
}

export function AddTaskDialog({ open, onOpenChange, onAddTask, children, initialTaskData }: AddTaskDialogProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      content: '',
      description: '',
      priority: 'medium',
      deadline: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      if (initialTaskData) {
        form.reset({
          content: initialTaskData.content || '',
          description: initialTaskData.description || '',
          priority: initialTaskData.priority || 'medium',
          deadline: initialTaskData.deadline ? parseISO(initialTaskData.deadline) : undefined,
        });
      } else {
        form.reset({ // Reset to default for new task
            content: '',
            description: '',
            priority: 'medium',
            deadline: undefined,
        });
      }
    }
  }, [open, initialTaskData, form]);


  function onSubmit(data: TaskFormValues) {
    const taskData: Omit<Task, 'id' | 'status'> = {
      content: data.content,
      description: data.description || undefined,
      priority: data.priority,
      deadline: data.deadline ? format(data.deadline, 'yyyy-MM-dd') : undefined,
    };
    onAddTask(taskData);
    // onOpenChange(false); // Closing is handled by parent after onAddTask completes
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialTaskData ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          <DialogDescription>
            {initialTaskData ? 'Update the details of your task.' : "Fill in the details for your new task. Click save when you're done."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Finalize project report" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add more details about the task..."
                      className="resize-none"
                      {...field}
                      value={field.value ?? ''} // Handle null value
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Deadline (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{initialTaskData ? 'Save Changes' : 'Add Task'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}