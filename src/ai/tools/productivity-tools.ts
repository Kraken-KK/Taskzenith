
'use server';
/**
 * @fileOverview Productivity-related tools for the AI Assistant.
 *
 * - getTaskCompletionPercentageTool - Calculates the percentage of completed tasks for a board.
 * - summarizeTasksByStatusTool - Summarizes tasks based on their status (column).
 * - compareTaskProgressTool - Compares task progress over different periods (not fully implemented).
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Schema for tasks provided to tools
const ToolTaskSchema = z.object({
  id: z.string().describe("Unique ID of the task."),
  content: z.string().describe("The main content or title of the task."),
  statusTitle: z.string().describe("The current status (column name) of the task."),
  isCompleted: z.boolean().optional().describe("Whether the task is considered complete (e.g., in a 'Done' column)."),
});

// --- Get Task Completion Percentage Tool ---
const GetTaskCompletionPercentageInputSchema = z.object({
  boardName: z.string().describe("The name of the board for which to calculate completion percentage."),
  tasks: z.array(ToolTaskSchema).describe("List of all tasks on the board."),
  completionColumnNames: z.array(z.string()).optional().describe("List of column names that signify task completion (e.g., ['Done', 'Closed']). If not provided, uses a default 'Done'."),
});

const GetTaskCompletionPercentageOutputSchema = z.object({
  boardName: z.string(),
  totalTasks: z.number(),
  completedTasks: z.number(),
  completionPercentage: z.number().describe("Percentage of tasks completed (0-100)."),
  message: z.string().describe("A human-readable message summarizing the completion status."),
});

export const getTaskCompletionPercentageTool = ai.defineTool(
  {
    name: 'getTaskCompletionPercentageTool',
    description: "Calculates the percentage of completed tasks on a given Kanban board. Considers tasks in columns like 'Done' as completed.",
    inputSchema: GetTaskCompletionPercentageInputSchema,
    outputSchema: GetTaskCompletionPercentageOutputSchema,
  },
  async (input) => {
    // Placeholder implementation
    const totalTasks = input.tasks.length;
    const completionCols = input.completionColumnNames || ['Done', 'Complete', 'Resolved'];
    const completedTasks = input.tasks.filter(task => 
        completionCols.some(compCol => task.statusTitle.toLowerCase() === compCol.toLowerCase()) || task.isCompleted
    ).length;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      boardName: input.boardName,
      totalTasks,
      completedTasks,
      completionPercentage: parseFloat(completionPercentage.toFixed(1)),
      message: `On the board "${input.boardName}", ${completedTasks} out of ${totalTasks} tasks are complete (${completionPercentage.toFixed(1)}%).`,
    };
  }
);

// --- Summarize Tasks By Status Tool ---
const SummarizeTasksByStatusInputSchema = z.object({
  boardName: z.string().describe("The name of the board."),
  tasks: z.array(ToolTaskSchema).describe("List of tasks on the board."),
});

const SummarizeTasksByStatusOutputSchema = z.object({
  boardName: z.string(),
  statusSummary: z.array(z.object({
    statusTitle: z.string(),
    taskCount: z.number(),
    tasks: z.array(z.object({ id: z.string(), content: z.string() })).optional().describe("Brief list of tasks in this status (optional, up to 3)."),
  })).describe("Summary of tasks grouped by their status."),
  message: z.string().describe("A human-readable summary message."),
});

export const summarizeTasksByStatusTool = ai.defineTool(
  {
    name: 'summarizeTasksByStatusTool',
    description: "Summarizes the tasks on a Kanban board by their current status (column), providing counts for each status.",
    inputSchema: SummarizeTasksByStatusInputSchema,
    outputSchema: SummarizeTasksByStatusOutputSchema,
  },
  async (input) => {
    // Placeholder implementation
    const summary: Record<string, { taskCount: number, tasks: {id: string, content: string}[] }> = {};
    input.tasks.forEach(task => {
      if (!summary[task.statusTitle]) {
        summary[task.statusTitle] = { taskCount: 0, tasks: [] };
      }
      summary[task.statusTitle].taskCount++;
      if (summary[task.statusTitle].tasks.length < 3) {
        summary[task.statusTitle].tasks.push({ id: task.id, content: task.content });
      }
    });

    const statusSummary = Object.entries(summary).map(([statusTitle, data]) => ({
      statusTitle,
      taskCount: data.taskCount,
      tasks: data.tasks
    }));
    
    const messageParts = statusSummary.map(s => `${s.taskCount} task(s) in "${s.statusTitle}"`);
    return {
      boardName: input.boardName,
      statusSummary,
      message: `For board "${input.boardName}": ${messageParts.join(', ')}.`,
    };
  }
);

// --- Compare Task Progress Tool ---
const CompareTaskProgressInputSchema = z.object({
  boardName: z.string().describe("The name of the board."),
  currentTasks: z.array(ToolTaskSchema).describe("List of current tasks on the board."),
  // Historical data would be needed for a real comparison.
  // For a placeholder, we'll just use current data.
  comparisonPeriod: z.enum(['lastWeek', 'lastMonth']).optional().describe("Period to compare against. (Note: This is a placeholder, tool does not actually use historical data yet)."),
});

const CompareTaskProgressOutputSchema = z.object({
  boardName: z.string(),
  comparisonMessage: z.string().describe("A message summarizing the progress comparison."),
  // More detailed fields could be added here, like tasks completed, tasks added, etc.
});

export const compareTaskProgressTool = ai.defineTool(
  {
    name: 'compareTaskProgressTool',
    description: "Provides a comparison of task progress, e.g., current week vs. last week. (Note: Currently provides a placeholder summary based on current data).",
    inputSchema: CompareTaskProgressInputSchema,
    outputSchema: CompareTaskProgressOutputSchema,
  },
  async (input) => {
    // Placeholder - real implementation would need historical data
    const totalTasks = input.currentTasks.length;
    const completedTasks = input.currentTasks.filter(task => task.isCompleted || task.statusTitle.toLowerCase() === 'done').length;
    
    let comparisonMessage = `Currently, on board "${input.boardName}", there are ${totalTasks} tasks, with ${completedTasks} marked as complete.`;
    if (input.comparisonPeriod) {
        comparisonMessage += ` Comparison with ${input.comparisonPeriod} is not yet fully implemented, but this is the current snapshot.`
    }

    return {
      boardName: input.boardName,
      comparisonMessage,
    };
  }
);
