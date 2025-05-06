// src/types/index.ts

// Define the structure of a task
export interface Task {
  id: string;
  content: string;
  status: 'todo' | 'inProgress' | 'done';
  priority: 'high' | 'medium' | 'low'; // Made non-optional
  deadline?: string; // ISO string format recommended
  dependencies?: string[]; // Array of task IDs this task depends on
  description?: string; // More detailed description
}

// Define the structure of a column on the Kanban board
export interface Column {
  id: 'todo' | 'inProgress' | 'done';
  title: string;
  tasks: Task[];
}