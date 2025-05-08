'use client';

import type { Task, Column, ChecklistItem } from '@/types';
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
      { id: generateId('task'), content: 'Design the user interface mockup', status: '', priority: 'high', deadline: '2024-08-15', description: 'Create mockups for the main board and task details.', tags: ['design', 'UI'], checklist: [{id: generateId('cl'), text: 'Research color palettes', completed: true}, {id: generateId('cl'), text: 'Sketch wireframes', completed: false}] },
      { id: generateId('task'), content: 'Set up the project structure', status: '', priority: 'medium', description: 'Initialize Next.js, install dependencies, configure Tailwind.', tags: ['dev', 'setup'] },
    ],
    wipLimit: 5,
  },
  {
    id: generateId('col'),
    title: 'In Progress',
    tasks: [
      { id: generateId('task'), content: 'Develop the Kanban board component', status: '', priority: 'high', description: 'Build the main drag-and-drop interface.', tags: ['dev', 'kanban'] },
    ],
    wipLimit: 3,
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
    // Ensure checklist exists if not provided in initial data for some tasks
    if (task.checklist === undefined) {
        task.checklist = [];
    }
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
          // Basic validation to ensure it's an array and items have id and title
          if (Array.isArray(parsed) && parsed.every(col => col.id && col.title && Array.isArray(col.tasks))) {
            // Ensure all tasks have a checklist array
            parsed.forEach(col => {
              col.tasks.forEach(task => {
                if (!Array.isArray(task.checklist)) {
                  task.checklist = [];
                }
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
      status: finalTargetColumnId,
      tags: taskData.tags || [],
      checklist: taskData.checklist || [],
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
                task.id === updatedTask.id ? { ...task, ...updatedTask, checklist: updatedTask.checklist || task.checklist || [] } : task
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

  const updateColumnWipLimit = (columnId: string, limit?: number) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, wipLimit: limit } : col
      )
    );
    const col = columns.find(c => c.id === columnId);
    if (col) {
      toast({ title: "WIP Limit Updated", description: `WIP Limit for "${col.title}" set to ${limit === undefined ? 'none' : limit}.` });
    }
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

  // Checklist item functions
  const addChecklistItem = (taskId: string, columnId: string, itemText: string) => {
    if (!itemText.trim()) return;
    const newItem: ChecklistItem = { id: generateId('cl-item'), text: itemText.trim(), completed: false };
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          tasks: col.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, checklist: [...(task.checklist || []), newItem] };
            }
            return task;
          })
        };
      }
      return col;
    }));
  };

  const toggleChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          tasks: col.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                checklist: (task.checklist || []).map(item =>
                  item.id === itemId ? { ...item, completed: !item.completed } : item
                )
              };
            }
            return task;
          })
        };
      }
      return col;
    }));
  };

  const deleteChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          tasks: col.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, checklist: (task.checklist || []).filter(item => item.id !== itemId) };
            }
            return task;
          })
        };
      }
      return col;
    }));
  };
  
  const updateChecklistItemText = (taskId: string, columnId: string, itemId: string, newText: string) => {
    if (!newText.trim()) {
      // Optionally delete if text is empty, or prevent update
      deleteChecklistItem(taskId, columnId, itemId);
      return;
    }
    setColumns(prev => prev.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          tasks: col.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                checklist: (task.checklist || []).map(item =>
                  item.id === itemId ? { ...item, text: newText.trim() } : item
                )
              };
            }
            return task;
          })
        };
      }
      return col;
    }));
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
        updateColumnWipLimit,
        addChecklistItem,
        toggleChecklistItem,
        deleteChecklistItem,
        updateChecklistItemText,
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
