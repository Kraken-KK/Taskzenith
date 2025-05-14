// src/ai/schemas.ts
import { z } from 'genkit';

/**
 * Defines the structure for a single message in a conversation history.
 * This schema is used by multiple AI flows.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'model']).describe("The role of the message sender, either 'user' or 'model' (for AI)."),
  parts: z.array(z.object({ text: z.string() })).describe("The content parts of the message. We primarily use one text part."),
});

// Schemas for chat-flow.ts
export const BoardContextTaskSchema = z.object({
  id: z.string().describe("Unique ID of the task."),
  content: z.string().describe("The main content or title of the task."),
  statusTitle: z.string().describe("The current status (column name) of the task."),
  priority: z.enum(['high', 'medium', 'low']).optional().describe("Priority of the task."),
  deadline: z.string().optional().describe("Deadline of the task (ISO string format)."),
});

export const UserPreferencesSchema = z.object({
  interactionStyle: z.enum(['concise', 'detailed', 'friendly', 'formal']).optional().describe("User's preferred interaction style for Jack."),
});

export const ChatInputSchema = z.object({
  query: z.string().describe("The user's current message or question to the AI assistant."),
  history: z.array(MessageSchema).optional().describe('The conversation history up to this point.'),
  activeBoardContext: z.object({
    boardName: z.string().optional().describe("Name of the currently active board."),
    tasks: z.array(BoardContextTaskSchema).optional().describe("List of tasks on the active board."),
    columnNames: z.array(z.string()).optional().describe("List of column names (status titles) on the active board."),
  }).optional().describe("Context from the user's active Kanban board."),
  userPreferences: UserPreferencesSchema.optional().describe("User's personalization preferences for Jack."),
});

export const TaskActionSchema = z.object({
  type: z.enum(['updateStatus', 'updatePriority', 'createTask', 'deleteTask', 'setDeadline', 'assignTask']).describe("Type of task action to perform."),
  taskIdentifier: z.string().optional().describe("The content/name or ID of the task to update/delete/assign. Not needed for createTask."),
  targetValue: z.string().optional().describe("For 'updateStatus', target column. For 'updatePriority', priority value. For 'setDeadline', ISO date. For 'assignTask', user ID/name."),
  taskDetails: z.object({ 
    content: z.string().describe("Content of the new task."),
    status: z.string().optional().describe("Initial status/column for the new task."),
    priority: z.enum(['high', 'medium', 'low']).optional().describe("Priority for the new task."),
    deadline: z.string().optional().describe("Deadline for the new task (ISO string)."),
  }).optional().describe("Details for creating a new task."),
}).describe("An action to be performed on a task, identified by the AI.");

export const PreferenceUpdateSchema = z.object({
  type: z.enum(['interactionStyle']).describe("Type of preference to update."),
  styleValue: z.enum(['concise', 'detailed', 'friendly', 'formal']).optional().describe("The new interaction style value."),
}).describe("An update to user preferences, identified by the AI.");

export const ToolCallRequestSchema = z.object({
  name: z.string().describe("The name of the tool to be called."),
  args: z.record(z.any()).optional().describe("The arguments for the tool call."),
});

export const ChatOutputSchema = z.object({
  response: z.string().describe("The AI assistant's textual response to the user query."),
  taskAction: TaskActionSchema.optional().describe("If the AI identified a task update request, this object contains the details for the client to execute."),
  preferenceUpdate: PreferenceUpdateSchema.optional().describe("If the AI identified a preference update request, this object contains the details."),
  toolCalls: z.array(ToolCallRequestSchema).optional().describe("List of tool calls requested by the AI."),
});


// Schemas for ai-powered-task-prioritization.ts
export const PrioritizeTasksInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().describe('The unique identifier of the task.'),
      description: z.string().describe('The description of the task.'),
      deadline: z.string().describe('The deadline of the task (ISO format).'),
      importance: z
        .enum(['high', 'medium', 'low'])
        .describe('The importance of the task.'),
      dependencies: z
        .array(z.string())
        .describe('The list of task IDs that this task depends on.'),
    })
  ).describe('The list of tasks to prioritize.'),
});

export const PrioritizeTasksOutputSchema = z.object({
  prioritizedTasks: z.array(
    z.object({
      id: z.string().describe('The unique identifier of the task.'),
      priority: z.number().describe('The priority of the task (lower is higher priority).'),
      reason: z.string().describe('The reason for the assigned priority.'),
    })
  ).describe('The list of tasks with assigned priorities and reasons.'),
});

// Schemas for smart-task-creation.ts
export const SmartTaskCreationInputSchema = z.object({
  userGoals: z
    .string()
    .describe('The user goals for which tasks need to be created.'),
  currentProjects: z
    .string()
    .describe('The current projects the user is working on.'),
});

export const SmartTaskCreationOutputSchema = z.object({
  suggestedTasks: z
    .array(z.string())
    .describe('An array of suggested tasks based on the user goals and current projects.'),
});

// Schemas for name-chat-session-flow.ts
// MessageSchema is already defined above and used by NameChatSessionInputSchema
export const NameChatSessionInputSchema = z.object({
  messagesPreview: z.array(MessageSchema).min(1).max(6)
    .describe('A preview of the initial messages in the chat session (1 to 6 messages).'),
});

export const NameChatSessionOutputSchema = z.object({
  sessionName: z.string().describe('A concise and descriptive name for the chat session (max 5 words).'),
});