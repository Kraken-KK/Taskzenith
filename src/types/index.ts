// src/types/index.ts

// Define the structure of a checklist item
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// Define board theme customization options
export interface BoardTheme {
  primaryColor?: string; // HEX string, e.g., "#RRGGBB"
  backgroundColor?: string; // HEX string
  columnHeaderColor?: string; // HEX string
  cardColor?: string; // HEX string
}

// Define the structure of a task
export interface Task {
  id: string;
  content: string;
  status: string; // Column ID this task belongs to
  priority: 'high' | 'medium' | 'low';
  deadline?: string; // ISO string format recommended
  dependencies: string[]; // Array of task IDs this task depends on
  description?: string; // More detailed description
  tags: string[]; // Task tags
  checklist: ChecklistItem[]; // Checklists
  createdAt: string; // ISO string format for task creation time
  assignedTo?: string[]; // User IDs of assignees, for team context
}

// Define the structure of a column on the Kanban board
export interface Column {
  id:string;
  title: string;
  tasks: Task[]; // Tasks are directly within columns
  wipLimit?: number;
}

// Define the structure of a Kanban Board
export interface Board {
  id: string;
  name: string;
  columns: Column[];
  theme?: BoardTheme; // Optional theme customization
  createdAt: string; // ISO string format for board creation time
  groupId?: string | null; // Optional: ID of the group this board belongs to
  organizationId?: string | null; // For associating with an organization
  teamId?: string | null; // For associating with a team
  isPublic: boolean; 
}

// Define the structure of a Board Group
export interface BoardGroup {
  id: string;
  name: string;
  boardIds: string[]; // Array of board IDs belonging to this group
  createdAt: string; // ISO string format for group creation time
}

// Define the structure of a Team
export interface Team {
  id: string;
  name: string;
  organizationId: string; // Each team belongs to an organization
  memberIds: string[]; // Array of user IDs
  adminIds: string[]; // Array of user IDs who are admins of this team
  createdAt: string;
  description?: string;
}

// Define the structure of an Organization
export interface Organization {
  id: string;
  name: string;
  ownerId: string; // User ID of the organization owner/creator
  memberIds: string[]; // Array of user IDs (includes owner)
  teamIds?: string[]; // Optional: List of team IDs within this organization
  createdAt: string;
  description?: string;
  inviteCode: string; // 5-character alphanumeric invite code
}

// ---- Chat Feature Types ----

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[]; // Array of user IDs who voted for this option
}

export interface Poll {
  question: string;
  options: PollOption[];
  createdBy: string; // User ID of the poll creator
  createdAt: string; // ISO string
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  senderDisplayName: string;
  text: string;
  createdAt: string; // ISO string for Firestore serverTimestamp
  poll?: Poll; // Optional poll object
}

export interface ChatRoom {
  id: string;
  type: 'private' | 'group'; // Initially focusing on 'private'
  memberIds: string[]; // Array of user IDs
  // For private chats, memberDisplayNames helps show the other user's name easily
  memberDisplayNames: { [userId: string]: string }; 
  name?: string; // Only for group chats
  lastMessageText?: string;
  lastMessageAt?: string; // ISO string for Firestore serverTimestamp
  lastMessageSenderId?: string;
  createdAt: string; // ISO string for Firestore serverTimestamp
  // For group chats (future)
  createdBy?: string; 
  groupAdmins?: string[];
  groupImage?: string;
}
