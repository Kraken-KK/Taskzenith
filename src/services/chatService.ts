// src/services/chatService.ts
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  orderBy,
  onSnapshot,
  limit,
  Timestamp,
  deleteDoc,
  writeBatch,
  getDoc,
  setDoc
} from 'firebase/firestore';
import type { ChatMessage, ChatRoom } from '@/types';
import { formatISO } from 'date-fns';

// Helper to generate a consistent private chat room ID
const getPrivateChatRoomId = (userId1: string, userId2: string): string => {
  return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
};

export const getOrCreatePrivateChatRoom = async (
  currentUserId: string,
  targetUserId: string,
  currentUserDisplayName: string,
  targetUserDisplayName: string
): Promise<string | null> => {
  if (currentUserId === targetUserId) {
    console.error("Cannot create a chat room with oneself.");
    return null;
  }

  const chatRoomId = getPrivateChatRoomId(currentUserId, targetUserId);
  const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

  try {
    const chatRoomSnap = await getDoc(chatRoomRef);

    if (chatRoomSnap.exists()) {
      // Chat room already exists
      return chatRoomId;
    } else {
      // Create a new chat room
      const newChatRoomData: Omit<ChatRoom, 'id' | 'createdAt' | 'lastMessageAt'> & { createdAt: Timestamp, lastMessageAt?: Timestamp } = {
        type: 'private',
        memberIds: [currentUserId, targetUserId],
        memberDisplayNames: {
          [currentUserId]: currentUserDisplayName,
          [targetUserId]: targetUserDisplayName,
        },
        createdAt: serverTimestamp() as Timestamp,
        // lastMessageText and lastMessageAt will be updated by sendMessage
      };
      await setDoc(chatRoomRef, newChatRoomData);

      // Add this chatRoomId to both users' documents
      const currentUserDocRef = doc(db, 'users', currentUserId);
      const targetUserDocRef = doc(db, 'users', targetUserId);
      
      const batch = writeBatch(db);
      batch.update(currentUserDocRef, { chatRoomIds: arrayUnion(chatRoomId) });
      batch.update(targetUserDocRef, { chatRoomIds: arrayUnion(chatRoomId) });
      await batch.commit();
      
      return chatRoomId;
    }
  } catch (error) {
    console.error("Error getting or creating private chat room:", error);
    return null;
  }
};

export const sendMessage = async (
  chatRoomId: string,
  senderId: string,
  senderDisplayName: string,
  text: string
): Promise<void> => {
  if (!text.trim()) return;

  const messagesColRef = collection(db, 'chatRooms', chatRoomId, 'messages');
  const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

  try {
    const newMessageData: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      chatRoomId,
      senderId,
      senderDisplayName,
      text: text.trim(),
      createdAt: serverTimestamp() as Timestamp,
    };
    await addDoc(messagesColRef, newMessageData);

    // Update the chat room's last message details
    await updateDoc(chatRoomRef, {
      lastMessageText: text.trim(),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    throw error; // Re-throw to be caught by UI
  }
};

export const getChatRoomMessagesStream = (
  chatRoomId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const messagesColRef = collection(db, 'chatRooms', chatRoomId, 'messages');
  const q = query(messagesColRef, orderBy('createdAt', 'asc'), limit(100)); // Get last 100 messages

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const messages = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? formatISO((data.createdAt as Timestamp).toDate()) : formatISO(new Date()),
        } as ChatMessage;
      });
      callback(messages);
    },
    (error) => {
      console.error("Error listening to chat room messages:", error);
    }
  );

  return unsubscribe;
};

export const getUserChatRoomsStream = (
  userId: string,
  callback: (chatRooms: ChatRoom[]) => void
): (() => void) => {
  if (!userId) {
    return () => {}; // Return a no-op unsubscribe function if no userId
  }
  // This query requires that user documents store an array of chatRoomIds they are part of.
  // Or, query chatRooms where memberIds array-contains userId.
  // The latter is more scalable if a user can be in many chat rooms.
  const chatRoomsColRef = collection(db, 'chatRooms');
  const q = query(
    chatRoomsColRef, 
    where('memberIds', 'array-contains', userId), 
    orderBy('lastMessageAt', 'desc') // Order by most recent activity
  );

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const chatRooms = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? formatISO((data.createdAt as Timestamp).toDate()) : formatISO(new Date()),
          lastMessageAt: (data.lastMessageAt as Timestamp)?.toDate ? formatISO((data.lastMessageAt as Timestamp).toDate()) : undefined,
        } as ChatRoom;
      });
      callback(chatRooms);
    },
    (error) => {
      console.error("Error listening to user chat rooms:", error);
    }
  );

  return unsubscribe;
};

// Placeholder for future group chat functionality
// export const createGroupChatRoom = async (...) => { ... };
// export const addUserToGroupChat = async (...) => { ... };
// export const removeUserFromGroupChat = async (...) => { ... };
