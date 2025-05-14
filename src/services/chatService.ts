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
  setDoc,
  runTransaction
} from 'firebase/firestore';
import type { ChatMessage, ChatRoom, Poll } from '@/types';
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
  text: string,
  poll?: Poll // Add poll as an optional parameter
): Promise<void> => {
  if (!text.trim() && !poll) return; // Message must have text or a poll

  const messagesColRef = collection(db, 'chatRooms', chatRoomId, 'messages');
  const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

  try {
    const newMessageData: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt: Timestamp, poll?: Poll } = {
      chatRoomId,
      senderId,
      senderDisplayName,
      text: text.trim(),
      createdAt: serverTimestamp() as Timestamp,
    };
    if (poll) {
      // Ensure poll options have an empty voterIds array if not provided
      const sanitizedPoll: Poll = {
        ...poll,
        options: poll.options.map(opt => ({
          ...opt,
          voterIds: opt.voterIds || [] 
        })),
        createdAt: poll.createdAt || formatISO(new Date()) // Ensure createdAt is set
      };
      newMessageData.poll = sanitizedPoll;
    }
    await addDoc(messagesColRef, newMessageData);

    // Update the chat room's last message details
    let lastMessageText = text.trim();
    if (poll && !lastMessageText) { // If only a poll is sent, use its question as last message text
        lastMessageText = `Poll: ${poll.question}`;
    }

    await updateDoc(chatRoomRef, {
      lastMessageText: lastMessageText.length > 100 ? lastMessageText.substring(0, 97) + "..." : lastMessageText,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    throw error; // Re-throw to be caught by UI
  }
};


export const voteOnPoll = async (
  chatRoomId: string,
  messageId: string,
  optionId: string,
  userId: string
): Promise<void> => {
  const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);

  try {
    await runTransaction(db, async (transaction) => {
      const messageSnap = await transaction.get(messageRef);
      if (!messageSnap.exists()) {
        throw new Error("Message with the poll not found.");
      }

      const messageData = messageSnap.data() as ChatMessage;
      if (!messageData.poll) {
        throw new Error("Poll not found in this message.");
      }

      const currentPoll = messageData.poll;
      let userAlreadyVotedForThisOption = false;

      const newOptions = currentPoll.options.map(opt => {
        let newVoterIds = [...(opt.voterIds || [])]; // Ensure voterIds is an array

        if (opt.id === optionId) { // This is the option the user clicked
          if (newVoterIds.includes(userId)) {
            // User is trying to un-vote (or re-vote for the same)
            // For simplicity, let's allow re-voting for the same (no change) or un-voting
            // newVoterIds = newVoterIds.filter(voter => voter !== userId); // To allow un-voting
            userAlreadyVotedForThisOption = true; // Mark that user had already voted for this
          } else {
            newVoterIds.push(userId); // Add user's vote
          }
        } else {
          // This is not the option the user clicked, so remove their vote if it exists
          if (newVoterIds.includes(userId)) {
            newVoterIds = newVoterIds.filter(voter => voter !== userId);
          }
        }
        return { ...opt, voterIds: newVoterIds };
      });
      
      // If user clicked an option they hadn't voted for, and they had voted for another,
      // the above loop already removed their old vote.
      // If they clicked the same option they already voted for, no change in voterIds array.

      transaction.update(messageRef, { poll: { ...currentPoll, options: newOptions } });
    });
  } catch (error) {
    console.error("Error voting on poll:", error);
    throw error;
  }
};


export const getChatRoomMessagesStream = (
  chatRoomId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const messagesColRef = collection(db, 'chatRooms', chatRoomId, 'messages');
  const q = query(messagesColRef, orderBy('createdAt', 'asc'), limit(100)); 

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const messages = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const pollData = data.poll ? {
          ...data.poll,
          createdAt: (data.poll.createdAt as Timestamp)?.toDate 
                       ? formatISO((data.poll.createdAt as Timestamp).toDate()) 
                       : (typeof data.poll.createdAt === 'string' ? data.poll.createdAt : formatISO(new Date())),
          options: Array.isArray(data.poll.options) 
                     ? data.poll.options.map((opt: any) => ({...opt, voterIds: Array.isArray(opt.voterIds) ? opt.voterIds : [] }))
                     : [],
        } : undefined;

        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? formatISO((data.createdAt as Timestamp).toDate()) : formatISO(new Date()),
          poll: pollData,
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
    return () => {}; 
  }
  const chatRoomsColRef = collection(db, 'chatRooms');
  const q = query(
    chatRoomsColRef, 
    where('memberIds', 'array-contains', userId), 
    orderBy('lastMessageAt', 'desc') 
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
