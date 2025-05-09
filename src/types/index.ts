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
}

// Define the structure of a column on the Kanban board
export interface Column {
  id: string;
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
}
