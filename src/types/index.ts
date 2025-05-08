
// src/types/index.ts

// Define the structure of a task
export interface Task {
  id: string;
  content: string;
  status: string; // Changed to string to support dynamic column IDs
  priority: 'high' | 'medium' | 'low';
  deadline?: string; // ISO string format recommended
  dependencies?: string[]; // Array of task IDs this task depends on
  description?: string; // More detailed description
  tags?: string[]; // Added for beta feature: task tags
}

// Define the structure of a column on the Kanban board
export interface Column {
  id: string; // Changed to string for dynamic column IDs
  title: string;
  tasks: Task[];
}
