'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from "@/hooks/use-toast";
import type { Task } from '@/types';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { useTasks } from '@/contexts/TaskContext'; // Import useTasks hook
import { cn } from '@/lib/utils';

export function KanbanBoard() {
  const { columns, setColumns, addTask, moveTask, deleteTask, updateTask } = useTasks(); // Use context
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);


  // Effect to get window size for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    if (typeof window !== 'undefined') {
      handleResize(); // Initial size
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);


  // State for drag-and-drop
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<'todo' | 'inProgress' | 'done' | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.currentTarget.classList.add('opacity-50', 'shadow-2xl', 'scale-105'); // Visual feedback for dragging
    e.currentTarget.classList.remove('hover:shadow-xl', 'hover:-translate-y-1');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault(); // Necessary to allow dropping
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColumnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault();
    if (!draggedTask) return;


    const taskElement = document.getElementById(`task-${draggedTask.id}`);
    if (taskElement) {
        taskElement.classList.remove('opacity-50', 'shadow-2xl', 'scale-105');
        taskElement.classList.add('hover:shadow-xl', 'hover:-translate-y-1');
    }
    
    if (draggedTask.status === targetColumnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }


    const isMovingToDone = targetColumnId === 'done' && draggedTask.status !== 'done';

    const moved = moveTask(draggedTask.id, draggedTask.status, targetColumnId);


    if (moved && isMovingToDone) {
        setShowConfetti(true);
        toast({
          title: "Task Completed!",
          description: `"${draggedTask.content}" moved to Done. Great job!`,
        });
        setTimeout(() => setShowConfetti(false), 5000); // Confetti duration
    } else if (moved) {
         toast({
          title: "Task Moved",
          description: `"${draggedTask.content}" moved to ${columns.find(c => c.id === targetColumnId)?.title}.`,
        });
    }

    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // Reset visual feedback if drag was cancelled or ended outside a valid drop zone
    if (draggedTask) {
      const taskElement = document.getElementById(`task-${draggedTask.id}`);
      if (taskElement) {
        taskElement.classList.remove('opacity-50', 'shadow-2xl', 'scale-105');
        taskElement.classList.add('hover:shadow-xl', 'hover:-translate-y-1');
      }
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDialogAddTask = (taskData: Omit<Task, 'id' | 'status'>) => {
    if (editingTask) { // If editing, update the task
      updateTask({ ...editingTask, ...taskData, deadline: taskData.deadline ? taskData.deadline : undefined });
      setEditingTask(null);
    } else { // Otherwise, add a new task
      addTask(taskData, 'todo');
    }
    setIsAddTaskDialogOpen(false);
  };

  const openEditTaskDialog = (task: Task) => {
    setEditingTask(task);
    setIsAddTaskDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string, columnId: 'todo' | 'inProgress' | 'done') => {
    deleteTask(taskId, columnId);
  };

  const getPriorityBadgeClass = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-destructive/20 text-destructive border border-destructive/30';
      case 'medium': return 'bg-orange-200 text-orange-800 border border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-700';
      case 'low': return 'bg-primary/20 text-primary border border-primary/30';
      default: return 'bg-muted text-muted-foreground border';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {showConfetti && windowSize.width > 0 && ( // Ensure windowSize is loaded
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <Button size="sm" onClick={() => { setEditingTask(null); setIsAddTaskDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </div>

      <AddTaskDialog
        open={isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        onAddTask={handleDialogAddTask}
        initialTaskData={editingTask ?? undefined} // Pass editing task data
      />

      <div className="flex space-x-4 overflow-x-auto pb-4 flex-1">
        {columns.map(column => (
          <Card
            key={column.id}
            className={cn(
                `min-w-[300px] max-w-[350px] flex flex-col transition-all duration-300 ease-in-out`,
                dragOverColumn === column.id ? 'bg-secondary/80 dark:bg-secondary/50 shadow-xl scale-[1.02]' : 'bg-card',
                'interactive-card-hover' // Apply common hover style
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b sticky top-0 bg-card z-10">
              <CardTitle className="text-base font-medium">{column.title} ({column.tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3 overflow-y-auto flex-1">
              {column.tasks.map(task => (
                <div
                  key={task.id}
                  id={`task-${task.id}`}
                  className="bg-background border p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-1 group relative dark:bg-neutral-800 dark:border-neutral-700"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                >
                  <p className="text-sm font-medium mb-1.5 break-words">{task.content}</p>
                  {task.description && <p className="text-xs text-muted-foreground mb-2 break-words">{task.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getPriorityBadgeClass(task.priority)}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      )}
                      {task.deadline && <span className="whitespace-nowrap">Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                    </div>
                    <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/50" onClick={() => openEditTaskDialog(task)}>
                        <Edit2 className="h-3 w-3" />
                        <span className="sr-only">Edit task</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTask(task.id, column.id)}>
                        <Trash2 className="h-3 w-3" />
                        <span className="sr-only">Delete task</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {column.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Drag tasks here or add a new one.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
