'use client';

import type { Task, Column } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

// Initial placeholder data
const initialColumnsData: Column[] = [
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

interface TaskContextType {
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  addTask: (taskData: Omit<Task, 'id' | 'status'>, targetColumnId?: Column['id']) => void;
  moveTask: (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id']) => Task | null;
  deleteTask: (taskId: string, columnId: Column['id']) => void;
  updateTask: (updatedTask: Task) => void;
  getTaskById: (taskId: string) => Task | undefined;
  getAllTasks: () => Task[];
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<Column[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem('kanbanTasks');
      if (savedTasks) {
        try {
          return JSON.parse(savedTasks);
        } catch (e) {
          console.error("Failed to parse tasks from localStorage", e);
          return initialColumnsData;
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

  const addTask = (taskData: Omit<Task, 'id' | 'status'>, targetColumnId: Column['id'] = 'todo') => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      status: targetColumnId,
    };

    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const targetColumn = newColumns.find(col => col.id === targetColumnId);
      if (targetColumn) {
        targetColumn.tasks.unshift(newTask); // Add to the beginning
      } else {
        // Fallback to 'todo' if targetColumnId is invalid
        const todoColumn = newColumns.find(col => col.id === 'todo');
        if (todoColumn) {
          todoColumn.tasks.unshift({ ...newTask, status: 'todo' });
        }
      }
      return newColumns;
    });

    toast({
      title: "Task Added",
      description: `"${newTask.content}" added to ${targetColumnId === 'todo' ? 'To Do' : targetColumnId === 'inProgress' ? 'In Progress' : 'Done'}.`,
    });
  };

  const moveTask = (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id']): Task | null => {
    let movedTask: Task | null = null;
    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({
        ...col,
        tasks: col.tasks.map(task => ({ ...task })), // Deep copy tasks
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


  return (
    <TaskContext.Provider value={{ columns, setColumns, addTask, moveTask, deleteTask, updateTask, getTaskById, getAllTasks }}>
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