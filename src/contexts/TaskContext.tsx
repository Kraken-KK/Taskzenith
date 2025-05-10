// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';
import { useAuth } from './AuthContext'; 
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Initial placeholder data for a single board's columns for guest
const getDefaultColumnsForGuest = (): Column[] => [
  {
    id: generateId('col-guest'),
    title: 'To Do',
    tasks: [
      { id: generateId('task-guest'), content: 'Design the user interface mockup', status: '', priority: 'high', deadline: '2024-08-15', description: 'Create mockups for the main board and task details.', tags: ['design', 'UI'], checklist: [{id: generateId('cl-guest'), text: 'Research color palettes', completed: true}, {id: generateId('cl-guest'), text: 'Sketch wireframes', completed: false}], dependencies: [], createdAt: formatISO(new Date()) },
      { id: generateId('task-guest'), content: 'Set up the project structure', status: '', priority: 'medium', description: 'Initialize Next.js, install dependencies, configure Tailwind.', tags: ['dev', 'setup'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
    wipLimit: 5,
  },
  {
    id: generateId('col-guest'),
    title: 'In Progress',
    tasks: [
      { id: generateId('task-guest'), content: 'Develop the Kanban board component', status: '', priority: 'high', description: 'Build the main drag-and-drop interface.', tags: ['dev', 'kanban'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
    wipLimit: 3,
  },
  {
    id: generateId('col-guest'),
    title: 'Done',
    tasks: [
      { id: generateId('task-guest'), content: 'Gather project requirements', status: '', description: 'Define features and user stories.', tags: ['planning'], checklist: [], dependencies: [], createdAt: formatISO(new Date()) },
    ],
  },
];

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

const initialDefaultBoardForGuest = (): Board => ({
    id: generateId('board-guest-main'),
    name: 'Guest Board',
    columns: assignTaskStatusToColumns(getDefaultColumnsForGuest()),
    createdAt: formatISO(new Date()),
    theme: {},
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
  const { currentUser, isGuest, loading: authLoading } = useAuth(); 
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(null);
  const { toast } = useToast();
  const [isLoadingData, setIsLoadingData] = useState(true);


  // Load data from Firestore for logged-in user or localStorage for guest
  useEffect(() => {
    const loadData = async () => {
      console.log("TaskContext: Attempting to load data. AuthLoading:", authLoading, "CurrentUser:", !!currentUser, "IsGuest:", isGuest);
      setIsLoadingData(true);
      if (authLoading) {
        console.log("TaskContext: Auth is loading, deferring data load.");
        return; 
      }

      if (currentUser && !isGuest) { 
        console.log(`TaskContext: Logged-in user (${currentUser.id}). Loading data from Firestore.`);
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("TaskContext: User document found in Firestore:", userData);
            const firestoreBoards = (userData.boards || []) as Board[];
             const sanitizedBoards = firestoreBoards.map(board => ({
                ...board,
                id: board.id || generateId('board-fb'),
                name: board.name || 'Untitled Board',
                columns: Array.isArray(board.columns) ? assignTaskStatusToColumns(board.columns.map(col => ({
                    ...col,
                    id: col.id || generateId('col-fb'),
                    title: col.title || 'Untitled Column',
                    tasks: Array.isArray(col.tasks) ? col.tasks.map(task => ({
                        ...task,
                        id: task.id || generateId('task-fb'),
                        content: task.content || 'Untitled Task',
                        status: col.id || '', // Ensure status is set, will be overwritten by assignTaskStatusToColumns
                        priority: task.priority || 'medium',
                        createdAt: task.createdAt || formatISO(new Date()),
                        checklist: task.checklist || [],
                        dependencies: task.dependencies || [],
                        tags: task.tags || [],
                    })) : [],
                }))) : [],
                createdAt: board.createdAt || formatISO(new Date()),
                theme: board.theme || {},
            }));

            setBoards(sanitizedBoards);
            console.log("TaskContext: Boards sanitized and set from Firestore:", sanitizedBoards.length, "boards");

            const firestoreActiveBoardId = userData.activeBoardId as string | null;
            if (firestoreActiveBoardId && sanitizedBoards.find(b => b.id === firestoreActiveBoardId)) {
              setActiveBoardIdState(firestoreActiveBoardId);
              console.log("TaskContext: Active board ID set from Firestore:", firestoreActiveBoardId);
            } else if (sanitizedBoards.length > 0) {
              setActiveBoardIdState(sanitizedBoards[0].id);
              console.log("TaskContext: Active board ID set to first available board:", sanitizedBoards[0].id);
              if (firestoreActiveBoardId !== sanitizedBoards[0].id) {
                console.log("TaskContext: Updating Firestore activeBoardId because it was invalid or not set.");
                await updateDoc(userDocRef, { activeBoardId: sanitizedBoards[0].id });
              }
            } else {
              setActiveBoardIdState(null);
              console.log("TaskContext: No boards found for user, activeBoardId set to null.");
            }
          } else {
            console.warn("TaskContext: User document not found in Firestore for logged-in user. This should be handled by AuthContext creating the user doc with defaults.");
            setBoards([]); 
            setActiveBoardIdState(null);
          }
        } catch (error) {
          console.error("TaskContext: Error loading user data from Firestore:", error);
          toast({ title: "Data Load Error", description: "Could not load your board data.", variant: "destructive" });
          setBoards([]);
          setActiveBoardIdState(null);
        }
      } else if (isGuest) { 
        console.log("TaskContext: Guest user. Loading data from localStorage.");
        const guestBoardsKey = 'kanbanBoards-guestSession';
        const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
        const savedBoards = localStorage.getItem(guestBoardsKey);
        if (savedBoards) {
          try {
            const parsed = JSON.parse(savedBoards) as Board[];
             const sanitizedBoards = parsed.map(board => ({
                ...board,
                id: board.id || generateId('board-guest-parsed'),
                name: board.name || 'Untitled Guest Board',
                columns: Array.isArray(board.columns) ? assignTaskStatusToColumns(board.columns.map(col => ({
                    ...col,
                    id: col.id || generateId('col-guest-parsed'),
                    title: col.title || 'Untitled Guest Column',
                    tasks: Array.isArray(col.tasks) ? col.tasks.map(task => ({
                        ...task,
                        id: task.id || generateId('task-guest-parsed'),
                        content: task.content || 'Untitled Guest Task',
                        status: col.id || '',
                        priority: task.priority || 'medium',
                        createdAt: task.createdAt || formatISO(new Date()),
                        checklist: task.checklist || [],
                        dependencies: task.dependencies || [],
                        tags: task.tags || [],
                    })) : [],
                }))) : [],
                createdAt: board.createdAt || formatISO(new Date()),
                theme: board.theme || {},
            }));
            setBoards(sanitizedBoards);
            console.log("TaskContext: Boards set from localStorage for guest:", sanitizedBoards.length, "boards");

            const savedActiveId = localStorage.getItem(guestActiveIdKey);
            if (savedActiveId && sanitizedBoards.find(b => b.id === savedActiveId)) {
              setActiveBoardIdState(savedActiveId);
            } else if (sanitizedBoards.length > 0) {
              setActiveBoardIdState(sanitizedBoards[0].id);
            } else {
               const defaultGuestBoard = initialDefaultBoardForGuest();
               setBoards([defaultGuestBoard]);
               setActiveBoardIdState(defaultGuestBoard.id);
               console.log("TaskContext: No boards in localStorage for guest, initialized with default guest board.");
            }
          } catch (e) {
            console.error("TaskContext: Failed to parse guest boards from localStorage", e);
            const defaultGuestBoard = initialDefaultBoardForGuest();
            setBoards([defaultGuestBoard]);
            setActiveBoardIdState(defaultGuestBoard.id);
          }
        } else {
          const defaultGuestBoard = initialDefaultBoardForGuest();
          setBoards([defaultGuestBoard]);
          setActiveBoardIdState(defaultGuestBoard.id);
          console.log("TaskContext: No boards in localStorage for guest, initialized with default guest board.");
        }
      } else { 
        console.log("TaskContext: No user and not guest. Clearing boards.");
        setBoards([]);
        setActiveBoardIdState(null);
      }
      setIsLoadingData(false);
      console.log("TaskContext: Data loading finished.");
    };

    loadData();
  }, [currentUser, isGuest, authLoading, toast]);

  // Save data to Firestore for logged-in user or localStorage for guest
  useEffect(() => {
    if (isLoadingData || authLoading) {
      console.log("TaskContext Save: Skipping save due to isLoadingData or authLoading.");
      return; 
    }

    const saveData = async () => {
      if (currentUser && !isGuest) { // Logged-in user
        console.log(`TaskContext Save: Logged-in user (${currentUser.id}). Saving data to Firestore.`);
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
           const boardsToSave = boards.map(board => ({
            ...board,
            columns: board.columns.map(column => ({
              ...column,
              tasks: column.tasks.map(task => ({
                ...task,
                checklist: task.checklist || [],
                dependencies: task.dependencies || [],
                tags: task.tags || [],
                createdAt: task.createdAt || formatISO(new Date()),
              }))
            }))
          }));
          await updateDoc(userDocRef, { boards: boardsToSave, activeBoardId });
          console.log("TaskContext Save: Data saved to Firestore for user", currentUser.id);
        } catch (error) {
          console.error("TaskContext Save: Error saving user data to Firestore:", error);
        }
      } else if (isGuest) { // Guest user
        console.log("TaskContext Save: Guest user. Saving data to localStorage.");
        const guestBoardsKey = 'kanbanBoards-guestSession';
        const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
        localStorage.setItem(guestBoardsKey, JSON.stringify(boards));
        if (activeBoardId) {
          localStorage.setItem(guestActiveIdKey, activeBoardId);
        } else {
          localStorage.removeItem(guestActiveIdKey);
        }
        console.log("TaskContext Save: Data saved to localStorage for guest.");
      }
    };
    saveData();
  }, [boards, activeBoardId, currentUser, isGuest, isLoadingData, authLoading, toast]);
  
  const setActiveBoardId = useCallback((boardId: string | null) => {
    console.log("TaskContext: Setting active board ID to:", boardId);
    setActiveBoardIdState(boardId);
  }, []);

  const getActiveBoard = useCallback((): Board | undefined => {
    return boards.find(b => b.id === activeBoardId);
  }, [boards, activeBoardId]);

  const addBoard = (name: string): Board | undefined => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", description: "You must be logged in or in guest mode to add a board.", variant: "destructive"});
        return undefined;
    }
    const newBoardId = isGuest ? generateId('board-guest') : generateId(`board-user`);
    const newBoard: Board = {
      id: newBoardId,
      name,
      columns: assignTaskStatusToColumns([
        { id: generateId('col'), title: 'To Do', tasks: [], wipLimit: 0 },
        { id: generateId('col'), title: 'In Progress', tasks: [], wipLimit: 0 },
        { id: generateId('col'), title: 'Done', tasks: [], wipLimit: 0 },
      ]),
      createdAt: formatISO(new Date()),
      theme: {},
    };
    setBoards(prevBoards => [...prevBoards, newBoard]);
    setActiveBoardId(newBoard.id); 
    toast({ title: "Board Created", description: `Board "${name}" has been created.`});
    console.log("TaskContext: Board added:", newBoard.id, newName);
    return newBoard;
  };

  const deleteBoard = (boardId: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards => {
      const remainingBoards = prevBoards.filter(b => b.id !== boardId);
      if (activeBoardId === boardId) { 
        setActiveBoardId(remainingBoards.length > 0 ? remainingBoards[0].id : null);
      }
      return remainingBoards;
    });
    toast({ title: "Board Deleted", description: "The board has been deleted."});
    console.log("TaskContext: Board deleted:", boardId);
  };

  const updateBoardName = (boardId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b => (b.id === boardId ? { ...b, name: newName } : b))
    );
    toast({ title: "Board Renamed", description: "Board name has been updated."});
     console.log("TaskContext: Board renamed:", boardId, "to", newName);
  };
  
  const updateBoardTheme = (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b =>
        b.id === boardId ? { ...b, theme: { ...(b.theme || {}), ...themeUpdate } } : b
      )
    );
     toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
     console.log("TaskContext: Board theme updated for board:", boardId);
  };

  const executeOnActiveBoard = <T,>(operation: (board: Board) => { updatedBoard?: Board, result?: T }): T | undefined => {
    if ((!currentUser && !isGuest) || !activeBoardId) {
      toast({ title: "Action Denied", description: "Operation requires an active board and user/guest session.", variant: "destructive"});
      console.warn("TaskContext: executeOnActiveBoard called without active user/guest or active board.");
      return undefined;
    }
    
    let resultFromOperation: T | undefined;
    setBoards(prevBoards => {
        const boardIndex = prevBoards.findIndex(b => b.id === activeBoardId);
        if (boardIndex === -1) {
            toast({ title: "Error", description: "Active board not found.", variant: "destructive"});
            console.error("TaskContext: Active board not found in executeOnActiveBoard. ID:", activeBoardId);
            return prevBoards;
        }
        const currentActiveBoard = prevBoards[boardIndex];
        const { updatedBoard, result } = operation(currentActiveBoard);
        resultFromOperation = result;

        if (updatedBoard) {
            const newBoards = [...prevBoards];
            newBoards[boardIndex] = updatedBoard;
            return newBoards;
        }
        return prevBoards;
    });
    return resultFromOperation;
  };

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline'>>, targetColumnIdInput?: Column['id']) => {
    executeOnActiveBoard(board => {
      const finalTargetColumnId = targetColumnIdInput || (board.columns.length > 0 ? board.columns[0].id : undefined);
      if (!finalTargetColumnId) {
        toast({ title: "Error Adding Task", description: "No columns available in this board.", variant: "destructive" });
        console.error("TaskContext: Cannot add task, no target column ID and no columns on board.");
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
      console.log("TaskContext: Task added:", newTask.id, "to column", finalTargetColumnId);
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

      if (!sourceCol || !targetCol) {
        console.error("TaskContext: Source or target column not found for moveTask.");
        return { result: { task: null, automated: false }};
      }

      const taskIndex = sourceCol.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) {
        console.error("TaskContext: Task not found in source column for moveTask.");
        return { result: { task: null, automated: false }};
      }
      
      [movedTask] = sourceCol.tasks.splice(taskIndex, 1);
      if (movedTask) {
        movedTask.status = targetColumnId;
        if (isBetaModeActive && targetCol.title.toLowerCase() === 'done' && movedTask.checklist && movedTask.checklist.length > 0) {
          movedTask.checklist.forEach(item => {
            if (!item.completed) { item.completed = true; automationApplied = true; }
          });
        }
        targetCol.tasks.unshift(movedTask); 
      }
      toast({ title: "Task Moved", description: `Task "${movedTask?.content}" moved to "${targetCol.title}".`});
      if (automationApplied) toast({ title: "Automation Applied", description: "Checklist items marked complete."});
      console.log("TaskContext: Task moved:", taskId, "from", sourceColumnId, "to", targetColumnId, "Automation:", automationApplied);
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
      toast({ title: "Task Deleted" });
      console.log("TaskContext: Task deleted:", taskId, "from column", columnId);
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
      console.log("TaskContext: Task updated:", updatedTaskData.id);
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
      console.log("TaskContext: Column added:", newColumn.id, title);
      return { updatedBoard: { ...board, columns: [...board.columns, newColumn] } };
    });
  };

  const updateColumnTitle = (columnId: string, newTitle: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => col.id === columnId ? { ...col, title: newTitle } : col);
        toast({ title: "Column Updated", description: "Column title changed."});
        console.log("TaskContext: Column title updated:", columnId, "to", newTitle);
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };
  
  const deleteColumn = (columnId: string) => {
    executeOnActiveBoard(board => {
      const updatedCols = board.columns.filter(col => col.id !== columnId);
      toast({ title: "Column Deleted", description: "Column and its tasks have been deleted."});
      console.log("TaskContext: Column deleted:", columnId);
      return { updatedBoard: { ...board, columns: updatedCols } };
    });
  };
  
  const updateColumnWipLimit = (columnId: string, limit?: number) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => col.id === columnId ? { ...col, wipLimit: limit } : col);
        toast({ title: "WIP Limit Updated" });
        console.log("TaskContext: Column WIP limit updated:", columnId, "to", limit);
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
                const newChecklist = [...(task.checklist || []), { id: generateId('cl-item'), text: itemText, completed: false }];
                return { ...task, checklist: newChecklist};
              }
              return task;
            })
          };
        }
        return col;
      });
      console.log("TaskContext: Checklist item added to task", taskId);
      return { updatedBoard: { ...board, columns: updatedCols } };
    });
  };

  const toggleChecklistItem = (taskId: string, columnId: string, itemId: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.map(item => item.id === itemId ? {...item, completed: !item.completed} : item);
                        return { ...task, checklist: newChecklist};
                    }
                    return task;
                })};
            }
            return col;
        });
        console.log("TaskContext: Checklist item toggled for task", taskId, "item", itemId);
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };
  
  const deleteChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.filter(item => item.id !== itemId);
                        return { ...task, checklist: newChecklist};
                    }
                    return task;
                })};
            }
            return col;
        });
        console.log("TaskContext: Checklist item deleted for task", taskId, "item", itemId);
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };

  const updateChecklistItemText = (taskId: string, columnId: string, itemId: string, newText: string) => {
     executeOnActiveBoard(board => {
        const updatedCols = board.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: col.tasks.map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.map(item => item.id === itemId ? {...item, text: newText} : item);
                        return { ...task, checklist: newChecklist};
                    }
                    return task;
                })};
            }
            return col;
        });
        console.log("TaskContext: Checklist item text updated for task", taskId, "item", itemId);
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };

  if (isLoadingData || authLoading) {
     return (
      <TaskContext.Provider value={{ 
        boards: [], activeBoardId: null, setActiveBoardId: () => {}, getActiveBoard: () => undefined, addBoard: () => undefined, deleteBoard: () => {}, updateBoardName: () => {}, updateBoardTheme: () => {},
        addTask: () => {}, moveTask: () => ({task: null, automated: false }), deleteTask: () => {}, updateTask: () => {}, getTaskById: () => undefined, getAllTasksOfActiveBoard: () => [],
        addColumn: () => {}, updateColumnTitle: () => {}, deleteColumn: () => {}, updateColumnWipLimit: () => {},
        addChecklistItem: () => {}, toggleChecklistItem: () => {}, deleteChecklistItem: () => {}, updateChecklistItemText: () => {}
      }}>
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <svg className="animate-spin h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </TaskContext.Provider>
    );
  }


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

