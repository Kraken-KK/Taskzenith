
// src/services/aiChatService.ts
'use client';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import type { AiChatSession, MessageHistoryItem } from '@/types';
import { formatISO } from 'date-fns';

export const getAiChatSessionsStream = (
  userId: string,
  callback: (sessions: AiChatSession[]) => void
): (() => void) => {
  if (!userId) {
    console.warn("User ID is undefined, cannot fetch AI chat sessions.");
    callback([]);
    return () => {};
  }
  const sessionsColRef = collection(db, 'users', userId, 'aiChatSessions');
  const q = query(sessionsColRef, orderBy('lastUpdatedAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const sessions = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Untitled Chat',
          userId: data.userId,
          createdAt: (data.createdAt as Timestamp)?.toDate ? formatISO((data.createdAt as Timestamp).toDate()) : formatISO(new Date()),
          lastUpdatedAt: (data.lastUpdatedAt as Timestamp)?.toDate ? formatISO((data.lastUpdatedAt as Timestamp).toDate()) : formatISO(new Date()),
          messages: (data.messages || []) as MessageHistoryItem[],
          status: data.status || 'active',
        } as AiChatSession;
      });
      callback(sessions);
    },
    (error) => {
      console.error("Error listening to AI chat sessions:", error);
      callback([]); // Return empty array on error
    }
  );
  return unsubscribe;
};

export const getAiChatSessionMessages = async (
  userId: string,
  sessionId: string
): Promise<MessageHistoryItem[]> => {
  if (!userId || !sessionId) {
    console.warn("User ID or Session ID is undefined for fetching messages.");
    return [];
  }
  const sessionDocRef = doc(db, 'users', userId, 'aiChatSessions', sessionId);
  try {
    const docSnap = await getDoc(sessionDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return (data.messages || []) as MessageHistoryItem[];
    }
    return [];
  } catch (error) {
    console.error("Error fetching AI chat session messages:", error);
    return [];
  }
};


export const createAiChatSession = async (
  userId: string,
  sessionName: string,
  initialMessages: MessageHistoryItem[]
): Promise<string | null> => {
  if (!userId) return null;
  const sessionsColRef = collection(db, 'users', userId, 'aiChatSessions');
  try {
    const newSessionDoc = await addDoc(sessionsColRef, {
      userId,
      name: sessionName,
      messages: initialMessages,
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
      status: 'active',
    });
    return newSessionDoc.id;
  } catch (error) {
    console.error("Error creating AI chat session:", error);
    return null;
  }
};

export const updateAiChatSession = async (
  userId: string,
  sessionId: string,
  messages: MessageHistoryItem[],
  sessionName?: string,
): Promise<void> => {
  if (!userId || !sessionId) return;
  const sessionDocRef = doc(db, 'users', userId, 'aiChatSessions', sessionId);
  const updateData: any = {
    messages: messages,
    lastUpdatedAt: serverTimestamp(),
  };
  if (sessionName) {
    updateData.name = sessionName;
  }
  try {
    await updateDoc(sessionDocRef, updateData);
  } catch (error) {
    console.error("Error updating AI chat session:", error);
  }
};

export const deleteAiChatSession = async (
  userId: string,
  sessionId: string
): Promise<void> => {
  if (!userId || !sessionId) return;
  const sessionDocRef = doc(db, 'users', userId, 'aiChatSessions', sessionId);
  try {
    await deleteDoc(sessionDocRef);
  } catch (error) {
    console.error("Error deleting AI chat session:", error);
  }
};
