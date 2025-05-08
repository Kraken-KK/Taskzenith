
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Check, X, GripVertical, AlertTriangle, ListChecks, Sparkles, Filter, ArrowUpDown, Link2, MoreHorizontal, PlusCircle, CalendarDays, Tags, UserCircle } from 'lucide-react';
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
import { parseISO, compareAsc, formatDistanceToNow, format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buttonVariants } from "@/components/ui/button";


type SortOption = 'priority' | 'deadline' | 'default' | 'title' | 'createdAt';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const priorityOrder: Record<Task['priority'], number> = { high: 1, medium: 2, low: 3 };

interface TaskCardProps {
  task: Task;
  columnId: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, task: Task) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string, columnId: string) => void;
  onAddChecklistItem: (taskId: string, columnId: string, itemText: string) => void;
  onToggleChecklistItem: (taskId: string, columnId: string, itemId: string) => void;
  onDeleteChecklistItem: (taskId: string, columnId: string, itemId: string) => void;
  onUpdateChecklistItemText: (taskId: string, columnId: string, itemId: string, newText: string) => void;
  isBetaModeEnabled: boolean;
  getTaskById: (taskId: string) => Task | undefined;
  dragOverColumn: string | null;
}

function TaskCard({ task, columnId, onDragStart, onDragEnd, onUpdateTask, onDeleteTask, onAddChecklistItem, onToggleChecklistItem, onDeleteChecklistItem, onUpdateChecklistItemText, isBetaModeEnabled, getTaskById, dragOverColumn }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(task.content);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editedChecklistItemText, setEditedChecklistItemText] = useState('');
  const { toast } = useToast();

  const handleEditToggle = () => {
    if (isEditing && editedContent !== task.content) {
      onUpdateTask({ ...task, content: editedContent });
    }
    setIsEditing(!isEditing);
  };

  const handleAddChecklistItemInternal = () => {
    if (newChecklistItem.trim()) {
      onAddChecklistItem(task.id, columnId, newChecklistItem.trim());
      setNewChecklistItem('');
    }
  };
  
  const handleChecklistTextEdit = (itemId: string, currentText: string) => {
    setEditingChecklistItemId(itemId);
    setEditedChecklistItemText(currentText);
  };

  const handleSaveChecklistText = (itemId: string) => {
    if (editedChecklistItemText.trim() !== '') {
      onUpdateChecklistItemText(task.id, columnId, itemId, editedChecklistItemText.trim());
    }
    setEditingChecklistItemId(null);
    setEditedChecklistItemText('');
  };


  const getPriorityBadgeClass = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30';
      case 'medium': return 'bg-orange-500/20 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300 border-orange-500/30';
      case 'low': return 'bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300 border-gray-500/30';
    }
  };
  
  const completedChecklistItems = task.checklist?.filter(item => item.completed).length || 0;
  const totalChecklistItems = task.checklist?.length || 0;
  const checklistProgress = totalChecklistItems > 0 ? (completedChecklistItems / totalChecklistItems) * 100 : 0;

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status.toLowerCase() !== 'done';

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      className={cn("mb-3 p-3 shadow-md hover:shadow-lg transition-shadow duration-200 ease-in-out interactive-card-hover relative", dragOverColumn === columnId && "border-primary border-2" )}
    >
      <CardContent className="p-0 space-y-2">
        <div className="flex justify-between items-start">
          {isEditing ? (
            <Input
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onBlur={handleEditToggle}
              onKeyDown={(e) => e.key === 'Enter' && handleEditToggle()}
              className="text-sm font-medium flex-grow mr-2 h-8"
              autoFocus
            />
          ) : (
            <p className="text-sm font-medium cursor-pointer flex-grow mr-2" onClick={() => isBetaModeEnabled && setIsEditing(true)}>
              {task.content}
            </p>
          )}
          {isBetaModeEnabled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditToggle}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  {isEditing ? 'Save Title' : 'Edit Title'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                   <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Task
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}

        {isBetaModeEnabled && task.dependencies && task.dependencies.length > 0 && (
          <div className="mt-1">
            <span className="text-xs font-semibold text-muted-foreground">Depends on:</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {task.dependencies.map(depId => {
                const depTask = getTaskById(depId);
                return (
                  <Tooltip key={depId}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs border-dashed border-primary/50 text-primary/80 py-0.5 px-1.5">
                        <Link2 className="h-3 w-3 mr-1"/>
                        {depTask ? depTask.content.substring(0,15) + (depTask.content.length > 15 ? '...' : '') : depId.substring(0,5)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{depTask ? depTask.content : `Task ID: ${depId}`}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}


        {isBetaModeEnabled && task.checklist && task.checklist.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <Label className="text-xs font-medium flex items-center text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Checklist ({completedChecklistItems}/{totalChecklistItems})
            </Label>
            <Progress value={checklistProgress} className="h-1.5" />
            <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {task.checklist.map(item => (
                <li key={item.id} className="flex items-center group text-xs">
                  <Checkbox
                    id={`${task.id}-${item.id}`}
                    checked={item.completed}
                    onCheckedChange={() => onToggleChecklistItem(task.id, columnId, item.id)}
                    className="mr-2 h-3.5 w-3.5"
                  />
                  {editingChecklistItemId === item.id ? (
                     <Input 
                        type="text"
                        value={editedChecklistItemText}
                        onChange={(e) => setEditedChecklistItemText(e.target.value)}
                        onBlur={() => handleSaveChecklistText(item.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveChecklistText(item.id)}
                        className="h-6 text-xs flex-grow"
                        autoFocus
                     />
                  ): (
                    <label htmlFor={`${task.id}-${item.id}`} className={cn("flex-grow cursor-pointer", item.completed && "line-through text-muted-foreground/70")}>
                        {item.text}
                    </label>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => handleChecklistTextEdit(item.id, item.text)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onDeleteChecklistItem(task.id, columnId, item.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isBetaModeEnabled && (
            <div className="flex items-center gap-1 mt-1">
                <Input 
                    type="text" 
                    value={newChecklistItem} 
                    onChange={(e) => setNewChecklistItem(e.target.value)} 
                    placeholder="Add checklist item"
                    className="h-7 text-xs flex-grow"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItemInternal()}
                />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddChecklistItemInternal} disabled={!newChecklistItem.trim()}>
                    <PlusCircle className="h-4 w-4" />
                </Button>
            </div>
        )}


        <div className="flex flex-wrap gap-1.5 items-center pt-1.5">
          {task.priority && (
            <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5", getPriorityBadgeClass(task.priority))}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Badge>
          )}
          {task.deadline && (
             <Badge variant={isOverdue ? "destructive" : "outline"} className={cn("text-xs px-1.5 py-0.5", isOverdue ? "" : "border-blue-500/30 text-blue-700 dark:text-blue-300")}>
              <CalendarDays className="h-3 w-3 mr-1" />
              {format(parseISO(task.deadline), 'MMM d')}
              {isOverdue && " (Overdue)"}
            </Badge>
          )}
          {isBetaModeEnabled && task.tags && task.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs bg-purple-500/20 text-purple-700 dark:bg-purple-700/30 dark:text-purple-300 border-purple-500/30 px-1.5 py-0.5">
              <Tags className="h-3 w-3 mr-1"/>{tag}
            </Badge>
          ))}
        </div>
         {task.createdAt && (
          <p className="text-xs text-muted-foreground/80 pt-1">
            Created {formatDistanceToNow(parseISO(task.createdAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
       <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the task
            &quot;{task.content}&quot;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDeleteTask(task.id, columnId)}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </Card>
  );
}

export function KanbanBoard() {
  const { columns, addTask, moveTask, deleteTask, updateTask, addColumn, updateColumnTitle, deleteColumn, updateColumnWipLimit, addChecklistItem, toggleChecklistItem, deleteChecklistItem, updateChecklistItemText, getTaskById } = useTasks();
  const { isBetaModeEnabled } = useSettings();
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [currentEditingColumnTitle, setCurrentEditingColumnTitle] = useState('');

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [columnSortOptions, setColumnSortOptions] = useState<Record<string, SortOption>>({});


  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    if (typeof window !== 'undefined') {
      handleResize(); // Initial size
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id); // Necessary for Firefox
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
     e.currentTarget.style.opacity = '1';
     setDragOverColumn(null); // Clear drag over visual cue
     setDraggedTask(null);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId); // Set columnId to highlight
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the specific droppable area, not just children
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    setDragOverColumn(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const targetColumn = columns.find(col => col.id === targetColumnId);
    if (targetColumn && targetColumn.wipLimit && targetColumn.tasks.length >= targetColumn.wipLimit) {
        toast({
            title: "WIP Limit Reached",
            description: `Column "${targetColumn.title}" has reached its Work-In-Progress limit of ${targetColumn.wipLimit}.`,
            variant: "destructive",
        });
        setDragOverColumn(null);
        setDraggedTask(null);
        // Reset opacity if not done in dragEnd somehow (though it should be)
        const draggedElement = document.getElementById(draggedTask.id); // Assuming task cards have id=task.id
        if (draggedElement) draggedElement.style.opacity = '1';
        return;
    }


    const { task: movedTaskData, automated } = moveTask(draggedTask.id, draggedTask.status, targetColumnId, isBetaModeEnabled);
    
    if (movedTaskData) {
      toast({
        title: "Task Moved",
        description: `Task "${movedTaskData.content}" moved to "${columns.find(c => c.id === targetColumnId)?.title}".`,
      });

      if (automated) {
        toast({
            title: "Automation Applied",
            description: "Checklist items automatically marked as complete.",
            variant: "default",
        });
      }
    }


    setDraggedTask(null);
    setDragOverColumn(null);

    if (columns.find(c => c.id === targetColumnId)?.title.toLowerCase() === 'done') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  const handleAddTaskLocal = (taskData: Omit<Task, 'id' | 'status' | 'createdAt'>) => {
    const firstColumnId = columns.length > 0 ? columns[0].id : undefined;
    addTask(taskData, firstColumnId);
    setIsAddTaskDialogOpen(false);
    toast({
        title: "Task Added!",
        description: `Task "${taskData.content}" has been successfully added.`,
    });
  };

  const handleAddColumn = () => {
    if (newColumnTitle.trim()) {
      addColumn(newColumnTitle.trim());
      setNewColumnTitle('');
      toast({ title: "Column Added", description: `Column "${newColumnTitle.trim()}" created.`});
    }
  };
  
  const handleEditColumnTitle = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId);
    setCurrentEditingColumnTitle(currentTitle);
  };

  const handleSaveColumnTitle = (columnId: string) => {
    if (currentEditingColumnTitle.trim()) {
      updateColumnTitle(columnId, currentEditingColumnTitle.trim());
      toast({ title: "Column Updated", description: "Column title changed."});
    }
    setEditingColumnId(null);
    setCurrentEditingColumnTitle('');
  };

  const handleUpdateWipLimit = (columnId: string, limitStr: string) => {
    const limit = parseInt(limitStr, 10);
    if (!isNaN(limit) && limit >=0) {
        updateColumnWipLimit(columnId, limit);
        toast({ title: "WIP Limit Updated", description: `WIP limit for column set to ${limit === 0 ? 'None' : limit}.`});
    } else if (limitStr === "") {
        updateColumnWipLimit(columnId, undefined); // Clear WIP limit
        toast({ title: "WIP Limit Cleared", description: `WIP limit for column removed.`});
    } else {
        toast({ title: "Invalid WIP Limit", description: "Please enter a valid number for WIP limit.", variant: "destructive"});
    }
  };

 const handleColumnSortChange = (columnId: string, sortOption: SortOption) => {
    setColumnSortOptions(prev => ({ ...prev, [columnId]: sortOption }));
  };

  const sortedAndFilteredTasks = (tasks: Task[], columnId: string): Task[] => {
    let processedTasks = [...tasks];

    // Global Filters (Beta)
    if (isBetaModeEnabled) {
      if (priorityFilter !== 'all') {
        processedTasks = processedTasks.filter(task => task.priority === priorityFilter);
      }
      const activeTagFilters = tagFilter.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
      if (activeTagFilters.length > 0) {
        processedTasks = processedTasks.filter(task =>
          task.tags && task.tags.some(tag => activeTagFilters.includes(tag.toLowerCase()))
        );
      }
    }

    // Column Specific Sorting (Beta)
    const sortOption = columnSortOptions[columnId] || 'default';
    if (isBetaModeEnabled && sortOption !== 'default') {
      processedTasks.sort((a, b) => {
        if (sortOption === 'priority') {
          return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
        }
        if (sortOption === 'deadline') {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return compareAsc(parseISO(a.deadline), parseISO(b.deadline));
        }
        if (sortOption === 'title') {
          return a.content.localeCompare(b.content);
        }
        if (sortOption === 'createdAt') {
           return compareAsc(parseISO(a.createdAt), parseISO(b.createdAt));
        }
        return 0; // Default or unknown sort
      });
    }
    // Default sorting might be by creation or manual order if implemented
    return processedTasks;
  };


  return (
    <div className="p-4 space-y-6 animate-fadeInUp">
      {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500} 
          gravity={0.15} 
          tweenDuration={7000}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <AddTaskDialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen} onAddTask={handleAddTaskLocal}>
          <Button onClick={() => setIsAddTaskDialogOpen(true)} className="shadow-md hover:shadow-lg transition-shadow">
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </AddTaskDialog>
        
        {isBetaModeEnabled && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="shadow-sm hover:shadow-md transition-shadow">
                <Filter className="mr-2 h-4 w-4" /> Filters & Sort
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div>
                <Label htmlFor="priority-filter" className="text-sm font-medium">Filter by Priority</Label>
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                  <SelectTrigger id="priority-filter" className="mt-1">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tag-filter" className="text-sm font-medium">Filter by Tags (comma-sep)</Label>
                <Input 
                  id="tag-filter" 
                  value={tagFilter} 
                  onChange={(e) => setTagFilter(e.target.value)} 
                  placeholder="e.g. design, dev"
                  className="mt-1"
                />
              </div>
               <p className="text-xs text-muted-foreground">Note: Column-specific sorting is available in each column's options menu.</p>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <ScrollArea className="w-full pb-4">
         <div className="flex gap-4 items-start">
          {columns.map(column => {
            const displayTasks = sortedAndFilteredTasks(column.tasks, column.id);
            const wipLimitExceeded = column.wipLimit && column.tasks.length > column.wipLimit;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
                onDragLeave={handleDragLeave}
                className={cn("min-w-[300px] max-w-[350px] flex-shrink-0 bg-muted/30 dark:bg-neutral-800/50 rounded-lg shadow-lg transition-all duration-300 ease-in-out", dragOverColumn === column.id && "ring-2 ring-primary ring-offset-2 dark:ring-offset-neutral-900", wipLimitExceeded && "border-2 border-destructive/70" )}
              >
                <CardHeader className="p-3 border-b border-border/70 dark:border-neutral-700/70 flex flex-row justify-between items-center sticky top-0 bg-muted/50 dark:bg-neutral-800/70 backdrop-blur-sm z-10 rounded-t-lg">
                  {editingColumnId === column.id ? (
                     <Input 
                        value={currentEditingColumnTitle} 
                        onChange={(e) => setCurrentEditingColumnTitle(e.target.value)} 
                        onBlur={() => handleSaveColumnTitle(column.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveColumnTitle(column.id)}
                        className="text-base font-semibold h-8 flex-grow mr-2"
                        autoFocus
                     />
                  ) : (
                    <CardTitle 
                        className="text-base font-semibold cursor-pointer"
                        onClick={() => isBetaModeEnabled && handleEditColumnTitle(column.id, column.title)}
                    >
                        {column.title} ({column.tasks.length})
                        {isBetaModeEnabled && column.wipLimit && (
                            <span className={cn("text-xs ml-1.5", wipLimitExceeded ? "text-destructive font-bold" : "text-muted-foreground")}>
                                (WIP: {column.wipLimit})
                            </span>
                        )}
                    </CardTitle>
                  )}
                  {isBetaModeEnabled && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditColumnTitle(column.id, column.title)}>
                                <Edit2 className="mr-2 h-4 w-4" /> Rename Column
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Sort Tasks By
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => handleColumnSortChange(column.id, 'default')}>Default</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleColumnSortChange(column.id, 'priority')}>Priority</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleColumnSortChange(column.id, 'deadline')}>Deadline</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleColumnSortChange(column.id, 'title')}>Title</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleColumnSortChange(column.id, 'createdAt')}>Date Created</DropdownMenuItem>
                                </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                             <DropdownMenuSeparator />
                             <div className="p-2 space-y-1">
                                <Label htmlFor={`wip-${column.id}`} className="text-xs px-1">WIP Limit</Label>
                                <Input
                                    id={`wip-${column.id}`}
                                    type="number"
                                    min="0"
                                    placeholder="None"
                                    defaultValue={column.wipLimit}
                                    onChange={(e) => handleUpdateWipLimit(column.id, e.target.value)}
                                    className="h-8 text-sm"
                                />
                             </div>
                            <DropdownMenuSeparator />
                            <AlertDialogTrigger asChild>
                               <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Column
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete Column &quot;{column.title}&quot;?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete the column and all its tasks. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteColumn(column.id)} className={buttonVariants({variant: "destructive"})}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardHeader>
                <ScrollArea className="h-[calc(100vh-18rem)] p-1 rounded-b-lg"> {/* Adjusted height */}
                  <CardContent className="p-2 space-y-0"> {/* Removed default CardContent vertical padding, tasks handle their own margin */}
                  {wipLimitExceeded && (
                      <div className="p-2 mb-2 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2 shadow-sm">
                          <AlertTriangle className="h-4 w-4"/> WIP limit exceeded!
                      </div>
                  )}
                  {displayTasks.length === 0 && (
                     <div className="text-center py-10 text-sm text-muted-foreground">
                        Drag tasks here or add new ones.
                     </div>
                  )}
                  {displayTasks.map(task => (
                    <AlertDialog key={task.id}>
                       <TaskCard
                        task={task}
                        columnId={column.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onUpdateTask={updateTask}
                        onDeleteTask={deleteTask}
                        onAddChecklistItem={addChecklistItem}
                        onToggleChecklistItem={toggleChecklistItem}
                        onDeleteChecklistItem={deleteChecklistItem}
                        onUpdateChecklistItemText={updateChecklistItemText}
                        isBetaModeEnabled={isBetaModeEnabled}
                        getTaskById={getTaskById}
                        dragOverColumn={dragOverColumn}
                      />
                    </AlertDialog>
                  ))}
                  </CardContent>
                </ScrollArea>
              </div>
            );
          })}
           {isBetaModeEnabled && (
            <div className="min-w-[300px] flex-shrink-0 p-2">
              <Card className="bg-transparent border-dashed border-2 hover:border-primary/70 transition-colors duration-200">
                <CardContent className="p-3 flex flex-col items-center justify-center h-full">
                    <Input 
                        value={newColumnTitle}
                        onChange={(e) => setNewColumnTitle(e.target.value)}
                        placeholder="New column title"
                        className="mb-2 h-9 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                    />
                    <Button onClick={handleAddColumn} variant="outline" size="sm" className="w-full shadow-sm hover:shadow-md">
                        <Plus className="mr-2 h-4 w-4" /> Add Column
                    </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

    
