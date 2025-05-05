'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from "@/hooks/use-toast";

// Define the structure of a task
interface Task {
  id: string;
  content: string;
  status: 'todo' | 'inProgress' | 'done';
  priority?: 'high' | 'medium' | 'low'; // Optional priority for visualization
  deadline?: string; // Optional deadline
}

// Define the structure of a column
interface Column {
  id: 'todo' | 'inProgress' | 'done';
  title: string;
  tasks: Task[];
}

// Initial placeholder data
const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      { id: 'task-1', content: 'Design the user interface mockup', status: 'todo', priority: 'high', deadline: '2024-08-15' },
      { id: 'task-2', content: 'Set up the project structure', status: 'todo', priority: 'medium' },
    ],
  },
  {
    id: 'inProgress',
    title: 'In Progress',
    tasks: [
      { id: 'task-3', content: 'Develop the Kanban board component', status: 'inProgress', priority: 'high' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      { id: 'task-4', content: 'Gather project requirements', status: 'done' },
    ],
  },
];

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();

  // Effect to get window size for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    // Ensure window is defined (client-side only)
    if (typeof window !== 'undefined') {
      handleResize(); // Set initial size
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

   // State for drag-and-drop
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<'todo' | 'inProgress' | 'done' | null>(null);


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    // Add some visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault(); // Necessary to allow dropping
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColumnId: 'todo' | 'inProgress' | 'done') => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === targetColumnId) {
        if (draggedTask) {
            const taskElement = document.getElementById(`task-${draggedTask.id}`);
            if (taskElement) taskElement.style.opacity = '1';
        }
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    const isMovingToDone = targetColumnId === 'done' && draggedTask.status !== 'done';

    // Update columns state
    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({ ...col, tasks: [...col.tasks] })); // Deep copy

      // Remove task from original column
      const sourceColumn = newColumns.find(col => col.id === draggedTask.status);
      if (sourceColumn) {
        sourceColumn.tasks = sourceColumn.tasks.filter(task => task.id !== draggedTask.id);
      }

      // Add task to target column
      const targetColumn = newColumns.find(col => col.id === targetColumnId);
      if (targetColumn) {
        targetColumn.tasks.push({ ...draggedTask, status: targetColumnId });
      }

      return newColumns;
    });

     // Trigger confetti if moved to 'Done'
    if (isMovingToDone) {
        setShowConfetti(true);
        toast({
          title: "Task Completed!",
          description: `"${draggedTask.content}" moved to Done. Great job!`,
        });
        setTimeout(() => setShowConfetti(false), 5000); // Show confetti for 5 seconds
    }


    // Reset styles and state
    const taskElement = document.getElementById(`task-${draggedTask.id}`);
    if (taskElement) taskElement.style.opacity = '1';
    setDraggedTask(null);
    setDragOverColumn(null);
  };

   const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // Reset opacity if drag ended without a successful drop
    if(draggedTask) {
         const taskElement = document.getElementById(`task-${draggedTask.id}`);
         if (taskElement) taskElement.style.opacity = '1';
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Basic styling for priority badges
  const getPriorityBadgeClass = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-200 text-red-800';
      case 'medium': return 'bg-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-200 text-green-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div className="flex space-x-4 overflow-x-auto pb-4 h-full">
       {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
        />
      )}
      {columns.map(column => (
        <Card
          key={column.id}
          className={`min-w-[300px] flex flex-col transition-colors duration-200 ${dragOverColumn === column.id ? 'bg-secondary' : 'bg-card'}`}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-lg font-medium">{column.title}</CardTitle>
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add task</span>
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 overflow-y-auto flex-1">
            {column.tasks.map(task => (
              <div
                key={task.id}
                id={`task-${task.id}`}
                className="bg-background border p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing transition-opacity duration-150"
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                onDragEnd={handleDragEnd}

              >
                <p className="text-sm font-medium mb-2">{task.content}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                   <div>
                    {task.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadgeClass(task.priority)}`}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                    )}
                    {task.deadline && <span className="ml-2">Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                   </div>

                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
             {column.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
             )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
