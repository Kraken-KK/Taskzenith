
// src/contexts/TaskContext.tsx
'use client';

import type { Task, Column, ChecklistItem, Board, BoardTheme, BoardGroup, Subtask } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';
import { useAuth } from './AuthContext'; 
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, onSnapshot, writeBatch, serverTimestamp, arrayUnion, arrayRemove, Unsubscribe, deleteDoc as deleteFirestoreDoc, Timestamp } from 'firebase/firestore';

// Helper to generate unique IDs
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

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
        status: columnId, 
        priority: task.priority || 'medium',
        createdAt: task.createdAt || formatISO(new Date()),
        description: task.description || null, 
        deadline: task.deadline || null,     
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        checklist: Array.isArray(task.checklist) ? task.checklist.map(ci => ({
          id: ci.id || generateId('cl-item-sanitized'),
          text: ci.text || '',
          completed: ci.completed || false,
        })) : [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(st => ({
          id: st.id || generateId('subtask-sanitized'),
          text: st.text || 'Untitled Subtask',
          completed: st.completed || false,
        })) : [],
        tags: Array.isArray(task.tags) ? task.tags : [],
        assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      })) : [],
    };
  });
};

const sanitizeBoard = (boardData: Partial<Board>, boardIdOverride?: string): Board => {
  const boardId = boardIdOverride || boardData.id || generateId('board-sanitized');
  return {
    id: boardId,
    name: boardData.name || 'Untitled Board',
    columns: sanitizeAndAssignColumns(boardData.columns),
    createdAt: boardData.createdAt || formatISO(new Date()),
    theme: boardData.theme || {},
    groupId: boardData.groupId === undefined ? null : boardData.groupId,
    organizationId: boardData.organizationId === undefined ? null : boardData.organizationId,
    teamId: boardData.teamId === undefined ? null : boardData.teamId,
    isPublic: boardData.isPublic === undefined ? false : boardData.isPublic,
    ownerId: boardData.ownerId || null, 
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
      { id: generateId('col-guest'), title: 'To Do', tasks: [{ id: generateId('task-guest'), content: 'Welcome! Plan your day', priority: 'high', createdAt: formatISO(new Date()), subtasks: [] } as Task], wipLimit: 0 },
      { id: generateId('col-guest'), title: 'In Progress', tasks: [], wipLimit: 0 },
      { id: generateId('col-guest'), title: 'Done', tasks: [], wipLimit: 0 },
    ],
});


interface TaskContextType {
  boards: Board[];
  activeBoardId: string | null;
  setActiveBoardId: (boardId: string | null) => void;
  getActiveBoard: () => Board | undefined;
  addBoard: (name: string, options?: { groupId?: string | null; organizationId?: string | null; teamId?: string | null }) => Promise<Board | undefined>;
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

  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'dependencies' | 'checklist' | 'tags' | 'assignedTo' | 'subtasks'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline' | 'assignedTo' | 'subtasks'>>, targetColumnId?: Column['id']) => void;
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

  addSubtask: (taskId: string, columnId: string, subtaskText: string) => void;
  toggleSubtask: (taskId: string, columnId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, columnId: string, subtaskId: string) => void;
  updateSubtaskText: (taskId: string, columnId: string, subtaskId: string, newText: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { currentUser, isGuest, loading: authLoading } = useAuth(); 
  const [boardsData, setBoardsData] = useState<{ personal: Board[], shared: Board[] }>({ personal: [], shared: [] });
  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(null);
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  const { toast } = useToast();
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [personalDataUnsubscribe, setPersonalDataUnsubscribe] = useState<Unsubscribe | null>(null);
  const [sharedBoardsUnsubscribes, setSharedBoardsUnsubscribes] = useState<Map<string, Unsubscribe>>(new Map());


  // Load data from Firestore for logged-in user or localStorage for guest
  useEffect(() => {
    if (authLoading) return;

    setIsLoadingData(true);

    // Cleanup previous listeners
    personalDataUnsubscribe?.();
    sharedBoardsUnsubscribes.forEach(unsub => unsub());
    setSharedBoardsUnsubscribes(new Map());

    if (isGuest) {
      const guestBoardsKey = 'kanbanBoards-guestSession';
      const guestActiveIdKey = 'activeKanbanBoardId-guestSession';
      const guestBoardGroupsKey = 'boardGroups-guestSession';

      let loadedGuestBoards: Board[] = [];
      const savedBoardsJSON = localStorage.getItem(guestBoardsKey);
      if (savedBoardsJSON) {
        try {
          const parsed = JSON.parse(savedBoardsJSON) as Partial<Board>[];
          loadedGuestBoards = parsed.map(board => sanitizeBoard(board));
        } catch (e) { console.error("TaskContext: Failed to parse guest boards from localStorage", e); }
      }
      if (loadedGuestBoards.length === 0) loadedGuestBoards = [initialDefaultBoardForGuest()];
      
      setBoardsData({ personal: loadedGuestBoards, shared: [] });

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
          } catch (e) { setBoardGroups([]); }
      } else {
          setBoardGroups([]);
      }
      setIsLoadingData(false);
      return;
    }

    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.id);

