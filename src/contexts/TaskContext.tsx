
'use client';

import type { Task, Column } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Initial placeholder data
const initialColumnsData: Column[] = [
  {
    id: generateId('col'),
    title: 'To Do',
    tasks: [
      { id: generateId('task'), content: 'Design the user interface mockup', status: '', priority: 'high', deadline: '2024-08-15', description: 'Create mockups for the main board and task details.', tags: ['design', 'UI'] },
      { id: generateId('task'), content: 'Set up the project structure', status: '', priority: 'medium', description: 'Initialize Next.js, install dependencies, configure Tailwind.', tags: ['dev', 'setup'] },
    ],
  },
  {
    id: generateId('col'),
    title: 'In Progress',
    tasks: [
      { id: generateId('task'), content: 'Develop the Kanban board component', status: '', priority: 'high', description: 'Build the main drag-and-drop interface.', tags: ['dev', 'kanban'] },
    ],
  },
  {
    id: generateId('col'),
    title: 'Done',
    tasks: [
      { id: generateId('task'), content: 'Gather project requirements', status: '', description: 'Define features and user stories.', tags: ['planning'] },
    ],
  },
];

// Assign initial status to tasks based on their column
initialColumnsData.forEach(col => {
  col.tasks.forEach(task => {
    task.status = col.id;
  });
});


interface TaskContextType {
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  addTask: (taskData: Omit<Task, 'id' | 'status'>, targetColumnId?: Column['id']) => void;
  moveTask: (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id']) => Task | null;
  deleteTask: (taskId: string, columnId: Column['id']) => void;
  updateTask: (updatedTask: Task) => void;
  getTaskById: (taskId: string) => Task | undefined;
  getAllTasks: () => Task[];
  addColumn: (title: string) => void;
  updateColumnTitle: (columnId: string, newTitle: string) => void;
  deleteColumn: (columnId: string) => void;
  // updateColumnOrder: (columnOrder: string[]) => void; // For future drag-drop columns
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<Column[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem('kanbanTasks');
      if (savedTasks) {
        try {
          const parsed = JSON.parse(savedTasks);
          // Basic validation to ensure it's an array and items have id and title
          if (Array.isArray(parsed) && parsed.every(col => col.id && col.title && Array.isArray(col.tasks))) {
            return parsed;
          }
          console.warn("Invalid data structure in localStorage for tasks, resetting to default.");
        } catch (e) {
          console.error("Failed to parse tasks from localStorage", e);
        }
      }
    }
    return initialColumnsData;
  });
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kanbanTasks', JSON.stringify(columns));
    }
  }, [columns]);

  const addTask = (taskData: Omit<Task, 'id' | 'status'>, targetColumnId?: Column['id']) => {
    const finalTargetColumnId = targetColumnId || (columns.length > 0 ? columns[0].id : undefined);

    if (!finalTargetColumnId) {
        toast({
            title: "Error Adding Task",
            description: "No columns available to add the task to. Please add a column first.",
            variant: "destructive",
        });
        return;
    }
    
    const newTask: Task = {
      ...taskData,
      id: generateId('task'),
      status: finalTargetColumnId, // Use the actual ID of the target column
      tags: taskData.tags || [],
    };

    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const targetColumn = newColumns.find(col => col.id === finalTargetColumnId);
      if (targetColumn) {
        targetColumn.tasks.unshift(newTask);
      } else {
         // This case should ideally not be hit if finalTargetColumnId is validated
         console.error(`Target column with id ${finalTargetColumnId} not found.`);
         return prevColumns; // or handle more gracefully
      }
      return newColumns;
    });

    const targetColumnObj = columns.find(c => c.id === finalTargetColumnId);
    toast({
      title: "Task Added",
      description: `"${newTask.content}" added to ${targetColumnObj?.title || 'selected column'}.`,
    });
  };

  const moveTask = (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id']): Task | null => {
    let movedTask: Task | null = null;
    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({
        ...col,
        tasks: col.tasks.map(task => ({ ...task })),
      }));

      const sourceCol = newColumns.find(col => col.id === sourceColumnId);
      const targetCol = newColumns.find(col => col.id === targetColumnId);

      if (!sourceCol || !targetCol) return prevColumns;

      const taskIndex = sourceCol.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) return prevColumns;

      [movedTask] = sourceCol.tasks.splice(taskIndex, 1);
      if (movedTask) {
        movedTask.status = targetColumnId;
        targetCol.tasks.push(movedTask);
      }
      return newColumns;
    });
    return movedTask;
  };

  const deleteTask = (taskId: string, columnId: Column['id']) => {
    let deletedTaskContent: string | undefined;
    setColumns(prevColumns => {
        const newColumns = prevColumns.map(col => {
            if (col.id === columnId) {
                const taskToDelete = col.tasks.find(t => t.id === taskId);
                if (taskToDelete) deletedTaskContent = taskToDelete.content;
                return {
                    ...col,
                    tasks: col.tasks.filter(task => task.id !== taskId),
                };
            }
            return col;
        });
        return newColumns;
    });
     if (deletedTaskContent) {
        toast({
            title: "Task Deleted",
            description: `"${deletedTaskContent}" has been removed.`,
            variant: "destructive"
        });
    }
  };

  const updateTask = (updatedTask: Task) => {
    setColumns(prevColumns => {
        return prevColumns.map(column => ({
            ...column,
            tasks: column.tasks.map(task =>
                task.id === updatedTask.id ? { ...task, ...updatedTask } : task
            ),
        }));
    });
    toast({
        title: "Task Updated",
        description: `"${updatedTask.content}" has been updated.`,
    });
  };

   const getTaskById = (taskId: string): Task | undefined => {
    for (const column of columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  };

  const getAllTasks = (): Task[] => {
    return columns.reduce((acc, column) => acc.concat(column.tasks), [] as Task[]);
  };

  // Column Management Functions
  const addColumn = (title: string) => {
    if (!title.trim()) {
        toast({ title: "Error", description: "Column title cannot be empty.", variant: "destructive" });
        return;
    }
    const newColumn: Column = {
      id: generateId('col'),
      title: title.trim(),
      tasks: [],
    };
    setColumns(prevColumns => [...prevColumns, newColumn]);
    toast({ title: "Column Added", description: `Column "${title}" created.` });
  };

  const updateColumnTitle = (columnId: string, newTitle: string) => {
    if (!newTitle.trim()) {
        toast({ title: "Error", description: "Column title cannot be empty.", variant: "destructive" });
        return;
    }
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, title: newTitle.trim() } : col
      )
    );
    toast({ title: "Column Updated", description: `Column renamed to "${newTitle}".` });
  };

  const deleteColumn = (columnId: string) => {
    const columnToDelete = columns.find(col => col.id === columnId);
    if (!columnToDelete) return;

    if (columns.length <= 1) {
        toast({ title: "Cannot Delete", description: "You must have at least one column.", variant: "destructive" });
        return;
    }

    if (columnToDelete.tasks.length > 0) {
      toast({ title: "Cannot Delete", description: `Column "${columnToDelete.title}" contains tasks. Please move or delete them first.`, variant: "destructive" });
      return;
    }
    setColumns(prevColumns => prevColumns.filter(col => col.id !== columnId));
    toast({ title: "Column Deleted", description: `Column "${columnToDelete.title}" removed.` });
  };

  return (
    <TaskContext.Provider value={{ 
        columns, 
        setColumns, 
        addTask, 
        moveTask, 
        deleteTask, 
        updateTask, 
        getTaskById, 
        getAllTasks,
        addColumn,
        updateColumnTitle,
        deleteColumn,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
