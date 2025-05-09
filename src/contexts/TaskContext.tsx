// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';
import { useAuth } from './AuthContext'; // Import useAuth

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


const initialDefaultBoardForUser = (userId: string, provider: string): Board => ({
  id: generateId(`board-${provider}-${userId}`),
  name: 'My First Board',
  columns: assignTaskStatusToColumns(getDefaultColumns()),
  createdAt: formatISO(new Date()),
  theme: {}, // Default empty theme
});


interface TaskContextType {
  boards: Board[];
  activeBoardId: string | null;
  setActiveBoardId: (boardId: string | null) => void;
  getActiveBoard: () => Board | undefined;
  addBoard: (name: string) => Board | undefined;
  deleteBoard: (boardId: string) => void;
  updateBoardName: (boardId: string, newName: string) => void;
  updateBoardTheme: (boardId: string, theme: Partial<BoardTheme>) => void;
  
  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnId?: Column['id']) => void;
  moveTask: (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean) => { task: Task | null, automated: boolean };
  deleteTask: (taskId: string, columnId: Column['id']) => void;
  updateTask: (updatedTaskData: Partial<Task> & { id: string }) => void;
  getTaskById: (taskId: string) => Task | undefined;
  getAllTasksOfActiveBoard: () => Task[];
  
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
  const { currentUser } = useAuth(); // Get currentUser for namespacing
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(null);
  const { toast } = useToast();

  const getStorageKey = useCallback((baseKey: string) => {
    if (currentUser) {
      return `${baseKey}-${currentUser.provider}-${currentUser.id}`;
    }
    return null; // No user, no storage
  }, [currentUser]);

  // Load boards and activeBoardId from localStorage on user change
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      const boardsKey = getStorageKey('kanbanBoards');
      const activeIdKey = getStorageKey('activeKanbanBoardId');

      if (boardsKey) {
        const savedBoards = localStorage.getItem(boardsKey);
        if (savedBoards) {
          try {
            const parsed = JSON.parse(savedBoards) as Board[];
            if (Array.isArray(parsed) && parsed.every(b => b.id && b.name && Array.isArray(b.columns))) {
              parsed.forEach(board => {
                board.columns = assignTaskStatusToColumns(board.columns);
                board.createdAt = board.createdAt || formatISO(new Date());
                board.theme = board.theme || {};
              });
              setBoards(parsed);

              if (activeIdKey) {
                const savedActiveId = localStorage.getItem(activeIdKey);
                if (savedActiveId && parsed.find(b => b.id === savedActiveId)) {
                  setActiveBoardIdState(savedActiveId);
                } else if (parsed.length > 0) {
                  setActiveBoardIdState(parsed[0].id);
                } else {
                  setActiveBoardIdState(null);
                }
              }

            } else { // Data is malformed, initialize
                const defaultBoard = initialDefaultBoardForUser(currentUser.id, currentUser.provider);
                setBoards([defaultBoard]);
                setActiveBoardIdState(defaultBoard.id);
            }
          } catch (e) {
            console.error("Failed to parse boards from localStorage", e);
            const defaultBoard = initialDefaultBoardForUser(currentUser.id, currentUser.provider);
            setBoards([defaultBoard]);
            setActiveBoardIdState(defaultBoard.id);
          }
        } else { // No saved boards for this user, initialize
          const defaultBoard = initialDefaultBoardForUser(currentUser.id, currentUser.provider);
          setBoards([defaultBoard]);
          setActiveBoardIdState(defaultBoard.id);
        }
      }
    } else if (!currentUser) { // User logged out, clear state
      setBoards([]);
      setActiveBoardIdState(null);
    }
  }, [currentUser, getStorageKey]);


  // Save boards to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      const key = getStorageKey('kanbanBoards');
      if (key && boards.length > 0) { // Only save if there are boards, to avoid overwriting with empty on logout flash
        localStorage.setItem(key, JSON.stringify(boards));
      } else if (key && boards.length === 0 && currentUser) { // If user is logged in and boards are intentionally empty
        localStorage.setItem(key, JSON.stringify([]));
      }
    }
  }, [boards, currentUser, getStorageKey]);

  // Save activeBoardId to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      const key = getStorageKey('activeKanbanBoardId');
      if (key) {
        if (activeBoardId) {
          localStorage.setItem(key, activeBoardId);
        } else {
          localStorage.removeItem(key);
        }
      }
    }
  }, [activeBoardId, currentUser, getStorageKey]);
  
  const setActiveBoardId = useCallback((boardId: string | null) => {
    setActiveBoardIdState(boardId);
  }, []);

  const getActiveBoard = useCallback((): Board | undefined => {
    return boards.find(b => b.id === activeBoardId);
  }, [boards, activeBoardId]);

  const addBoard = (name: string): Board | undefined => {
    if (!currentUser) {
        toast({ title: "Not Authenticated", description: "You must be logged in to add a board.", variant: "destructive"});
        return undefined;
    }
    const newBoard: Board = {
      id: generateId(`board-${currentUser.provider}-${currentUser.id}`),
      name,
      columns: assignTaskStatusToColumns(getDefaultColumns()),
      createdAt: formatISO(new Date()),
      theme: {},
    };
    setBoards(prevBoards => [...prevBoards, newBoard]);
    setActiveBoardId(newBoard.id);
    toast({ title: "Board Created", description: `Board "${name}" has been created.`});
    return newBoard;
  };

  const deleteBoard = (boardId: string) => {
    if (!currentUser) return;
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
    if (!currentUser) return;
    setBoards(prevBoards =>
      prevBoards.map(b => (b.id === boardId ? { ...b, name: newName } : b))
    );
    toast({ title: "Board Renamed", description: "Board name has been updated."});
  };
  
  const updateBoardTheme = (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    if (!currentUser) return;
    setBoards(prevBoards =>
      prevBoards.map(b =>
        b.id === boardId ? { ...b, theme: { ...(b.theme || {}), ...themeUpdate } } : b
      )
    );
     toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
  };

  const executeOnActiveBoard = <T,>(operation: (board: Board) => { updatedBoard?: Board, result?: T }): T | undefined => {
    if (!currentUser) {
      toast({ title: "Not Authenticated", description: "Action requires login.", variant: "destructive"});
      return undefined;
    }
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
