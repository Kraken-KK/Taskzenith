
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label"; // Added import for Label
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Edit2, Trash2, Check, X, GripVertical, AlertTriangle, ListChecks, Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';
import { useToast } from "@/hooks/use-toast";
import type { Task, Column, ChecklistItem } from '@/types';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { useTasks } from '@/contexts/TaskContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function KanbanBoard() {
  const { 
    columns, addTask, moveTask, deleteTask, updateTask, 
    addColumn, updateColumnTitle, deleteColumn, updateColumnWipLimit,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateChecklistItemText
  } = useTasks();
  const { isBetaModeEnabled } = useSettings();
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [targetColumnForNewTask, setTargetColumnForNewTask] = useState<string | undefined>(undefined);

  const [newColumnName, setNewColumnName] = useState('');
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renamingColumnTitle, setRenamingColumnTitle] = useState('');

  // WIP Limit state
  const [editingWipColumnId, setEditingWipColumnId] = useState<string | null>(null);
  const [currentWipLimitInput, setCurrentWipLimitInput] = useState<string>('');

  // Checklist state
  const [newChecklistItemText, setNewChecklistItemText] = useState<Record<string, string>>({}); // { [taskId]: text }
  const [editingChecklistItem, setEditingChecklistItem] = useState<{taskId: string, itemId: string, text: string} | null>(null);


  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.currentTarget.classList.add('opacity-50', 'shadow-2xl', 'scale-105');
    e.currentTarget.classList.remove('hover:shadow-xl', 'hover:-translate-y-1');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault();
    const column = columns.find(c => c.id === columnId);
    if (draggedTask && column && isBetaModeEnabled && column.wipLimit !== undefined && column.tasks.length >= column.wipLimit && draggedTask.status !== columnId) {
        // Optionally indicate that drop is not allowed or will exceed limit
        e.dataTransfer.dropEffect = "none"; // This might not work universally, visual cues are better
    } else {
        e.dataTransfer.dropEffect = "move";
    }
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const taskElement = document.getElementById(`task-${draggedTask.id}`);
    if (taskElement) {
        taskElement.classList.remove('opacity-50', 'shadow-2xl', 'scale-105');
        taskElement.classList.add('hover:shadow-xl', 'hover:-translate-y-1');
    }
    
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (isBetaModeEnabled && targetColumn?.wipLimit !== undefined && targetColumn.tasks.length >= targetColumn.wipLimit && draggedTask.status !== targetColumnId) {
      toast({
        title: "WIP Limit Reached",
        description: `Cannot move task. Column "${targetColumn.title}" has reached its WIP limit of ${targetColumn.wipLimit}.`,
        variant: "destructive",
      });
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    if (draggedTask.status === targetColumnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    const isMovingToDone = columns.find(c => c.id === targetColumnId)?.title.toLowerCase() === 'done' && draggedTask.status !== targetColumnId;
    const moved = moveTask(draggedTask.id, draggedTask.status, targetColumnId);

    if (moved && isMovingToDone) {
        setShowConfetti(true);
        toast({
          title: "Task Completed!",
          description: `"${draggedTask.content}" moved to Done. Great job!`,
        });
        setTimeout(() => setShowConfetti(false), 5000);
    } else if (moved) {
         toast({
          title: "Task Moved",
          description: `"${draggedTask.content}" moved to ${columns.find(c => c.id === targetColumnId)?.title}.`,
        });
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (draggedTask) {
      const taskElement = document.getElementById(`task-${draggedTask.id}`);
      if (taskElement) {
        taskElement.classList.remove('opacity-50', 'shadow-2xl', 'scale-105');
        taskElement.classList.add('hover:shadow-xl', 'hover:-translate-y-1');
      }
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDialogAddTask = (taskData: Omit<Task, 'id' | 'status'>) => {
    if (editingTask) {
      updateTask({ ...editingTask, ...taskData, deadline: taskData.deadline ? taskData.deadline : undefined, tags: taskData.tags || editingTask.tags, checklist: editingTask.checklist || [] });
      setEditingTask(null);
    } else {
      addTask(taskData, targetColumnForNewTask || (columns.length > 0 ? columns[0].id : undefined));
    }
    setIsAddTaskDialogOpen(false);
    setTargetColumnForNewTask(undefined);
  };

  const openEditTaskDialog = (task: Task) => {
    setEditingTask(task);
    setIsAddTaskDialogOpen(true);
  };

  const handleDeleteTask = (taskId: string, columnId: string) => {
    deleteTask(taskId, columnId);
  };

  const getPriorityBadgeClass = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-destructive/20 text-destructive border border-destructive/30';
      case 'medium': return 'bg-orange-200 text-orange-800 border border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-700';
      case 'low': return 'bg-primary/20 text-primary border border-primary/30';
      default: return 'bg-muted text-muted-foreground border';
    }
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim());
      setNewColumnName('');
    } else {
      toast({ title: "Error", description: "Column name cannot be empty.", variant: "destructive" });
    }
  };

  const startRenameColumn = (column: Column) => {
    setRenamingColumnId(column.id);
    setRenamingColumnTitle(column.title);
  };

  const confirmRenameColumn = () => {
    if (renamingColumnId && renamingColumnTitle.trim()) {
      updateColumnTitle(renamingColumnId, renamingColumnTitle.trim());
      setRenamingColumnId(null);
      setRenamingColumnTitle('');
    } else {
      toast({ title: "Error", description: "Column name cannot be empty.", variant: "destructive"});
    }
  };

  const cancelRenameColumn = () => {
    setRenamingColumnId(null);
    setRenamingColumnTitle('');
  };

  const handleSetWipLimit = (columnId: string) => {
    const limit = currentWipLimitInput === '' ? undefined : parseInt(currentWipLimitInput, 10);
    if (limit !== undefined && (isNaN(limit) || limit < 0)) {
      toast({ title: "Invalid WIP Limit", description: "WIP Limit must be a non-negative number.", variant: "destructive" });
      return;
    }
    updateColumnWipLimit(columnId, limit);
    setEditingWipColumnId(null);
    setCurrentWipLimitInput('');
  };

  const handleAddChecklistItem = (taskId: string, columnId: string) => {
    const text = newChecklistItemText[taskId];
    if (text && text.trim()) {
      addChecklistItem(taskId, columnId, text.trim());
      setNewChecklistItemText(prev => ({ ...prev, [taskId]: '' }));
    }
  };
  
  const startEditChecklistItem = (task: Task, item: ChecklistItem) => {
    setEditingChecklistItem({ taskId: task.id, itemId: item.id, text: item.text });
  };

  const confirmEditChecklistItem = () => {
    if (editingChecklistItem) {
      const { taskId, itemId, text } = editingChecklistItem;
      const task = getTaskById(taskId);
      if (task) {
        updateChecklistItemText(taskId, task.status, itemId, text);
      }
      setEditingChecklistItem(null);
    }
  };
  
  const getTaskById = (taskId: string): Task | undefined => {
    for (const column of columns) {
        const task = column.tasks.find(t => t.id === taskId);
        if (task) return task;
    }
    return undefined;
};


  return (
    <div className="flex flex-col h-full">
      {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
        />
      )}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button 
            size="sm" 
            onClick={() => { 
                setEditingTask(null); 
                setTargetColumnForNewTask(columns.length > 0 ? columns[0].id : undefined);
                setIsAddTaskDialogOpen(true); 
            }}
            disabled={columns.length === 0 && !isBetaModeEnabled}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
        {isBetaModeEnabled && (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="New column name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="h-9 text-sm w-auto"
              onKeyPress={(e) => e.key === 'Enter' && handleAddColumn()}
            />
            <Button size="sm" onClick={handleAddColumn} variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Add Column
            </Button>
          </div>
        )}
      </div>

      <AddTaskDialog
        open={isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        onAddTask={handleDialogAddTask}
        initialTaskData={editingTask ?? undefined}
      />

      {columns.length === 0 && isBetaModeEnabled && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 rounded-lg border-2 border-dashed border-border/50">
              <GripVertical size={48} className="mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">No Columns Yet!</h2>
              <p className="mb-4 text-center">Start by adding your first column using the input above.</p>
          </div>
      )}

      <div className="flex space-x-4 overflow-x-auto pb-4 flex-1">
        {columns.map(column => {
          const isWipExceeded = isBetaModeEnabled && column.wipLimit !== undefined && column.tasks.length > column.wipLimit;
          return (
            <Card
              key={column.id}
              className={cn(
                  `min-w-[300px] max-w-[350px] flex flex-col transition-all duration-300 ease-in-out border`,
                  dragOverColumn === column.id ? 'bg-secondary/80 dark:bg-secondary/50 shadow-xl scale-[1.02]' : 'bg-card',
                  'interactive-card-hover',
                  isWipExceeded ? 'border-orange-400 dark:border-orange-600 ring-2 ring-orange-400/50 dark:ring-orange-600/50' : 'border-border'
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-2 border-b sticky top-0 bg-card/80 backdrop-blur-sm z-10",
                isWipExceeded ? 'bg-orange-100/50 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600' : 'border-border'
              )}>
                {renamingColumnId === column.id && isBetaModeEnabled ? (
                  <div className="flex items-center gap-1 w-full">
                    <Input
                      value={renamingColumnTitle}
                      onChange={(e) => setRenamingColumnTitle(e.target.value)}
                      autoFocus
                      className="h-7 text-base font-medium flex-grow"
                      onKeyPress={(e) => e.key === 'Enter' && confirmRenameColumn()}
                      onBlur={cancelRenameColumn}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:bg-green-500/10" onClick={confirmRenameColumn}><Check className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={cancelRenameColumn}><X className="h-4 w-4"/></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                       {isWipExceeded && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                      <CardTitle className="text-base font-medium truncate" title={column.title}>
                        {column.title} ({column.tasks.length}
                        {isBetaModeEnabled && column.wipLimit !== undefined && `/${column.wipLimit}`})
                      </CardTitle>
                    </div>
                    {isBetaModeEnabled && (
                      <div className="flex items-center">
                        <Popover open={editingWipColumnId === column.id} onOpenChange={(isOpen) => {
                            if (!isOpen) setEditingWipColumnId(null); else {
                                setEditingWipColumnId(column.id);
                                setCurrentWipLimitInput(column.wipLimit?.toString() || '');
                            }
                        }}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/50">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span className="sr-only">Set WIP Limit</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2">
                            <Label htmlFor={`wip-${column.id}`} className="text-xs">WIP Limit</Label>
                            <Input
                              id={`wip-${column.id}`}
                              type="number"
                              value={currentWipLimitInput}
                              onChange={(e) => setCurrentWipLimitInput(e.target.value)}
                              placeholder="None"
                              className="h-8 mt-1 text-sm"
                              min="0"
                            />
                            <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => handleSetWipLimit(column.id)}>Set</Button>
                          </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/50" onClick={() => {setTargetColumnForNewTask(column.id); setIsAddTaskDialogOpen(true); setEditingTask(null);}}>
                          <Plus className="h-3.5 w-3.5" />
                          <span className="sr-only">Add task</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/50" onClick={() => startRenameColumn(column)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the column "{column.title}". This action cannot be undone.
                                {column.tasks.length > 0 && " This column still contains tasks. They must be moved or deleted first."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteColumn(column.id)} 
                                disabled={column.tasks.length > 0 || columns.length <= 1}
                                className={cn(column.tasks.length > 0 || columns.length <=1 ? "bg-destructive/50 hover:bg-destructive/50 cursor-not-allowed" : "bg-destructive hover:bg-destructive/90")}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </>
                )}
              </CardHeader>
              <CardContent className="p-3 space-y-3 overflow-y-auto flex-1">
                {column.tasks.map(task => {
                  const completedChecklistItems = task.checklist?.filter(item => item.completed).length || 0;
                  const totalChecklistItems = task.checklist?.length || 0;
                  const checklistProgress = totalChecklistItems > 0 ? (completedChecklistItems / totalChecklistItems) * 100 : 0;

                  return (
                    <div
                      key={task.id}
                      id={`task-${task.id}`}
                      className="bg-background border border-border p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-1 group relative dark:bg-neutral-800 dark:border-neutral-700"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      <p className="text-sm font-medium mb-1.5 break-words">{task.content}</p>
                      {task.description && <p className="text-xs text-muted-foreground mb-2 break-words">{task.description}</p>}
                      
                      {isBetaModeEnabled && task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {task.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">{tag}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Checklist Section (Beta) */}
                      {isBetaModeEnabled && (task.checklist && task.checklist.length > 0 || editingChecklistItem?.taskId === task.id) && (
                        <div className="my-2 space-y-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center"><ListChecks className="w-3.5 h-3.5 mr-1" /> Checklist</Label>
                            {totalChecklistItems > 0 && (
                              <span className="text-xs text-muted-foreground">{completedChecklistItems}/{totalChecklistItems}</span>
                            )}
                          </div>
                           {totalChecklistItems > 0 && <Progress value={checklistProgress} className="h-1.5 mb-1" />}
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {(task.checklist || []).map(item => (
                              <div key={item.id} className="flex items-center group/checklist-item">
                                <Checkbox
                                  id={`cl-${item.id}`}
                                  checked={item.completed}
                                  onCheckedChange={() => toggleChecklistItem(task.id, column.id, item.id)}
                                  className="mr-2 h-3.5 w-3.5"
                                />
                                {editingChecklistItem?.itemId === item.id ? (
                                  <Input
                                    type="text"
                                    value={editingChecklistItem.text}
                                    onChange={(e) => setEditingChecklistItem({...editingChecklistItem, text: e.target.value})}
                                    onBlur={confirmEditChecklistItem}
                                    onKeyPress={(e) => e.key === 'Enter' && confirmEditChecklistItem()}
                                    autoFocus
                                    className="h-6 text-xs flex-grow mr-1"
                                  />
                                ) : (
                                  <label
                                    htmlFor={`cl-${item.id}`}
                                    className={cn("text-xs flex-grow cursor-pointer", item.completed && "line-through text-muted-foreground")}
                                    onDoubleClick={() => startEditChecklistItem(task,item)}
                                  >
                                    {item.text}
                                  </label>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover/checklist-item:opacity-100"
                                  onClick={() => deleteChecklistItem(task.id, column.id, item.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isBetaModeEnabled && (
                        <div className="mt-1 flex items-center gap-1">
                          <Input
                            type="text"
                            placeholder="Add checklist item..."
                            value={newChecklistItemText[task.id] || ''}
                            onChange={(e) => setNewChecklistItemText(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddChecklistItem(task.id, column.id)}
                            className="h-6 text-xs flex-grow"
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddChecklistItem(task.id, column.id)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}


                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {task.priority && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getPriorityBadgeClass(task.priority)}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          )}
                          {task.deadline && <span className="whitespace-nowrap">Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                        </div>
                        <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/50" onClick={() => openEditTaskDialog(task)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTask(task.id, column.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {column.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Drag tasks here or use the 
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-sm mx-1" 
                      onClick={() => {
                        setTargetColumnForNewTask(column.id); 
                        setIsAddTaskDialogOpen(true); 
                        setEditingTask(null);
                      }}
                    >
                      +
                    </Button> 
                     button above.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

