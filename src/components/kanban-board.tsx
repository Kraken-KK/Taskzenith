'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from "@/hooks/use-toast";
import type { Task, Column } from '@/types'; // Use Task and Column types
import { AddTaskDialog } from '@/components/add-task-dialog'; // Import AddTaskDialog

// Initial placeholder data
const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      { id: 'task-1', content: 'Design the user interface mockup', status: 'todo', priority: 'high', deadline: '2024-08-15', description: 'Create mockups for the main board and task details.' },
      { id: 'task-2', content: 'Set up the project structure', status: 'todo', priority: 'medium', description: 'Initialize Next.js, install dependencies, configure Tailwind.' },
    ],
  },
  {
    id: 'inProgress',
    title: 'In Progress',
    tasks: [
      { id: 'task-3', content: 'Develop the Kanban board component', status: 'inProgress', priority: 'high', description: 'Build the main drag-and-drop interface.' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      { id: 'task-4', content: 'Gather project requirements', status: 'done', description: 'Define features and user stories.' },
    ],
  },
];

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);

  // Effect to get window size for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // State for drag-and-drop
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<'todo' | 'inProgress' | 'done' | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColumnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === targetColumnId) {
        if (draggedTask) {
            const taskElement = document.getElementById(`task-${draggedTask.id}`);
            if (taskElement) taskElement.style.opacity = '1';
        }
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    const isMovingToDone = targetColumnId === 'done' && draggedTask.status !== 'done';

    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const sourceColumn = newColumns.find(col => col.id === draggedTask.status);
      if (sourceColumn) {
        sourceColumn.tasks = sourceColumn.tasks.filter(task => task.id !== draggedTask.id);
      }
      const targetColumn = newColumns.find(col => col.id === targetColumnId);
      if (targetColumn) {
        targetColumn.tasks.push({ ...draggedTask, status: targetColumnId });
      }
      return newColumns;
    });

    if (isMovingToDone) {
        setShowConfetti(true);
        toast({
          title: "Task Completed!",
          description: `"${draggedTask.content}" moved to Done. Great job!`,
        });
        setTimeout(() => setShowConfetti(false), 5000);
    }

    const taskElement = document.getElementById(`task-${draggedTask.id}`);
    if (taskElement) taskElement.style.opacity = '1';
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if(draggedTask) {
         const taskElement = document.getElementById(`task-${draggedTask.id}`);
         if (taskElement) taskElement.style.opacity = '1';
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Handle adding a new task
  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'status'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // More unique ID
      status: 'todo',
    };

    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const todoColumn = newColumns.find(col => col.id === 'todo');
      if (todoColumn) {
        todoColumn.tasks.unshift(newTask); // Add to the beginning of the list
      }
      return newColumns;
    });

    toast({
        title: "Task Added",
        description: `"${newTask.content}" added to To Do.`,
    });
    setIsAddTaskDialogOpen(false); // Close the dialog after adding
  };


  const getPriorityBadgeClass = (priority?: 'high' | 'medium' | 'low') => {
    // Use theme-based colors indirectly via Tailwind classes that map to CSS variables
    switch (priority) {
      case 'high': return 'bg-destructive/20 text-destructive border border-destructive/30'; // Use destructive for high prio
      case 'medium': return 'bg-orange-200 text-orange-800 border border-orange-300'; // Example: Use a distinct color like orange if needed, or adjust secondary/accent
      case 'low': return 'bg-primary/20 text-primary border border-primary/30'; // Use primary/accent for low prio, adjust as needed
      default: return 'bg-muted text-muted-foreground border';
    }
  };

  return (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
            {/* Header elements can go here if needed, or keep it minimal */}
             <AddTaskDialog
                open={isAddTaskDialogOpen}
                onOpenChange={setIsAddTaskDialogOpen}
                onAddTask={handleAddTask}
             >
                <Button size="sm" onClick={() => setIsAddTaskDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
            </AddTaskDialog>
        </div>

      <div className="flex space-x-4 overflow-x-auto pb-4 flex-1">
        {showConfetti && windowSize.width > 0 && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={300}
          />
        )}
        {columns.map(column => (
          <Card
            key={column.id}
            className={`min-w-[300px] max-w-[350px] flex flex-col transition-colors duration-200 ${dragOverColumn === column.id ? 'bg-secondary/80' : 'bg-card'}`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b sticky top-0 bg-card z-10">
              <CardTitle className="text-base font-medium">{column.title} ({column.tasks.length})</CardTitle>
              {/* Add task button per column (optional) */}
              {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAddTaskDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add task to {column.title}</span>
              </Button> */}
            </CardHeader>
            <CardContent className="p-3 space-y-3 overflow-y-auto flex-1">
              {column.tasks.map(task => (
                <div
                  key={task.id}
                  id={`task-${task.id}`}
                  className="bg-background border p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-opacity duration-150 group relative" // Added group and relative
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

                    {/* Actions appear on hover */}
                    <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Edit2 className="h-3 w-3" />
                        <span className="sr-only">Edit task</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
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
       {/* Keep AddTaskDialog outside the mapped columns */}

    </div>
  );
}
