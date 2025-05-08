// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Initial placeholder data
const initialColumnsData: Column[] = [
  {
    id: generateId('col'),
    title: 'To Do',
    tasks: [
      { id: generateId('task'), content: 'Design the user interface mockup', status: '', priority: 'high', deadline: '2024-08-15', description: 'Create mockups for the main board and task details.', tags: ['design', 'UI'], checklist: [{id: generateId('cl'), text: 'Research color palettes', completed: true}, {id: generateId('cl'), text: 'Sketch wireframes', completed: false}], dependencies: [], createdAt: formatISO(new Date()) },
      { id: generateId('task'), content: 'Set up the project structure', status: '', priority: 'medium', description: 'Initialize Next.js, install dependencies, configure Tailwind.', tags: ['dev', 'setup'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
    wipLimit: 5,
  },
  {
    id: generateId('col'),
    title: 'In Progress',
    tasks: [
      { id: generateId('task'), content: 'Develop the Kanban board component', status: '', priority: 'high', description: 'Build the main drag-and-drop interface.', tags: ['dev', 'kanban'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
    wipLimit: 3,
  },
  {
    id: generateId('col'),
    title: 'Done',
    tasks: [
      { id: generateId('task'), content: 'Gather project requirements', status: '', description: 'Define features and user stories.', tags: ['planning'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
  },
];

// Assign initial status to tasks and ensure all fields are present
initialColumnsData.forEach(col => {
  col.tasks.forEach(task => {
    task.status = col.id;
    if (task.checklist === undefined) task.checklist = [];
    if (task.dependencies === undefined) task.dependencies = [];
    if (task.tags === undefined) task.tags = [];
    if (task.createdAt === undefined) task.createdAt = formatISO(new Date());
  });
});


interface TaskContextType {
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnId?: Column['id']) => void;
  moveTask: (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean) => { task: Task | null, automated: boolean };
  deleteTask: (taskId: string, columnId: Column['id']) => void;
  updateTask: (updatedTaskData: Partial<Task> & { id: string }) => void;
  getTaskById: (taskId: string) => Task | undefined;
  getAllTasks: () => Task[];
  addColumn: (title: string) => void;
  updateColumnTitle: (columnId: string, newTitle: string) => void;
  deleteColumn: (columnId: string) => void;
  updateColumnWipLimit: (columnId: string, limit?: number) => void;
  addChecklistItem: (taskId: string, columnId: string, itemText: string) => void;
  toggleChecklistItem: (taskId: string, columnId: string, itemId: string) => void;
  deleteChecklistItem: (taskId: string, columnId: string, itemId: string) => void;
  updateChecklistItemText: (taskId: string, columnId: string, itemId: string, newText: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<Column[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem('kanbanTasks');
      if (savedTasks) {
        try {
          const parsed = JSON.parse(savedTasks) as Column[];
          if (Array.isArray(parsed) && parsed.every(col => col.id && col.title && Array.isArray(col.tasks))) {
            parsed.forEach(col => {
              col.tasks.forEach(task => {
                if (!Array.isArray(task.checklist)) task.checklist = [];
                if (!Array.isArray(task.dependencies)) task.dependencies = [];
                if (!Array.isArray(task.tags)) task.tags = [];
                if (!task.createdAt) task.createdAt = formatISO(new Date());
              });
            });
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

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnId?: Column['id']) => {
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
      id: generateId('task'),
      content: taskData.content,
      status: finalTargetColumnId,
      priority: taskData.priority,
      deadline: taskData.deadline || undefined,
      dependencies: taskData.dependencies || [],
      description: taskData.description || undefined,
      tags: taskData.tags || [],
      checklist: taskData.checklist || [],
      createdAt: formatISO(new Date()),
    };

    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const targetColumn = newColumns.find(col => col.id === finalTargetColumnId);
      if (targetColumn) {
        targetColumn.tasks.unshift(newTask);
      } else {
         console.error(`Target column with id ${finalTargetColumnId} not found.`);
         return prevColumns;
      }
      return newColumns;
    });
  };

  const moveTask = (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean) => {
    let movedTask: Task | null = null;
    let automationApplied = false;

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

        if (isBetaModeActive && targetCol.title.toLowerCase() === 'done' && movedTask.checklist && movedTask.checklist.length > 0) {
          movedTask.checklist.forEach(item => {
            if (!item.completed) {
                 item.completed = true;
                 automationApplied = true; // Set flag only if an item was actually changed
            }
          });
        }
        targetCol.tasks.push(movedTask);
      }
      return newColumns;
    });
    return { task: movedTask, automated: automationApplied };
  };

  const deleteTask = (taskId: string, columnId: Column['id']) => {
    setColumns(prevColumns => {
      return prevColumns.map(col => {
        if (col.id === columnId) {
          col.tasks = col.tasks.filter(task => task.id !== taskId);
        }
        return col;
      });
    });
  };

  const updateTask = (updatedTaskData: Partial<Task> & { id: string }) => {
    setColumns(prevColumns => {
      return prevColumns.map(column => {
        column.tasks = column.tasks.map(task => {
          if (task.id === updatedTaskData.id) {
            task = { ...task, ...updatedTaskData };
          }
          return task;
        });
        return column;
      });
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
    const newColumn: Column = {
      id: generateId('col'),
      title: title,
      tasks: [],
    };
    setColumns(prevColumns => [...prevColumns, newColumn]);
  };

  const updateColumnTitle = (columnId: string, newTitle: string) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, title: newTitle } : col
      )
    );
  };

  const updateColumnWipLimit = (columnId: string, limit?: number) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, wipLimit: limit } : col
      )
    );
  };

  const deleteColumn = (columnId: string) => {
    setColumns(prevColumns => prevColumns.filter(col => col.id !== columnId));
  };

  // Checklist item functions
  const addChecklistItem = (taskId: string, columnId: string, itemText: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        col.tasks = col.tasks.map(task => {
          if (task.id === taskId) {
            task.checklist = [...(task.checklist || []), { id: generateId('cl-item'), text: itemText, completed: false }];
          }
          return task;
        });
      }
      return col;
    }));
  };

  const toggleChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        col.tasks = col.tasks.map(task => {
          if (task.id === taskId) {
            task.checklist = task.checklist.map(item => {
              if (item.id === itemId) {
                item.completed = !item.completed;
              }
              return item;
            });
          }
          return task;
        });
      }
      return col;
    }));
  };

  const deleteChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        col.tasks = col.tasks.map(task => {
          if (task.id === taskId) {
            task.checklist = task.checklist.filter(item => item.id !== itemId);
          }
          return task;
        });
      }
      return col;
    }));
  };
  
  const updateChecklistItemText = (taskId: string, columnId: string, itemId: string, newText: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        col.tasks = col.tasks.map(task => {
          if (task.id === taskId) {
            task.checklist = task.checklist.map(item => {
              if (item.id === itemId) {
                item.text = newText;
              }
              return item;
            });
          }
          return task;
        });
      }
      return col;
    }));
  };


  return (
    <TaskContext.Provider value={{ columns, setColumns, addTask, moveTask, deleteTask, updateTask, getTaskById, getAllTasks, addColumn, updateColumnTitle, deleteColumn, updateColumnWipLimit, addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateChecklistItemText }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}

