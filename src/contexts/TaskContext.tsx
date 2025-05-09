// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Initial placeholder data for a single board's columns
const getDefaultColumns = (): Column[] => [
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

// Assign initial status to tasks for default columns
const assignTaskStatusToColumns = (columns: Column[]): Column[] => {
  return columns.map(col => ({
    ...col,
    tasks: col.tasks.map(task => ({
      ...task,
      status: col.id,
      checklist: task.checklist || [],
      dependencies: task.dependencies || [],
      tags: task.tags || [],
      createdAt: task.createdAt || formatISO(new Date()),
    }))
  }));
};


const initialDefaultBoard: Board = {
  id: generateId('board'),
  name: 'My First Board',
  columns: assignTaskStatusToColumns(getDefaultColumns()),
  createdAt: formatISO(new Date()),
  theme: {}, // Default empty theme
};


interface TaskContextType {
  boards: Board[];
  activeBoardId: string | null;
  setActiveBoardId: (boardId: string | null) => void;
  getActiveBoard: () => Board | undefined;
  addBoard: (name: string) => Board | undefined;
  deleteBoard: (boardId: string) => void;
  updateBoardName: (boardId: string, newName: string) => void;
  updateBoardTheme: (boardId: string, theme: Partial<BoardTheme>) => void;
  
  // Task and Column operations (will operate on the active board)
  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnId?: Column['id']) => void;
  moveTask: (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean) => { task: Task | null, automated: boolean };
  deleteTask: (taskId: string, columnId: Column['id']) => void;
  updateTask: (updatedTaskData: Partial<Task> & { id: string }) => void;
  getTaskById: (taskId: string) => Task | undefined; // Will search in active board
  getAllTasksOfActiveBoard: () => Task[];
  
  addColumn: (title: string) => void; // To active board
  updateColumnTitle: (columnId: string, newTitle: string) => void; // In active board
  deleteColumn: (columnId: string) => void; // From active board
  updateColumnWipLimit: (columnId: string, limit?: number) => void; // In active board
  
  addChecklistItem: (taskId: string, columnId: string, itemText: string) => void; // In active board
  toggleChecklistItem: (taskId: string, columnId: string, itemId: string) => void; // In active board
  deleteChecklistItem: (taskId: string, columnId: string, itemId: string) => void; // In active board
  updateChecklistItemText: (taskId: string, columnId: string, itemId: string, newText: string) => void; // In active board
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>(() => {
    if (typeof window !== 'undefined') {
      const savedBoards = localStorage.getItem('kanbanBoards');
      if (savedBoards) {
        try {
          const parsed = JSON.parse(savedBoards) as Board[];
          if (Array.isArray(parsed) && parsed.every(b => b.id && b.name && Array.isArray(b.columns))) {
             parsed.forEach(board => {
                board.columns = assignTaskStatusToColumns(board.columns);
                board.createdAt = board.createdAt || formatISO(new Date());
                board.theme = board.theme || {};
             });
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse boards from localStorage", e);
        }
      }
    }
    return [initialDefaultBoard]; // Start with one default board
  });

  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const savedActiveId = localStorage.getItem('activeKanbanBoardId');
      if (savedActiveId && boards.find(b => b.id === savedActiveId)) {
        return savedActiveId;
      }
    }
    return boards.length > 0 ? boards[0].id : null; // Default to first board or null
  });

  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kanbanBoards', JSON.stringify(boards));
    }
  }, [boards]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (activeBoardId) {
        localStorage.setItem('activeKanbanBoardId', activeBoardId);
      } else {
        localStorage.removeItem('activeKanbanBoardId');
      }
    }
  }, [activeBoardId]);
  
  const setActiveBoardId = useCallback((boardId: string | null) => {
    setActiveBoardIdState(boardId);
  }, []);

  const getActiveBoard = useCallback((): Board | undefined => {
    return boards.find(b => b.id === activeBoardId);
  }, [boards, activeBoardId]);

  const addBoard = (name: string): Board | undefined => {
    const newBoard: Board = {
      id: generateId('board'),
      name,
      columns: assignTaskStatusToColumns(getDefaultColumns()), // New boards get default columns
      createdAt: formatISO(new Date()),
      theme: {},
    };
    setBoards(prevBoards => [...prevBoards, newBoard]);
    setActiveBoardId(newBoard.id);
    toast({ title: "Board Created", description: `Board "${name}" has been created.`});
    return newBoard;
  };

  const deleteBoard = (boardId: string) => {
    setBoards(prevBoards => {
      const remainingBoards = prevBoards.filter(b => b.id !== boardId);
      if (activeBoardId === boardId) {
        setActiveBoardId(remainingBoards.length > 0 ? remainingBoards[0].id : null);
      }
      return remainingBoards;
    });
    toast({ title: "Board Deleted", description: "The board has been deleted."});
  };

  const updateBoardName = (boardId: string, newName: string) => {
    setBoards(prevBoards =>
      prevBoards.map(b => (b.id === boardId ? { ...b, name: newName } : b))
    );
    toast({ title: "Board Renamed", description: "Board name has been updated."});
  };
  
  const updateBoardTheme = (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    setBoards(prevBoards =>
      prevBoards.map(b =>
        b.id === boardId ? { ...b, theme: { ...(b.theme || {}), ...themeUpdate } } : b
      )
    );
     toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
  };


  // Task and Column operations (modified to work on the active board)
  const executeOnActiveBoard = <T,>(operation: (board: Board) => { updatedBoard?: Board, result?: T }): T | undefined => {
    const currentActiveBoard = getActiveBoard();
    if (!currentActiveBoard) {
      toast({ title: "No Active Board", description: "Please select or create a board first.", variant: "destructive" });
      return undefined;
    }
    
    const { updatedBoard, result } = operation(currentActiveBoard);

    if (updatedBoard) {
      setBoards(prev => prev.map(b => b.id === currentActiveBoard.id ? updatedBoard : b));
    }
    return result;
  };

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnIdInput?: Column['id']) => {
    executeOnActiveBoard(board => {
      const finalTargetColumnId = targetColumnIdInput || (board.columns.length > 0 ? board.columns[0].id : undefined);
      if (!finalTargetColumnId) {
        toast({ title: "Error Adding Task", description: "No columns available in this board.", variant: "destructive" });
        return {};
      }

      const newTask: Task = {
        id: generateId('task'),
        ...taskData,
        status: finalTargetColumnId,
        dependencies: taskData.dependencies || [],
        description: taskData.description || undefined,
        tags: taskData.tags || [],
        checklist: taskData.checklist || [],
        createdAt: formatISO(new Date()),
      };
      
      const updatedBoardColumns = board.columns.map(col => {
        if (col.id === finalTargetColumnId) {
          return { ...col, tasks: [newTask, ...col.tasks] };
        }
        return col;
      });
      toast({ title: "Task Added!", description: `Task "${newTask.content}" added.` });
      return { updatedBoard: { ...board, columns: updatedBoardColumns } };
    });
  };
  
  const moveTask = (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean): { task: Task | null, automated: boolean } => {
    const result = executeOnActiveBoard<{ task: Task | null, automated: boolean }>(board => {
      let movedTask: Task | null = null;
      let automationApplied = false;
      
      const newBoardColumns = board.columns.map(col => ({ ...col, tasks: [...col.tasks] }));
      const sourceCol = newBoardColumns.find(col => col.id === sourceColumnId);
      const targetCol = newBoardColumns.find(col => col.id === targetColumnId);

      if (!sourceCol || !targetCol) return { result: { task: null, automated: false }};

      const taskIndex = sourceCol.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) return { result: { task: null, automated: false }};
      
      [movedTask] = sourceCol.tasks.splice(taskIndex, 1);
      if (movedTask) {
        movedTask.status = targetColumnId;
        if (isBetaModeActive && targetCol.title.toLowerCase() === 'done' && movedTask.checklist && movedTask.checklist.length > 0) {
          movedTask.checklist.forEach(item => {
            if (!item.completed) { item.completed = true; automationApplied = true; }
          });
        }
        targetCol.tasks.push(movedTask);
      }
      toast({ title: "Task Moved", description: `Task "${movedTask?.content}" moved to "${targetCol.title}".`});
      if (automationApplied) toast({ title: "Automation Applied", description: "Checklist items marked complete."});
      return { updatedBoard: { ...board, columns: newBoardColumns }, result: { task: movedTask, automated: automationApplied } };
    });
    return result || { task: null, automated: false };
  };

  const deleteTask = (taskId: string, columnId: Column['id']) => {
    executeOnActiveBoard(board => {
      const updatedBoardColumns = board.columns.map(col => {
        if (col.id === columnId) {
          return { ...col, tasks: col.tasks.filter(task => task.id !== taskId) };
        }
        return col;
      });
      // toast({ title: "Task Deleted" }); // Toast handled in component for confirmation
      return { updatedBoard: { ...board, columns: updatedBoardColumns } };
    });
  };

  const updateTask = (updatedTaskData: Partial<Task> & { id: string }) => {
    executeOnActiveBoard(board => {
      const updatedBoardColumns = board.columns.map(col => ({
        ...col,
        tasks: col.tasks.map(task => task.id === updatedTaskData.id ? { ...task, ...updatedTaskData } : task)
      }));
      toast({ title: "Task Updated" });
      return { updatedBoard: { ...board, columns: updatedBoardColumns } };
    });
  };

  const getTaskById = (taskId: string): Task | undefined => {
    const board = getActiveBoard();
    if (!board) return undefined;
    for (const column of board.columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  };

  const getAllTasksOfActiveBoard = (): Task[] => {
    const board = getActiveBoard();
    return board ? board.columns.reduce((acc, column) => acc.concat(column.tasks), [] as Task[]) : [];
  };
  
  const addColumn = (title: string) => {
    executeOnActiveBoard(board => {
      const newColumn: Column = { id: generateId('col'), title, tasks: [] };
      toast({ title: "Column Added", description: `Column "${title}" created.` });
      return { updatedBoard: { ...board, columns: [...board.columns, newColumn] } };
    });
  };

  const updateColumnTitle = (columnId: string, newTitle: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => col.id === columnId ? { ...col, title: newTitle } : col);
        toast({ title: "Column Updated", description: "Column title changed."});
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };
  
  const deleteColumn = (columnId: string) => {
    executeOnActiveBoard(board => {
      // Consider moving tasks from deleted column to a default column, or prompt user. For now, tasks are deleted with column.
      const updatedCols = board.columns.filter(col => col.id !== columnId);
      toast({ title: "Column Deleted", description: "Column and its tasks have been deleted."});
      return { updatedBoard: { ...board, columns: updatedCols } };
    });
  };
  
  const updateColumnWipLimit = (columnId: string, limit?: number) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => col.id === columnId ? { ...col, wipLimit: limit } : col);
        toast({ title: "WIP Limit Updated" });
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };
  
  const addChecklistItem = (taskId: string, columnId: string, itemText: string) => {
    executeOnActiveBoard(board => {
      const updatedCols = board.columns.map(col => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: col.tasks.map(task => {
              if (task.id === taskId) {
                return { ...task, checklist: [...(task.checklist || []), { id: generateId('cl-item'), text: itemText, completed: false }]};
              }
              return task;
            })
          };
        }
        return col;
      });
      return { updatedBoard: { ...board, columns: updatedCols } };
    });
  };

  const toggleChecklistItem = (taskId: string, columnId: string, itemId: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId) {
                        return { ...task, checklist: task.checklist.map(item => item.id === itemId ? {...item, completed: !item.completed} : item)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };
  
  const deleteChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId) {
                        return { ...task, checklist: task.checklist.filter(item => item.id !== itemId)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };

  const updateChecklistItemText = (taskId: string, columnId: string, itemId: string, newText: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId) {
                        return { ...task, checklist: task.checklist.map(item => item.id === itemId ? {...item, text: newText} : item)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };

  return (
    <TaskContext.Provider value={{ 
        boards, activeBoardId, setActiveBoardId, getActiveBoard, addBoard, deleteBoard, updateBoardName, updateBoardTheme,
        addTask, moveTask, deleteTask, updateTask, getTaskById, getAllTasksOfActiveBoard,
        addColumn, updateColumnTitle, deleteColumn, updateColumnWipLimit,
        addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateChecklistItemText
    }}>
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
