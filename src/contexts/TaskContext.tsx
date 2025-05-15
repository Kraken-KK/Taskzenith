
// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme, BoardGroup } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';
import { useAuth } from './AuthContext'; 
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Enhanced assignTaskStatusToColumns and default value setter
const sanitizeAndAssignColumns = (columns: Column[] = []): Column[] => {
  return columns.map((col) => {
    const columnId = col.id || generateId('col-sanitized');
    return {
      id: columnId,
      title: col.title || 'Untitled Column',
      wipLimit: col.wipLimit === undefined || col.wipLimit < 0 ? 0 : col.wipLimit,
      tasks: Array.isArray(col.tasks) ? col.tasks.map((task) => ({
        id: task.id || generateId('task-sanitized'),
        content: task.content || 'Untitled Task',
        status: columnId, // Crucial: ensure task status matches its column
        priority: task.priority || 'medium',
        createdAt: task.createdAt || formatISO(new Date()),
        description: task.description || null, // Changed from undefined to null
        deadline: task.deadline || null, // Changed from undefined to null
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        checklist: Array.isArray(task.checklist) ? task.checklist.map(ci => ({
          id: ci.id || generateId('cl-item-sanitized'),
          text: ci.text || '',
          completed: ci.completed || false,
        })) : [],
        tags: Array.isArray(task.tags) ? task.tags : [],
        assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      })) : [],
    };
  });
};

const sanitizeBoard = (board: Partial<Board>): Board => {
  const boardId = board.id || generateId('board-sanitized');
  return {
    id: boardId,
    name: board.name || 'Untitled Board',
    columns: sanitizeAndAssignColumns(board.columns),
    createdAt: board.createdAt || formatISO(new Date()),
    theme: board.theme || {},
    groupId: board.groupId === undefined ? null : board.groupId,
    organizationId: board.organizationId === undefined ? null : board.organizationId,
    teamId: board.teamId === undefined ? null : board.teamId,
    isPublic: board.isPublic === undefined ? false : board.isPublic,
  };
};

const sanitizeBoardGroup = (group: Partial<BoardGroup>): BoardGroup => {
  return {
    id: group.id || generateId('group-sanitized'),
    name: group.name || 'Untitled Group',
    boardIds: Array.isArray(group.boardIds) ? group.boardIds : [],
    createdAt: group.createdAt || formatISO(new Date()),
  };
};

const initialDefaultBoardForGuest = (): Board => sanitizeBoard({
    name: 'My Guest Board',
    columns: [
      { id: generateId('col-guest'), title: 'To Do', tasks: [{ id: generateId('task-guest'), content: 'Welcome! Plan your day', priority: 'high', createdAt: formatISO(new Date()) } as Task], wipLimit: 0 },
      { id: generateId('col-guest'), title: 'In Progress', tasks: [], wipLimit: 0 },
      { id: generateId('col-guest'), title: 'Done', tasks: [], wipLimit: 0 },
    ],
});


interface TaskContextType {
  boards: Board[];
  activeBoardId: string | null;
  setActiveBoardId: (boardId: string | null) => void;
  getActiveBoard: () => Board | undefined;
  addBoard: (name: string, groupId?: string | null, organizationId?: string | null, teamId?: string | null) => Board | undefined;
  deleteBoard: (boardId: string) => void;
  updateBoardName: (boardId: string, newName: string) => void;
  updateBoardTheme: (boardId: string, theme: Partial<BoardTheme>) => void;
  updateBoardGroupId: (boardId: string, groupId: string | null) => void;
  updateBoardCollaboration: (boardId: string, orgId: string | null, teamId: string | null) => void;
  