      // Listener for personal data (personalBoards, activeBoardId, boardGroups)
      const unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const firestorePersonalBoards = (Array.isArray(userData.personalBoards) ? userData.personalBoards : []) as Partial<Board>[];
          const sanitizedPersonalBoards = firestorePersonalBoards.map(b => sanitizeBoard(b));
          setBoardsData(prev => ({ ...prev, personal: sanitizedPersonalBoards }));

          const firestoreBoardGroups = (Array.isArray(userData.boardGroups) ? userData.boardGroups : []) as Partial<BoardGroup>[];
          setBoardGroups(firestoreBoardGroups.map(g => sanitizeBoardGroup(g)));
          
          setActiveBoardIdState(userData.activeBoardId || (sanitizedPersonalBoards.length > 0 ? sanitizedPersonalBoards[0].id : null ));

        } else {
          console.warn("TaskContext: User document not found for personal data listener. AuthContext should handle creation.");
          setBoardsData(prev => ({ ...prev, personal: [] }));
          setBoardGroups([]);
          setActiveBoardIdState(null);
        }
      }, (error) => {
        console.error("TaskContext: Error listening to user document:", error);
        setTimeout(() => toast({ title: "Data Sync Error", description: "Could not sync personal data.", variant: "destructive" }), 0);
      });
      setPersonalDataUnsubscribe(() => unsubUserDoc);

      // Listeners for shared boards
      const orgIds = currentUser.organizationMemberships || [];
      const newSharedUnsubs = new Map<string, Unsubscribe>();

      orgIds.forEach(orgId => {
        const q = query(collection(db, 'boards'), where('organizationId', '==', orgId));
        const unsubShared = onSnapshot(q, (querySnapshot) => {
          const fetchedSharedBoards = querySnapshot.docs.map(docSnap => sanitizeBoard(docSnap.data() as Partial<Board>, docSnap.id));
          setBoardsData(prev => {
            const otherShared = prev.shared.filter(b => b.organizationId !== orgId);
            return { ...prev, shared: [...otherShared, ...fetchedSharedBoards] };
          });
        }, (error) => {
          console.error(`TaskContext: Error listening to shared boards for org ${orgId}:`, error);
        });
        newSharedUnsubs.set(orgId, unsubShared);
      });
      setSharedBoardsUnsubscribes(newSharedUnsubs);
      setIsLoadingData(false);
    } else {
      setBoardsData({ personal: [], shared: [] });
      setBoardGroups([]);
      setActiveBoardIdState(null);
      setIsLoadingData(false);
    }

    return () => {
      personalDataUnsubscribe?.();
      sharedBoardsUnsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, isGuest, authLoading]); // Removed toast from dependencies


  // Save boardGroups and activeBoardId to user doc (these are user-specific settings)
  useEffect(() => {
    if (isLoadingData || authLoading || isGuest || !currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.id);
    const dataToUpdate: { boardGroups?: BoardGroup[], activeBoardId?: string | null } = {};
    
    // Only update if there's something to update
    let needsDBUpdate = false;
    if (boardGroups.length > 0 || activeBoardId !== undefined) { // Also consider activeBoardId explicitly
        dataToUpdate.boardGroups = boardGroups.map(g => sanitizeBoardGroup(g)); // Always include boardGroups if saving
        dataToUpdate.activeBoardId = activeBoardId; // Always include activeBoardId if saving
        needsDBUpdate = true;
    }
    
    if (needsDBUpdate) {
      updateDoc(userDocRef, dataToUpdate).catch(error => {
        console.error("TaskContext: Error saving boardGroups/activeBoardId to Firestore:", error);
      });
    }
  }, [boardGroups, activeBoardId, currentUser, isGuest, isLoadingData, authLoading]);


  const combinedBoards = useMemo(() => {
    const allBoards = [...boardsData.personal, ...boardsData.shared];
    const uniqueBoardIds = new Set<string>();
    return allBoards.filter(board => {
        if (uniqueBoardIds.has(board.id)) return false;
        uniqueBoardIds.add(board.id);
        return true;
    });
  }, [boardsData]);


  const getActiveBoard = useCallback((): Board | undefined => {
    return combinedBoards.find(b => b.id === activeBoardId);
  }, [combinedBoards, activeBoardId]);

  const addBoard = async (
    name: string, 
    options: { groupId?: string | null; organizationId?: string | null; teamId?: string | null } = {}
  ): Promise<Board | undefined> => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", description: "You must be logged in or in guest mode to add a board.", variant: "destructive"});
        return undefined;
    }
    
    const { groupId, organizationId, teamId } = options;
    const baseBoardData: Partial<Board> = {
      name,
      columns: [
        { id: generateId('col'), title: 'To Do', tasks: [], wipLimit: 0, subtasks: [] },
        { id: generateId('col'), title: 'In Progress', tasks: [], wipLimit: 0, subtasks: [] },
        { id: generateId('col'), title: 'Done', tasks: [], wipLimit: 0, subtasks: [] },
      ],
      groupId: groupId === undefined ? null : groupId,
      organizationId: organizationId,
      teamId: teamId === undefined ? null : teamId,
      createdAt: formatISO(new Date()), 
    };

    if (baseBoardData.organizationId && currentUser && !isGuest) { 
      baseBoardData.ownerId = currentUser.id;
      const newBoard = sanitizeBoard(baseBoardData); 
      try {
        await setDoc(doc(db, 'boards', newBoard.id), {
            ...newBoard, 
            createdAt: serverTimestamp() as Timestamp 
        });
        setActiveBoardIdState(newBoard.id); 
        toast({ title: "Shared Board Created", description: `Board "${name}" created in organization.`});
        return newBoard;
      } catch (error: any) { 
        console.error("Error creating shared board:", error.code, error.message, error);
        toast({ title: "Creation Failed", description: `Shared board: ${error.message}`, variant: "destructive"});
        return undefined;
      }
    } else { 
      const newBoard = sanitizeBoard(baseBoardData); 
      if (isGuest) {
        const updatedGuestBoards = [...boardsData.personal, newBoard];
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
        localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
        if (newBoard.groupId) {
            const updatedGroups = boardGroups.map(g => g.id === newBoard.groupId ? {...g, boardIds: [...g.boardIds, newBoard.id]} : g);
            setBoardGroups(updatedGroups);
            localStorage.setItem('boardGroups-guestSession', JSON.stringify(updatedGroups));
        }
        setActiveBoardIdState(newBoard.id);
        toast({ title: "Guest Board Created", description: `Board "${name}" created.`});
        return newBoard;
      } else if (currentUser) { 
        const userDocRef = doc(db, 'users', currentUser.id);
        try {
          const boardForUserDoc = { ...newBoard, createdAt: formatISO(new Date()), ownerId: currentUser.id };
          await updateDoc(userDocRef, {
            personalBoards: arrayUnion(boardForUserDoc) 
          });
          setActiveBoardIdState(boardForUserDoc.id);
          toast({ title: "Personal Board Created", description: `Board "${name}" created.`});
          return boardForUserDoc;
        } catch (error: any) { 
          console.error("Error adding personal board to user doc:", error.code, error.message, error);
          toast({ title: "Creation Failed", description: `Personal board: ${error.message}`, variant: "destructive"});
          return undefined;
        }
      }
    }
    return undefined; 
  };
  
  const setActiveBoardId = useCallback((boardId: string | null) => {
    setActiveBoardIdState(boardId);
    if (currentUser && !isGuest) {
      const userDocRef = doc(db, 'users', currentUser.id);
      updateDoc(userDocRef, { activeBoardId: boardId }).catch(error => {
        console.error("TaskContext: Error saving activeBoardId to Firestore:", error);
      });
    } else if (isGuest) {
      if (boardId) localStorage.setItem('activeKanbanBoardId-guestSession', boardId);
      else localStorage.removeItem('activeKanbanBoardId-guestSession');
    }
  }, [currentUser, isGuest]);

  const getBoardAndRef = async (boardId: string): Promise<{ board: Board | undefined, boardRef?: any, isShared: boolean, userDocRef?: any, currentPersonalBoards?: Board[] }> => {
    const boardFromState = combinedBoards.find(b => b.id === boardId);
    if (!boardFromState) return { board: undefined, isShared: false };

    const isShared = !!boardFromState.organizationId;
    if (isShared) {
      return { board: boardFromState, boardRef: doc(db, 'boards', boardId), isShared: true };
    } else if (currentUser && !isGuest) {
      const userDocRef = doc(db, 'users', currentUser.id);
      const userDocSnap = await getDoc(userDocRef);
      const currentPersonalBoards = (userDocSnap.data()?.personalBoards as Board[] || []);
      return { board: boardFromState, userDocRef, currentPersonalBoards, isShared: false };
    } else if (isGuest) {
      return { board: boardFromState, isShared: false }; 
    }
    return { board: undefined, isShared: false };
  };


  const deleteBoard = async (boardId: string) => {
    if (!currentUser && !isGuest) return;
    const { board, boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (!board) return;

    const boardName = board.name; 

    if (isShared && boardRef) {
      await deleteFirestoreDoc(boardRef);
    } else if (userDocRef && currentPersonalBoards) { 
      const updatedPersonalBoards = currentPersonalBoards.filter(b => b.id !== boardId);
      await updateDoc(userDocRef, { personalBoards: updatedPersonalBoards });
    } else if (isGuest) {
      const updatedGuestBoards = boardsData.personal.filter(b => b.id !== boardId);
      setBoardsData(prev => ({ ...prev, personal: updatedGuestBoards }));
      localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
      if (activeBoardId === boardId) {
        setActiveBoardId(updatedGuestBoards.length > 0 ? updatedGuestBoards[0].id : null);
      }
    }

    if (board.groupId) { 
        setBoardGroups(prevGroups => prevGroups.map(g => 
            g.id === board.groupId 
                ? sanitizeBoardGroup({ ...g, boardIds: g.boardIds.filter(id => id !== boardId) }) 
                : g
        ));
    }
    toast({ title: "Board Deleted", description: `Board "${boardName}" has been successfully deleted.`});
  };

  const updateBoardName = async (boardId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    const { board, boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (!board) return;

    if (isShared && boardRef) {
      await updateDoc(boardRef, { name: newName });
    } else if (userDocRef && currentPersonalBoards) {
      const updatedPersonalBoards = currentPersonalBoards.map(b => b.id === boardId ? { ...b, name: newName } : b);
      await updateDoc(userDocRef, { personalBoards: updatedPersonalBoards.map(b => sanitizeBoard(b)) });
    } else if (isGuest) {
      const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizeBoard({ ...b, name: newName }) : b);
      setBoardsData(prev => ({ ...prev, personal: updatedGuestBoards }));
      localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
    }
    toast({ title: "Board Renamed", description: "Board name has been updated."});
  };
  
  const updateBoardTheme = async (boardId: string, themeUpdate: Partial<BoardTheme>) => {
    if (!currentUser && !isGuest) return;
    const { board, boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (!board) return;
    
    const newTheme = { ...(board.theme || {}), ...themeUpdate };

    if (isShared && boardRef) {
      await updateDoc(boardRef, { theme: newTheme });
    } else if (userDocRef && currentPersonalBoards) {
      const updatedPersonalBoards = currentPersonalBoards.map(b => b.id === boardId ? { ...b, theme: newTheme } : b);
      await updateDoc(userDocRef, { personalBoards: updatedPersonalBoards.map(b => sanitizeBoard(b)) });
    } else if (isGuest) {
        const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizeBoard({...b, theme: newTheme}) : b);
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
        localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
    }
    toast({ title: "Board Theme Updated", description: "Board appearance has been customized."});
  };

  const updateBoardGroupId = async (boardId: string, newGroupId: string | null) => {
    const { board, boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (!board) return;

    if (isShared && boardRef) {
        await updateDoc(boardRef, { groupId: newGroupId === undefined ? null : newGroupId });
    } else if (userDocRef && currentPersonalBoards) {
        const updatedPersonalBoards = currentPersonalBoards.map(b => b.id === boardId ? { ...b, groupId: newGroupId === undefined ? null : newGroupId } : b);
        await updateDoc(userDocRef, { personalBoards: updatedPersonalBoards.map(b => sanitizeBoard(b)) });
    } else if (isGuest) {
        const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizeBoard({...b, groupId: newGroupId === undefined ? null : newGroupId}) : b);
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
        localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
    }
  };

  const updateBoardCollaboration = async (boardId: string, orgId: string | null, teamId: string | null) => {
    const { board, boardRef, isShared } = await getBoardAndRef(boardId);
    if (!board || !isShared || !boardRef) { 
        toast({ title: "Error", description: "Can only update collaboration for existing shared boards.", variant: "destructive"});
        return;
    }
    await updateDoc(boardRef, { organizationId: orgId, teamId: teamId });
    const boardName = board.name || "Board";
    toast({ title: "Board Collaboration Updated", description: `Collaboration settings for "${boardName}" updated.` });
  };

  const addBoardGroup = (name: string): BoardGroup | undefined => {
    if (!currentUser && !isGuest) {
        toast({ title: "Action Denied", variant: "destructive"});
        return undefined;
    }
    const newGroup = sanitizeBoardGroup({ name, boardIds: [] });
    setBoardGroups(prev => [...prev, newGroup]);
    toast({ title: "Board Group Created", description: `Group "${name}" created.`});
    return newGroup;
  };

  const deleteBoardGroup = (groupId: string) => {
    if (!currentUser && !isGuest) return;
    const groupToDelete = boardGroups.find(g => g.id === groupId);
    if (!groupToDelete) return;

    setBoardGroups(prev => prev.filter(g => g.id !== groupId));
    combinedBoards.forEach(async b => {
        if (b.groupId === groupId) {
            const { boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(b.id);
            if (isShared && boardRef) {
                await updateDoc(boardRef, { groupId: null });
            } else if (!isShared && userDocRef && currentPersonalBoards) {
                const updatedPersonal = currentPersonalBoards.map(pb => pb.id === b.id ? {...pb, groupId: null} : pb);
                await updateDoc(userDocRef, { personalBoards: updatedPersonal.map(pb => sanitizeBoard(pb))});
            } else if (isGuest) {
                const updatedGuestBoards = boardsData.personal.map(gb => gb.id === b.id ? sanitizeBoard({...gb, groupId: null}) : gb);
                setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
                // For guests, boardGroups save is handled by the useEffect for boardGroups itself
            }
        }
    });
    toast({ title: "Board Group Deleted", description: `Group "${groupToDelete.name}" deleted. Boards are now ungrouped.`});
  };

  const updateBoardGroupName = (groupId: string, newName: string) => {
    if (!currentUser && !isGuest) return;
    setBoardGroups(prev => prev.map(g => g.id === groupId ? sanitizeBoardGroup({ ...g, name: newName }) : g));
    toast({ title: "Board Group Renamed"});
  };

  const addBoardToGroup = async (boardId: string, targetGroupId: string) => {
    if (!currentUser && !isGuest) return;
    const boardToMove = combinedBoards.find(b => b.id === boardId);
    if (!boardToMove) return;

    const { boardRef: targetBoardRef, isShared: targetIsShared, userDocRef: targetUserDocRef, currentPersonalBoards: targetCurrentPersonal } = await getBoardAndRef(boardId);
    if (targetIsShared && targetBoardRef) {
        await updateDoc(targetBoardRef, { groupId: targetGroupId });
    } else if (!targetIsShared && targetUserDocRef && targetCurrentPersonal) {
        const updatedBoards = targetCurrentPersonal.map(b => b.id === boardId ? {...b, groupId: targetGroupId} : b);
        await updateDoc(targetUserDocRef, { personalBoards: updatedBoards.map(b => sanitizeBoard(b)) });
    } else if (isGuest) {
        const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizeBoard({...b, groupId: targetGroupId}) : b);
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
    }
    
    setBoardGroups(prevGroups => prevGroups.map(g => {
        let newBoardIds = [...g.boardIds];
        // Remove from old group if it was in one
        if (g.id !== targetGroupId && newBoardIds.includes(boardId)) {
            newBoardIds = newBoardIds.filter(id => id !== boardId);
        }
        // Add to new group if not already there
        if (g.id === targetGroupId && !newBoardIds.includes(boardId)) {
            newBoardIds.push(boardId);
        }
        return sanitizeBoardGroup({ ...g, boardIds: newBoardIds });
    }));
    toast({ title: "Board Added to Group" });
  };

  const removeBoardFromGroup = async (boardId: string) => {
    if (!currentUser && !isGuest) return;
    const boardToRemove = combinedBoards.find(b => b.id === boardId);
    if (!boardToRemove || !boardToRemove.groupId) return;
    
    const oldGroupId = boardToRemove.groupId;

    const { boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (isShared && boardRef) {
        await updateDoc(boardRef, { groupId: null });
    } else if (!isShared && userDocRef && currentPersonalBoards) {
        const updatedBoards = currentPersonalBoards.map(b => b.id === boardId ? {...b, groupId: null} : b);
        await updateDoc(userDocRef, { personalBoards: updatedBoards.map(b => sanitizeBoard(b)) });
    } else if (isGuest) {
        const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizeBoard({...b, groupId: null}) : b);
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
    }

    setBoardGroups(prevGroups => prevGroups.map(g => 
        g.id === oldGroupId ? sanitizeBoardGroup({ ...g, boardIds: g.boardIds.filter(id => id !== boardId) }) : g
    ));
    toast({ title: "Board Removed from Group" });
  };


  const modifyBoardData = async (
    boardId: string, 
    updateFunction: (boardData: Board) => Board | false 
  ) => {
    if (!currentUser && !isGuest && !getActiveBoard()?.organizationId) return; 

    const { board, boardRef, isShared, userDocRef, currentPersonalBoards } = await getBoardAndRef(boardId);
    if (!board) return;

    const updatedBoardData = updateFunction(board);
    if (updatedBoardData === false) return; 

    const sanitizedUpdatedBoard = sanitizeBoard(updatedBoardData);

    if (isShared && boardRef) {
      await updateDoc(boardRef, sanitizedUpdatedBoard); 
    } else if (userDocRef && currentPersonalBoards) {
      const updatedPersonalBoards = currentPersonalBoards.map(b => b.id === boardId ? sanitizedUpdatedBoard : sanitizeBoard(b));
      await updateDoc(userDocRef, { personalBoards: updatedPersonalBoards });
    } else if (isGuest) {
        const updatedGuestBoards = boardsData.personal.map(b => b.id === boardId ? sanitizedUpdatedBoard : sanitizeBoard(b));
        setBoardsData(prev => ({...prev, personal: updatedGuestBoards}));
        localStorage.setItem('kanbanBoards-guestSession', JSON.stringify(updatedGuestBoards));
    }
  };

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'> & Partial<Pick<Task, 'dependencies' | 'checklist' | 'tags' | 'description' | 'deadline' | 'assignedTo' | 'subtasks'>>, targetColumnIdInput?: Column['id']) => {
    const board = getActiveBoard();
    if (!board) return;
    
    modifyBoardData(board.id, currentBoard => {
      const finalTargetColumnId = targetColumnIdInput || (currentBoard.columns.length > 0 ? currentBoard.columns[0].id : undefined);
      if (!finalTargetColumnId) {
        setTimeout(() => toast({ title: "Error Adding Task", description: "No columns available.", variant: "destructive" }), 0);
        return false;
      }
      const sanitizedPartialTask: Partial<Task> = {
        ...taskData, status: finalTargetColumnId, dependencies: taskData.dependencies || [],
        description: taskData.description || null, deadline: taskData.deadline || null,
        tags: taskData.tags || [], 
        checklist: (taskData.checklist || []).map(ci => ({ id: ci.id || generateId('cl-item'), text: ci.text || '', completed: ci.completed || false })),
        subtasks: (taskData.subtasks || []).map(st => ({ id: st.id || generateId('subtask'), text: st.text || '', completed: st.completed || false })),
        assignedTo: taskData.assignedTo || [], createdAt: formatISO(new Date()),
      };
      const newTask = sanitizeBoard({columns: [{id: finalTargetColumnId, tasks: [sanitizedPartialTask as Task]}]}).columns[0].tasks[0];

      const updatedBoardColumns = currentBoard.columns.map(col => 
        col.id === finalTargetColumnId ? { ...col, tasks: [newTask, ...(col.tasks || [])] } : col
      );
      setTimeout(() => toast({ title: "Task Added!", description: `Task "${newTask.content}" added.` }),0);
      return { ...currentBoard, columns: updatedBoardColumns };
    });
  };
  
  const moveTask = (taskId: string, sourceColumnId: Column['id'], targetColumnId: Column['id'], isBetaModeActive: boolean): { task: Task | null, automated: boolean } => {
    let movedTaskResult: Task | null = null;
    let automationAppliedResult = false;
    const board = getActiveBoard();
    if (!board) return { task: null, automated: false };

    modifyBoardData(board.id, currentBoard => {
      let localMovedTask: Task | null = null;
      let localAutomationApplied = false;
      const newBoardColumns = currentBoard.columns.map(col => ({ ...col, tasks: [...(col.tasks || [])] }));
      const sourceCol = newBoardColumns.find(col => col.id === sourceColumnId);
      const targetCol = newBoardColumns.find(col => col.id === targetColumnId);

      if (!sourceCol || !targetCol) return false;
      const taskIndex = sourceCol.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) return false;
      
      [localMovedTask] = sourceCol.tasks.splice(taskIndex, 1);
      if (localMovedTask) {
        localMovedTask.status = targetColumnId;
        if (isBetaModeActive && targetCol.title.toLowerCase() === 'done' && localMovedTask.checklist && localMovedTask.checklist.length > 0) {
          localMovedTask.checklist = localMovedTask.checklist.map(item => ({ ...item, completed: true }));
          localAutomationApplied = true;
        }
        targetCol.tasks.unshift(localMovedTask); 
        movedTaskResult = localMovedTask;
        automationAppliedResult = localAutomationApplied;
        setTimeout(() => {
            toast({ title: "Task Moved", description: `Task "${localMovedTask?.content}" moved to "${targetCol.title}".`});
            if (localAutomationApplied) toast({ title: "Automation Applied", description: "Checklist items marked complete."});
        }, 0);
      }
      return { ...currentBoard, columns: newBoardColumns };
    });
    return { task: movedTaskResult, automated: automationAppliedResult };
  };

  const deleteTask = (taskId: string, columnId: Column['id']) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
      let taskName = "Task";
      const updatedBoardColumns = currentBoard.columns.map(col => {
        if (col.id === columnId) {
          const taskToDelete = col.tasks.find(t => t.id === taskId);
          if (taskToDelete) taskName = taskToDelete.content;
          return { ...col, tasks: (col.tasks || []).filter(task => task.id !== taskId) };
        }
        return col;
      });
      setTimeout(() => toast({ title: "Task Deleted" }), 0);
      return { ...currentBoard, columns: updatedBoardColumns };
    });
  };

  const updateTask = (updatedTaskData: Partial<Task> & { id: string }) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
      const updatedBoardColumns = currentBoard.columns.map(col => ({
        ...col,
        tasks: (col.tasks || []).map(task => task.id === updatedTaskData.id ? sanitizeBoard({columns: [{id: col.id, tasks: [{...task, ...updatedTaskData}]}]}).columns[0].tasks[0] : task)
      }));
      setTimeout(() => toast({ title: "Task Updated" }), 0);
      return { ...currentBoard, columns: updatedBoardColumns };
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
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
      const newColumn = sanitizeAndAssignColumns([{ title, tasks: [], subtasks: [] }])[0];
      setTimeout(() => toast({ title: "Column Added", description: `Column "${title}" created.` }), 0);
      return { ...currentBoard, columns: [...currentBoard.columns, newColumn] };
    });
  };

  const updateColumnTitle = (columnId: string, newTitle: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
        const updatedCols = currentBoard.columns.map(col => col.id === columnId ? { ...col, title: newTitle } : col);
        setTimeout(() => toast({ title: "Column Updated", description: "Column title changed."}), 0);
        return { ...currentBoard, columns: updatedCols };
    });
  };
  
  const deleteColumn = (columnId: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
      const colToDelete = currentBoard.columns.find(c => c.id === columnId);
      const updatedCols = currentBoard.columns.filter(col => col.id !== columnId);
      setTimeout(() => toast({ title: "Column Deleted", description: `Column "${colToDelete?.title}" and its tasks deleted.`}), 0);
      return { ...currentBoard, columns: updatedCols };
    });
  };
  
  const updateColumnWipLimit = (columnId: string, limit?: number) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
        const updatedCols = currentBoard.columns.map(col => col.id === columnId ? { ...col, wipLimit: limit === undefined || limit < 0 ? 0 : limit } : col);
        setTimeout(() => toast({ title: "WIP Limit Updated" }), 0);
        return { ...currentBoard, columns: updatedCols };
    });
  };
  
  const addChecklistItem = (taskId: string, columnId: string, itemText: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
      const updatedCols = currentBoard.columns.map(col => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: (col.tasks || []).map(task => {
              if (task.id === taskId) {
                const newChecklistItem = { id: generateId('cl-item'), text: itemText, completed: false };
                return { ...task, checklist: [...(task.checklist || []), newChecklistItem]};
              }
              return task;
            })
          };
        }
        return col;
      });
      return { ...currentBoard, columns: updatedCols };
    });
  };

  const toggleChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
        const updatedCols = currentBoard.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        return { ...task, checklist: task.checklist.map(item => item.id === itemId ? {...item, completed: !item.completed} : item)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { ...currentBoard, columns: updatedCols };
    });
  };
  
  const deleteChecklistItem = (taskId: string, columnId: string, itemId: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
        const updatedCols = currentBoard.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        return { ...task, checklist: task.checklist.filter(item => item.id !== itemId)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { ...currentBoard, columns: updatedCols };
    });
  };

  const updateChecklistItemText = (taskId: string, columnId: string, itemId: string, newText: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, currentBoard => {
        const updatedCols = currentBoard.columns.map(col => {
            if (col.id === columnId) {
                return { ...col, tasks: (col.tasks || []).map(task => {
                    if (task.id === taskId && task.checklist) {
                        return { ...task, checklist: task.checklist.map(item => item.id === itemId ? {...item, text: newText} : item)};
                    }
                    return task;
                })};
            }
            return col;
        });
        return { ...currentBoard, columns: updatedCols };
    });
  };

  const addSubtask = (taskId: string, columnId: string, subtaskText: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, (currentBoard) => {
      const updatedCols = currentBoard.columns.map((col) => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: (col.tasks || []).map((task) => {
              if (task.id === taskId) {
                const newSubtask: Subtask = {
                  id: generateId('subtask'),
                  text: subtaskText,
                  completed: false,
                };
                return { ...task, subtasks: [...(task.subtasks || []), newSubtask] };
              }
              return task;
            }),
          };
        }
        return col;
      });
      setTimeout(() => toast({ title: "Subtask Added" }), 0);
      return { ...currentBoard, columns: updatedCols };
    });
  };

  const toggleSubtask = (taskId: string, columnId: string, subtaskId: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, (currentBoard) => {
      const updatedCols = currentBoard.columns.map((col) => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: (col.tasks || []).map((task) => {
              if (task.id === taskId && task.subtasks) {
                return {
                  ...task,
                  subtasks: task.subtasks.map((sub) =>
                    sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
                  ),
                };
              }
              return task;
            }),
          };
        }
        return col;
      });
      return { ...currentBoard, columns: updatedCols };
    });
  };

  const deleteSubtask = (taskId: string, columnId: string, subtaskId: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, (currentBoard) => {
      const updatedCols = currentBoard.columns.map((col) => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: (col.tasks || []).map((task) => {
              if (task.id === taskId && task.subtasks) {
                return {
                  ...task,
                  subtasks: task.subtasks.filter((sub) => sub.id !== subtaskId),
                };
              }
              return task;
            }),
          };
        }
        return col;
      });
      setTimeout(() => toast({ title: "Subtask Deleted" }), 0);
      return { ...currentBoard, columns: updatedCols };
    });
  };

  const updateSubtaskText = (taskId: string, columnId: string, subtaskId: string, newText: string) => {
    const board = getActiveBoard();
    if (!board) return;
    modifyBoardData(board.id, (currentBoard) => {
      const updatedCols = currentBoard.columns.map((col) => {
        if (col.id === columnId) {
          return {
            ...col,
            tasks: (col.tasks || []).map((task) => {
              if (task.id === taskId && task.subtasks) {
                return {
                  ...task,
                  subtasks: task.subtasks.map((sub) =>
                    sub.id === subtaskId ? { ...sub, text: newText } : sub
                  ),
                };
              }
              return task;
            }),
          };
        }
        return col;
      });
      setTimeout(() => toast({ title: "Subtask Updated" }), 0);
      return { ...currentBoard, columns: updatedCols };
    });
  };


  if (isLoadingData && !isGuest) { 
     return (
      <TaskContext.Provider value={{ 
        boards: [], activeBoardId: null, setActiveBoardId: () => {}, getActiveBoard: () => undefined, 
        addBoard: async () => undefined, deleteBoard: () => {}, updateBoardName: () => {}, updateBoardTheme: () => {}, updateBoardGroupId: () => {}, updateBoardCollaboration: () => {},
        boardGroups: [], addBoardGroup: () => undefined, deleteBoardGroup: () => {}, updateBoardGroupName: () => {}, addBoardToGroup: () => {}, removeBoardFromGroup: () => {},
        addTask: () => {}, moveTask: () => ({task: null, automated: false }), deleteTask: () => {}, updateTask: () => {}, getTaskById: () => undefined, getAllTasksOfActiveBoard: () => [],
        addColumn: () => {}, updateColumnTitle: () => {}, deleteColumn: () => {}, updateColumnWipLimit: () => {},
        addChecklistItem: () => {}, toggleChecklistItem: () => {}, deleteChecklistItem: () => {}, updateChecklistItemText: () => {},
        addSubtask: () => {}, toggleSubtask: () => {}, deleteSubtask: () => {}, updateSubtaskText: () => {}
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
        boards: combinedBoards, activeBoardId, setActiveBoardId, getActiveBoard, addBoard, deleteBoard, updateBoardName, updateBoardTheme, updateBoardGroupId, updateBoardCollaboration,
        boardGroups, addBoardGroup, deleteBoardGroup, updateBoardGroupName, addBoardToGroup, removeBoardFromGroup,
        addTask, moveTask, deleteTask, updateTask, getTaskById, getAllTasksOfActiveBoard,
        addColumn, updateColumnTitle, deleteColumn, updateColumnWipLimit,
        addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateChecklistItemText,
        addSubtask, toggleSubtask, deleteSubtask, updateSubtaskText
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

