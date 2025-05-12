// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme, BoardGroup, Organization, Team } from '@/types';
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
      assignedTo: task.assignedTo || [],
    }))
  }));
};

const initialDefaultBoardForGuest = (): Board => ({
    id: generateId('board-guest-main'),
    name: 'Guest Board',
    columns: assignTaskStatusToColumns(getDefaultColumnsForGuest()),
    createdAt: formatISO(new Date()),
    theme: {},
    groupId: null,
    organizationId: null,
    teamId: null,
    isPublic: false,
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
  removeBoardFromGroup: (boardId: string) => void; // Simplified: just removes from any group

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
                        status: col.id || '', 
                        priority: task.priority || 'medium',
                        createdAt: task.createdAt || formatISO(new Date()),
                        checklist: task.checklist || [],
                        dependencies: task.dependencies || [],
                        tags: task.tags || [],
                        assignedTo: task.assignedTo || [],
                    })) : [],
                }))) : [],
                createdAt: board.createdAt || formatISO(new Date()),
                theme: board.theme || {},
                groupId: board.groupId === undefined ? null : board.groupId,
                organizationId: board.organizationId === undefined ? null : board.organizationId,
                teamId: board.teamId === undefined ? null : board.teamId,
                isPublic: board.isPublic === undefined ? false : board.isPublic,
            }));

            setBoards(sanitizedBoards);

            const firestoreBoardGroups = (userData.boardGroups || []) as BoardGroup[];
            const sanitizedBoardGroups = firestoreBoardGroups.map(group => ({
                ...group,
                id: group.id || generateId('group-fb'),
                name: group.name || 'Untitled Group',
                boardIds: Array.isArray(group.boardIds) ? group.boardIds : [],
                createdAt: group.createdAt || formatISO(new Date()),
            }));
            setBoardGroups(sanitizedBoardGroups);

            const firestoreActiveBoardId = userData.activeBoardId as string | null;
            if (firestoreActiveBoardId && sanitizedBoards.find(b => b.id === firestoreActiveBoardId)) {
              setActiveBoardIdState(firestoreActiveBoardId);
            } else if (sanitizedBoards.length > 0) {
              setActiveBoardIdState(sanitizedBoards[0].id);
              if (firestoreActiveBoardId !== sanitizedBoards[0].id) {
                await updateDoc(userDocRef, { activeBoardId: sanitizedBoards[0].id });
              }
            } else {
              setActiveBoardIdState(null);
            }
          } else {
            setBoards([]); 
            setBoardGroups([]);
            setActiveBoardIdState(null);
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
                        assignedTo: task.assignedTo || [],
                    })) : [],
                }))) : [],
                createdAt: board.createdAt || formatISO(new Date()),
                theme: board.theme || {},
                groupId: board.groupId === undefined ? null : board.groupId,
                organizationId: board.organizationId === undefined ? null : board.organizationId,
                teamId: board.teamId === undefined ? null : board.teamId,
                isPublic: board.isPublic === undefined ? false : board.isPublic,
            }));
            setBoards(sanitizedBoards);

            const savedActiveId = localStorage.getItem(guestActiveIdKey);
            if (savedActiveId && sanitizedBoards.find(b => b.id === savedActiveId)) {
              setActiveBoardIdState(savedActiveId);
            } else if (sanitizedBoards.length > 0) {
              setActiveBoardIdState(sanitizedBoards[0].id);
            } else {
               const defaultGuestBoard = initialDefaultBoardForGuest();
               setBoards([defaultGuestBoard]);
               setActiveBoardIdState(defaultGuestBoard.id);
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
        }
        const savedBoardGroups = localStorage.getItem(guestBoardGroupsKey);
        if(savedBoardGroups) {
            try {
                const parsedGroups = JSON.parse(savedBoardGroups) as BoardGroup[];
                setBoardGroups(parsedGroups.map(g => ({
                    ...g,
                    id: g.id || generateId('group-guest-parsed'),
                    name: g.name || 'Untitled Guest Group',
                    boardIds: Array.isArray(g.boardIds) ? g.boardIds : [],
                    createdAt: g.createdAt || formatISO(new Date())
                })));
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
      if (currentUser && !isGuest) { // Logged-in user
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
           const boardsToSave = boards.map(board => ({
            ...board,
            groupId: board.groupId === undefined ? null : board.groupId,
            organizationId: board.organizationId === undefined ? null : board.organizationId,
            teamId: board.teamId === undefined ? null : board.teamId,
            isPublic: board.isPublic === undefined ? false : board.isPublic,
            columns: board.columns.map(column => ({
              ...column,
              tasks: column.tasks.map(task => ({
                ...task,
                checklist: task.checklist || [],
                dependencies: task.dependencies || [],
                tags: task.tags || [],
                assignedTo: task.assignedTo || [],
                createdAt: task.createdAt || formatISO(new Date()),
              }))
            }))
          }));
          await updateDoc(userDocRef, { boards: boardsToSave, activeBoardId, boardGroups });
        } catch (error) {
          console.error("TaskContext Save: Error saving user data to Firestore:", error);
        }
      } else if (isGuest) { // Guest user
        const guestBoardsKey = 'kanbanBoards-guestSession';
        const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
        const guestBoardGroupsKey = 'boardGroups-guestSession';
        localStorage.setItem(guestBoardsKey, JSON.stringify(boards));
        localStorage.setItem(guestBoardGroupsKey, JSON.stringify(boardGroups));
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
    groupId: string | null = null, 
    organizationId: string | null = null, 
    teamId: string | null = null
  ): Board | undefined => {
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
      groupId: groupId,
      organizationId: organizationId || (currentUser?.defaultOrganizationId ?? null), // Auto-associate with user's default org
      teamId: teamId,
      isPublic: false,
    };
    setBoards(prevBoards => [...prevBoards, newBoard]);
    if (groupId) {
        setBoardGroups(prevGroups => prevGroups.map(g => 
            g.id === groupId ? { ...g, boardIds: [...g.boardIds, newBoardId] } : g
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
        setActiveBoardId(remainingBoards.length > 0 ? remainingBoards[0].id : null);
      }
      if (boardToDelete?.groupId) {
          setBoardGroups(prevGroups => prevGroups.map(g => 
              g.id === boardToDelete.groupId 
                  ? { ...g, boardIds: g.boardIds.filter(id => id !== boardId) } 
                  : g
          ));
      }
      return remainingBoards;
    });
    toast({ title: "Board Deleted", description: "The board has been deleted."});
  };

  const updateBoardName = (boardId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b => (b.id === boardId ? { ...b, name: newName } : b))
    );
    toast({ title: "Board Renamed", description: "Board name has been updated."});
  };
  
  const updateBoardTheme = (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards =>
      prevBoards.map(b =>
        b.id === boardId ? { ...b, theme: { ...(b.theme || {}), ...themeUpdate } } : b
      )
    );
     toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
  };

  const updateBoardGroupId = (boardId: string, newGroupId: string | null) => {
    setBoards(prevBoards => prevBoards.map(board => 
      board.id === boardId ? { ...board, groupId: newGroupId } : board
    ));
  };

  const updateBoardCollaboration = (boardId: string, orgId: string | null, teamId: string | null) => {
    setBoards(prevBoards => prevBoards.map(board =>
      board.id === boardId ? { ...board, organizationId: orgId, teamId: teamId } : board
    ));
    const boardName = boards.find(b => b.id === boardId)?.name || "Board";
    toast({ title: "Board Collaboration Updated", description: `Collaboration settings for "${boardName}" updated.` });
  };

  const addBoardGroup = (name: string): BoardGroup | undefined => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", description: "You must be logged in or in guest mode to add a board group.", variant: "destructive"});
        return undefined;
    }
    const newGroup: BoardGroup = {
        id: generateId(isGuest ? 'group-guest' : 'group-user'),
        name,
        boardIds: [],
        createdAt: formatISO(new Date()),
    };
    setBoardGroups(prev => [...prev, newGroup]);
    toast({ title: "Board Group Created", description: `Group "${name}" created.`});
    return newGroup;
  };

  const deleteBoardGroup = (groupId: string) => {
    if (!currentUser && !isGuest) return;
    setBoardGroups(prev => prev.filter(g => g.id !== groupId));
    setBoards(prevBoards => prevBoards.map(b => 
        b.groupId === groupId ? { ...b, groupId: null } : b
    ));
    toast({ title: "Board Group Deleted", description: "Group deleted. Boards are now ungrouped."});
  };

  const updateBoardGroupName = (groupId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoardGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
    toast({ title: "Board Group Renamed", description: "Group name updated."});
  };

  const addBoardToGroup = (boardId: string, targetGroupId: string) => {
    if (!currentUser && !isGuest) return;
    setBoards(prevBoards => prevBoards.map(b => {
        if (b.id === boardId) {
            if (b.groupId && b.groupId !== targetGroupId) { 
                setBoardGroups(prevGroups => prevGroups.map(g => 
                    g.id === b.groupId ? { ...g, boardIds: g.boardIds.filter(id => id !== boardId) } : g
                ));
            }
            return { ...b, groupId: targetGroupId };
        }
        return b;
    }));
    setBoardGroups(prevGroups => prevGroups.map(g => 
        g.id === targetGroupId 
            ? { ...g, boardIds: [...new Set([...g.boardIds, boardId])] } 
            : g
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
        b.id === boardId ? { ...b, groupId: null } : b
    ));
    setBoardGroups(prevGroups => prevGroups.map(g => 
        g.id === sourceGroupId ? { ...g, boardIds: g.boardIds.filter(id => id !== boardId) } : g
    ));
    toast({ title: "Board Ungrouped", description: `"${board.name}" removed from its group.`});
  };


  const executeOnActiveBoard = <T,>(operation: (board: Board) => { updatedBoard?: Board, result?: T }): T | undefined => {
    if ((!currentUser && !isGuest) || !activeBoardId) {
      toast({ title: "Action Denied", description: "Operation requires an active board and user/guest session.", variant: "destructive"});
      return undefined;
    }
    
    let resultFromOperation: T | undefined;
    setBoards(prevBoards => {
        const boardIndex = prevBoards.findIndex(b => b.id === activeBoardId);
        if (boardIndex === -1) {
            toast({ title: "Error", description: "Active board not found.", variant: "destructive"});
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

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline' | 'assignedTo'>>, targetColumnIdInput?: Column['id']) => {
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
        assignedTo: taskData.assignedTo || [],
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
          movedTask.checklist.forEach(item => {
            if (!item.completed) { item.completed = true; automationApplied = true; }
          });
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
          return { ...col, tasks: col.tasks.filter(task => task.id !== taskId) };
        }
        return col;
      });
      toast({ title: "Task Deleted" });
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
                const newChecklist = [...(task.checklist || []), { id: generateId('cl-item'), text: itemText, completed: false }];
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