  boardGroups: BoardGroup[];
  addBoardGroup: (name: string) => BoardGroup | undefined;
  deleteBoardGroup: (groupId: string) => void;
  updateBoardGroupName: (groupId: string, newName: string) => void;
  addBoardToGroup: (boardId: string, groupId: string) => void;
  removeBoardFromGroup: (boardId: string) => void; 

  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags' | 'assignedTo'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline' | 'assignedTo'>>, targetColumnId?: Column['id']) => void;
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
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  const { toast } = useToast();
  const [isLoadingData, setIsLoadingData] = useState(true);


  // Load data from Firestore for logged-in user or localStorage for guest
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      if (authLoading) {
        return; 
      }

      if (currentUser && !isGuest) { 
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            const firestoreBoards = (Array.isArray(userData.boards) ? userData.boards : []) as Partial<Board>[];
            const sanitizedBoards = firestoreBoards.map(board => sanitizeBoard(board));
            setBoards(sanitizedBoards);

            const firestoreBoardGroups = (Array.isArray(userData.boardGroups) ? userData.boardGroups : []) as Partial<BoardGroup>[];
            const sanitizedBoardGroups = firestoreBoardGroups.map(group => sanitizeBoardGroup(group));
            setBoardGroups(sanitizedBoardGroups);

            let currentActiveBoardId = userData.activeBoardId as string | null;
            let activeIdChanged = false;

            if (currentActiveBoardId && !sanitizedBoards.find(b => b.id === currentActiveBoardId)) {
              currentActiveBoardId = null; // Invalid, needs reset
            }
            if (!currentActiveBoardId && sanitizedBoards.length > 0) {
              currentActiveBoardId = sanitizedBoards[0].id;
              activeIdChanged = true;
            }
            
            setActiveBoardIdState(currentActiveBoardId);

            if (activeIdChanged && currentActiveBoardId) {
              console.log("TaskContext: Active board ID was reset or changed on load. Persisting change.");
              await updateDoc(userDocRef, { activeBoardId: currentActiveBoardId });
            }

          } else {
            setBoards([]); 
            setBoardGroups([]);
            setActiveBoardIdState(null);
            console.warn("TaskContext: User document not found in Firestore during loadData. AuthContext should initialize it.");
          }
        } catch (error) {
          console.error("TaskContext: Error loading user data from Firestore:", error);
          toast({ title: "Data Load Error", description: "Could not load your board data.", variant: "destructive" });
          setBoards([]);
          setBoardGroups([]);
          setActiveBoardIdState(null);
        }
      } else if (isGuest) { 
        const guestBoardsKey = 'kanbanBoards-guestSession';
        const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
        const guestBoardGroupsKey = 'boardGroups-guestSession';

        let loadedGuestBoards: Board[] = [];
        const savedBoardsJSON = localStorage.getItem(guestBoardsKey);
        if (savedBoardsJSON) {
          try {
            const parsed = JSON.parse(savedBoardsJSON) as Partial<Board>[];
            loadedGuestBoards = parsed.map(board => sanitizeBoard(board));
          } catch (e) {
            console.error("TaskContext: Failed to parse guest boards from localStorage", e);
          }
        }

        if (loadedGuestBoards.length === 0) {
            loadedGuestBoards = [initialDefaultBoardForGuest()];
        }
        setBoards(loadedGuestBoards);

        let activeGuestBoardId: string | null = localStorage.getItem(guestActiveIdKey);
        if (!activeGuestBoardId || !loadedGuestBoards.find(b => b.id === activeGuestBoardId)) {
            activeGuestBoardId = loadedGuestBoards.length > 0 ? loadedGuestBoards[0].id : null;
        }
        setActiveBoardIdState(activeGuestBoardId);
        
        const savedBoardGroupsJSON = localStorage.getItem(guestBoardGroupsKey);
        if(savedBoardGroupsJSON) {
            try {
                const parsedGroups = JSON.parse(savedBoardGroupsJSON) as Partial<BoardGroup>[];
                setBoardGroups(parsedGroups.map(g => sanitizeBoardGroup(g)));
            } catch (e) {
                 setBoardGroups([]);
            }
        } else {
            setBoardGroups([]);
        }
      } else { 
        setBoards([]);
        setBoardGroups([]);
        setActiveBoardIdState(null);
      }
      setIsLoadingData(false);
    };

    loadData();
  }, [currentUser, isGuest, authLoading, toast]); 

  // Save data to Firestore for logged-in user or localStorage for guest
  useEffect(() => {
    if (isLoadingData || authLoading) {
      return; 
    }

    const saveData = async () => {
      // Sanitize data before saving
      const boardsToSave = boards.map(board => sanitizeBoard(board));
      const boardGroupsToSave = boardGroups.map(group => sanitizeBoardGroup(group));

      if (currentUser && !isGuest) { 
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          // Check if document exists before trying to update, or set if it doesn't (should be rare if AuthContext runs first)
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            await updateDoc(userDocRef, { 
              boards: boardsToSave, 
              activeBoardId: activeBoardId,
              boardGroups: boardGroupsToSave 
            });
          } else {
            // This case should ideally be handled by AuthContext creating the initial user doc.
            // If somehow TaskContext tries to save before that, we might log or attempt a setDoc.
            console.warn("TaskContext Save: User document not found during save. Attempting to set new document (this should be rare).");
            // For safety, only set if we have crucial data; AuthContext manages full user doc creation.
            // This could lead to partial doc if not careful. Prefer relying on AuthContext.
            // For now, we'll log and not set, as AuthContext is primary for doc creation.
            // await setDoc(userDocRef, { /* initial user data */ boards: boardsToSave, activeBoardId, boardGroups: boardGroupsToSave });
          }
        } catch (error) {
          console.error("TaskContext Save: Error saving user data to Firestore:", error);
          toast({ title: "Data Save Error", description: `Could not save your data. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
        }
      } else if (isGuest) { 
        const guestBoardsKey = 'kanbanBoards-guestSession';
        const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
        const guestBoardGroupsKey = 'boardGroups-guestSession';
        localStorage.setItem(guestBoardsKey, JSON.stringify(boardsToSave));
        localStorage.setItem(guestBoardGroupsKey, JSON.stringify(boardGroupsToSave));
        if (activeBoardId) {
          localStorage.setItem(guestActiveIdKey, activeBoardId);
        } else {
          localStorage.removeItem(guestActiveIdKey);
        }
      }
    };
    saveData();
  }, [boards, activeBoardId, boardGroups, currentUser, isGuest, isLoadingData, authLoading, toast]);
  
  const setActiveBoardId = useCallback((boardId: string | null) => {
    setActiveBoardIdState(boardId);
  }, []);

  const getActiveBoard = useCallback((): Board | undefined => {
    return boards.find(b => b.id === activeBoardId);
  }, [boards, activeBoardId]);

  const addBoard = (
    name: string, 
    groupIdParam?: string | null,
    organizationIdParam?: string | null, 
    teamIdParam?: string | null
  ): Board | undefined => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", description: "You must be logged in or in guest mode to add a board.", variant: "destructive"});
        return undefined;
    }
    
    const newBoardData: Partial<Board> = {
      name,
      columns: [
        { id: generateId('col'), title: 'To Do', tasks: [], wipLimit: 0 },
        { id: generateId('col'), title: 'In Progress', tasks: [], wipLimit: 0 },
        { id: generateId('col'), title: 'Done', tasks: [], wipLimit: 0 },
      ],
      groupId: groupIdParam === undefined ? null : groupIdParam,
      organizationId: organizationIdParam === undefined ? (currentUser?.defaultOrganizationId ?? null) : organizationIdParam,
      teamId: teamIdParam === undefined ? null : teamIdParam,
    };
    const newBoard = sanitizeBoard(newBoardData); // Sanitize to get full Board object with ID, etc.

    setBoards(prevBoards => [...prevBoards, newBoard]);
    if (newBoard.groupId) {
        setBoardGroups(prevGroups => prevGroups.map(g => 
            g.id === newBoard.groupId ? sanitizeBoardGroup({ ...g, boardIds: [...g.boardIds, newBoard.id] }) : g
        ));
    }
    setActiveBoardId(newBoard.id); 
    toast({ title: "Board Created", description: `Board "${name}" has been created.`});
    return newBoard;
  };

  const deleteBoard = (boardId: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards => {
      const boardToDelete = prevBoards.find(b => b.id === boardId);
      const remainingBoards = prevBoards.filter(b => b.id !== boardId);
      if (activeBoardId === boardId) { 
        setActiveBoardIdState(remainingBoards.length > 0 ? remainingBoards[0].id : null);
      }
      if (boardToDelete?.groupId) {
          setBoardGroups(prevGroups => prevGroups.map(g => 
              g.id === boardToDelete.groupId 
                  ? sanitizeBoardGroup({ ...g, boardIds: g.boardIds.filter(id => id !== boardId) }) 
                  : g
          ));
      }
      return remainingBoards;
    });
    // Toast is handled in page.tsx for better user feedback with board name
  };

  const updateBoardName = (boardId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b => (b.id === boardId ? sanitizeBoard({ ...b, name: newName }) : b))
    );
    toast({ title: "Board Renamed", description: "Board name has been updated."});
  };
  
  const updateBoardTheme = (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b =>
        b.id === boardId ? sanitizeBoard({ ...b, theme: { ...(b.theme || {}), ...themeUpdate } }) : b
      )
    );
     toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
  };

  const updateBoardGroupId = (boardId: string, newGroupId: string | null) => {
    setBoards(prevBoards => prevBoards.map(board => 
      board.id === boardId ? sanitizeBoard({ ...board, groupId: newGroupId }) : board
    ));
  };

  const updateBoardCollaboration = (boardId: string, orgId: string | null, teamId: string | null) => {
    setBoards(prevBoards => prevBoards.map(board =>
      board.id === boardId ? sanitizeBoard({ ...board, organizationId: orgId, teamId: teamId }) : board
    ));
    const boardName = boards.find(b => b.id === boardId)?.name || "Board";
    toast({ title: "Board Collaboration Updated", description: `Collaboration settings for "${boardName}" updated.` });
  };

  const addBoardGroup = (name: string): BoardGroup | undefined => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", description: "You must be logged in or in guest mode to add a board group.", variant: "destructive"});
        return undefined;
    }
    const newGroup = sanitizeBoardGroup({ name, boardIds: [] });
    setBoardGroups(prev => [...prev, newGroup]);
    toast({ title: "Board Group Created", description: `Group "${name}" created.`});
    return newGroup;
  };

  const deleteBoardGroup = (groupId: string) => {
    if (!currentUser && !isGuest) return;
    setBoardGroups(prev => prev.filter(g => g.id !== groupId));
    setBoards(prevBoards => prevBoards.map(b => 
        b.groupId === groupId ? sanitizeBoard({ ...b, groupId: null }) : b
    ));
    // Toast handled in page.tsx
  };

  const updateBoardGroupName = (groupId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoardGroups(prev => prev.map(g => g.id === groupId ? sanitizeBoardGroup({ ...g, name: newName }) : g));
    toast({ title: "Board Group Renamed", description: "Group name updated."});
  };

  const addBoardToGroup = (boardId: string, targetGroupId: string) => {
    if (!currentUser && !isGuest) return;
    
    setBoardGroups(prevGroups => prevGroups.map(g => {
        if (g.boardIds.includes(boardId) && g.id !== targetGroupId) {
            return sanitizeBoardGroup({ ...g, boardIds: g.boardIds.filter(id => id !== boardId) });
        }
        if (g.id === targetGroupId) {
            return sanitizeBoardGroup({ ...g, boardIds: [...new Set([...g.boardIds, boardId])] });
        }
        return g;
    }));

    setBoards(prevBoards => prevBoards.map(b => 
        b.id === boardId ? sanitizeBoard({ ...b, groupId: targetGroupId }) : b
    ));

    const boardName = boards.find(b => b.id === boardId)?.name || "Board";
    const groupName = boardGroups.find(g => g.id === targetGroupId)?.name || "Group";
    toast({ title: "Board Moved to Group", description: `"${boardName}" added to group "${groupName}".` });
  };

  const removeBoardFromGroup = (boardId: string) => {
    if (!currentUser && !isGuest) return;
    const board = boards.find(b => b.id === boardId);
    if (!board || !board.groupId) return; 
    
    const sourceGroupId = board.groupId;
    
    setBoards(prevBoards => prevBoards.map(b => 
        b.id === boardId ? sanitizeBoard({ ...b, groupId: null }) : b
    ));
    setBoardGroups(prevGroups => prevGroups.map(g => 
        g.id === sourceGroupId ? sanitizeBoardGroup({ ...g, boardIds: g.boardIds.filter(id => id !== boardId) }) : g
    ));
    toast({ title: "Board Ungrouped", description: `"${board.name}" removed from its group.`});
  };

  const executeOnActiveBoard = <T,>(operation: (board: Board) => { updatedBoard?: Board, result?: T }): T | undefined => {
    if (!activeBoardId) {
      // Allow operations even if not logged in for guest mode, but check activeBoardId
      if (!isGuest) {
        toast({ title: "Action Denied", description: "Operation requires an active board.", variant: "destructive"});
        return undefined;
      } else if (!activeBoardId && boards.length > 0) {
         // For guest, if no active board but boards exist, maybe set one? Or just operate on first.
         // For now, let's proceed assuming getActiveBoard() handles this or errors appropriately
      } else if (!activeBoardId && boards.length === 0) {
        toast({ title: "No Board", description: "No board available for this operation.", variant: "destructive"});
        return undefined;
      }
    }
    
    let resultFromOperation: T | undefined;
    setBoards(prevBoards => {
        const boardIndex = prevBoards.findIndex(b => b.id === activeBoardId);
        if (boardIndex === -1) {
            // This can happen if activeBoardId refers to a board not yet loaded or deleted.
            // LoadData should handle setting a valid activeBoardId if possible.
            console.warn(`executeOnActiveBoard: Active board with ID ${activeBoardId} not found in current boards list.`);
            toast({ title: "Error", description: "Active board data inconsistency.", variant: "destructive"});
            return prevBoards;
        }
        const currentActiveBoard = prevBoards[boardIndex];
        const { updatedBoard, result } = operation(currentActiveBoard);
        resultFromOperation = result;

        if (updatedBoard) {
            const newBoards = [...prevBoards];
            newBoards[boardIndex] = sanitizeBoard(updatedBoard); // Sanitize before setting state
            return newBoards;
        }
        return prevBoards;
    });
    return resultFromOperation;
  };

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline' | 'assignedTo'>>, targetColumnIdInput?: Column['id']) => {
    executeOnActiveBoard(board => {
      const finalTargetColumnId = targetColumnIdInput || (board.columns.length > 0 ? board.columns[0].id : undefined);
      if (!finalTargetColumnId) {
        toast({ title: "Error Adding Task", description: "No columns available in this board.", variant: "destructive" });
        return {};
      }
      const sanitizedPartialTask: Partial<Task> = {
        ...taskData,
        status: finalTargetColumnId,
        dependencies: Array.isArray(taskData.dependencies) ? taskData.dependencies : [],
        description: taskData.description || null, // Ensure null for undefined
        deadline: taskData.deadline || null, // Ensure null for undefined
        tags: Array.isArray(taskData.tags) ? taskData.tags : [],
        checklist: Array.isArray(taskData.checklist) ? taskData.checklist.map(ci => ({ id: ci.id || generateId('cl-item'), text: ci.text, completed: ci.completed })) : [],
        assignedTo: Array.isArray(taskData.assignedTo) ? taskData.assignedTo : [],
        createdAt: formatISO(new Date()),
      };
      const newTask = sanitizeBoard({columns: [{id: finalTargetColumnId, tasks: [sanitizedPartialTask as Task]}]}).columns[0].tasks[0];

      const updatedBoardColumns = board.columns.map(col => {
        if (col.id === finalTargetColumnId) {
          const existingTasks = Array.isArray(col.tasks) ? col.tasks : [];
          return { ...col, tasks: [newTask, ...existingTasks] };
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
      
      const newBoardColumns = board.columns.map(col => ({ ...col, tasks: [...(col.tasks || [])] }));
      const sourceCol = newBoardColumns.find(col => col.id === sourceColumnId);
      const targetCol = newBoardColumns.find(col => col.id === targetColumnId);

      if (!sourceCol || !targetCol) {
        return { result: { task: null, automated: false }};
      }

      const taskIndex = sourceCol.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) {
        return { result: { task: null, automated: false }};
      }
      
      [movedTask] = sourceCol.tasks.splice(taskIndex, 1);
      if (movedTask) {
        movedTask.status = targetColumnId;
        if (isBetaModeActive && targetCol.title.toLowerCase() === 'done' && movedTask.checklist && movedTask.checklist.length > 0) {
          movedTask.checklist = movedTask.checklist.map(item => ({ ...item, completed: true }));
          automationApplied = true;
        }
        targetCol.tasks.unshift(movedTask); 
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
          return { ...col, tasks: (col.tasks || []).filter(task => task.id !== taskId) };
        }
        return col;
      });
      // Toast handled by page.tsx
      return { updatedBoard: { ...board, columns: updatedBoardColumns } };
    });
  };

  const updateTask = (updatedTaskData: Partial<Task> & { id: string }) => {
    executeOnActiveBoard(board => {
      const updatedBoardColumns = board.columns.map(col => ({
        ...col,
        tasks: (col.tasks || []).map(task => task.id === updatedTaskData.id ? sanitizeBoard({columns: [{id: col.id, tasks: [{...task, ...updatedTaskData}]}]}).columns[0].tasks[0] : task)
      }));
      toast({ title: "Task Updated" });
      return { updatedBoard: { ...board, columns: updatedBoardColumns } };
    });
  };

  const getTaskById = (taskId: string): Task | undefined => {
    const board = getActiveBoard();
    if (!board) return undefined;
    for (const column of board.columns) {
      const task = (column.tasks || []).find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  };

  const getAllTasksOfActiveBoard = (): Task[] => {
    const board = getActiveBoard();
    return board ? board.columns.reduce((acc, column) => acc.concat(column.tasks || []), [] as Task[]) : [];
  };
  
  const addColumn = (title: string) => {
    executeOnActiveBoard(board => {
      const newColumn = sanitizeAndAssignColumns([{ title, tasks: [] }])[0];
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
        const updatedCols = board.columns.map(col => col.id === columnId ? { ...col, wipLimit: limit === undefined || limit < 0 ? 0 : limit } : col);
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
            tasks: (col.tasks || []).map(task => {
              if (task.id === taskId) {
                const newChecklistItem = { id: generateId('cl-item'), text: itemText, completed: false };
                const newChecklist = [...(task.checklist || []), newChecklistItem];
                return { ...task, checklist: newChecklist};
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
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.map(item => item.id === itemId ? {...item, completed: !item.completed} : item);
                        return { ...task, checklist: newChecklist};
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
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.filter(item => item.id !== itemId);
                        return { ...task, checklist: newChecklist};
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
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        const newChecklist = task.checklist.map(item => item.id === itemId ? {...item, text: newText} : item);
                        return { ...task, checklist: newChecklist};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { updatedBoard: { ...board, columns: updatedCols } };
     });
  };

  if (isLoadingData || authLoading) {
     return (
      <TaskContext.Provider value={{ 
        boards: [], activeBoardId: null, setActiveBoardId: () => {}, getActiveBoard: () => undefined, 
        addBoard: () => undefined, deleteBoard: () => {}, updateBoardName: () => {}, updateBoardTheme: () => {}, updateBoardGroupId: () => {}, updateBoardCollaboration: () => {},
        boardGroups: [], addBoardGroup: () => undefined, deleteBoardGroup: () => {}, updateBoardGroupName: () => {}, addBoardToGroup: () => {}, removeBoardFromGroup: () => {},
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
        boards, activeBoardId, setActiveBoardId, getActiveBoard, addBoard, deleteBoard, updateBoardName, updateBoardTheme, updateBoardGroupId, updateBoardCollaboration,
        boardGroups, addBoardGroup, deleteBoardGroup, updateBoardGroupName, addBoardToGroup, removeBoardFromGroup,
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

