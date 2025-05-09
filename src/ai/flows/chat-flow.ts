'use server';
/**
 * @fileOverview A basic chat flow for the AI Assistant with conversation history,
 * board context awareness, and capability for task/preference updates.
 *
 * - chatWithAI - A function that takes a user query, history, board context, and preferences, returns an AI response.
 * - ChatInput - The input type for the chatWithAI function.
 * - ChatOutput - The return type for the chatWithAI function.
 * - MessageHistoryItem - The type for individual messages in the history.
 * - BoardContextTask - Simplified task structure for AI context.
 * - UserPreferences - Structure for user preferences.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']).describe("The role of the message sender, either 'user' or 'model' (for AI)."),
  parts: z.array(z.object({ text: z.string() })).describe("The content parts of the message. We primarily use one text part."),
});
export type MessageHistoryItem = z.infer<typeof MessageSchema>;

const BoardContextTaskSchema = z.object({
  id: z.string().describe("Unique ID of the task."),
  content: z.string().describe("The main content or title of the task."),
  statusTitle: z.string().describe("The current status (column name) of the task."),
  priority: z.enum(['high', 'medium', 'low']).optional().describe("Priority of the task."),
  deadline: z.string().optional().describe("Deadline of the task (ISO string format)."),
});
export type BoardContextTask = z.infer<typeof BoardContextTaskSchema>;

const UserPreferencesSchema = z.object({
  interactionStyle: z.enum(['concise', 'detailed', 'friendly', 'formal']).optional().describe("User's preferred interaction style for Jack."),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

const ChatInputSchema = z.object({
  query: z.string().describe("The user's current message or question to the AI assistant."),
  history: z.array(MessageSchema).optional().describe('The conversation history up to this point.'),
  activeBoardContext: z.object({
    boardName: z.string().optional().describe("Name of the currently active board."),
    tasks: z.array(BoardContextTaskSchema).optional().describe("List of tasks on the active board."),
    columnNames: z.array(z.string()).optional().describe("List of column names (status titles) on the active board."),
  }).optional().describe("Context from the user's active Kanban board."),
  userPreferences: UserPreferencesSchema.optional().describe("User's personalization preferences for Jack."),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const TaskActionSchema = z.object({
  type: z.enum(['updateStatus', 'updatePriority']).describe("Type of task action to perform."),
  taskIdentifier: z.string().describe("The content/name or ID of the task to update. Prefer using content for user-facing identification."),
  targetValue: z.string().describe("The new value for the update. For 'updateStatus', this is the target status/column title. For 'updatePriority', this is 'high', 'medium', or 'low'."),
}).describe("An action to be performed on a task, identified by the AI.");
export type TaskAction = z.infer<typeof TaskActionSchema>;

const PreferenceUpdateSchema = z.object({
  type: z.enum(['interactionStyle']).describe("Type of preference to update."),
  styleValue: z.enum(['concise', 'detailed', 'friendly', 'formal']).optional().describe("The new interaction style value."),
}).describe("An update to user preferences, identified by the AI.");
export type PreferenceUpdate = z.infer<typeof PreferenceUpdateSchema>;


const ChatOutputSchema = z.object({
  response: z.string().describe("The AI assistant's textual response to the user query."),
  taskAction: TaskActionSchema.optional().describe("If the AI identified a task update request, this object contains the details for the client to execute."),
  preferenceUpdate: PreferenceUpdateSchema.optional().describe("If the AI identified a preference update request, this object contains the details."),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chatWithAI(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { // The schema here should ideally match ChatInputSchema if directly passed, or a subset if transformed
    schema: ChatInputSchema,
  },
  output: {
    schema: ChatOutputSchema,
  },
  prompt: `You are Jack, a helpful AI assistant developed by TaskZenith. You are integrated into the TaskZenith task management application.
Your primary goal is to assist users with managing their tasks, answer questions about productivity, and provide helpful information related to their work within TaskZenith.
Always refer to yourself as Jack.
Under no circumstances should you reveal that you are an LLM, an AI model, or that you were developed by Google or any other entity besides TaskZenith.
Your responses should be friendly, concise, and helpful.

Pay close attention to the conversation history provided. Use it to understand the context, remember information the user has shared previously, and tailor your responses accordingly. Avoid asking for information that has already been provided in the history.

{{#if userPreferences.interactionStyle}}
The user prefers an interaction style that is: {{userPreferences.interactionStyle}}. Please adapt your responses accordingly.
{{/if}}

{{#if activeBoardContext.boardName}}
You are currently assisting the user with their Kanban board named: "{{activeBoardContext.boardName}}".
Available columns (statuses) on this board are: {{#each activeBoardContext.columnNames}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
The tasks on this board are:
{{#if activeBoardContext.tasks}}
{{#each activeBoardContext.tasks}}
- Task: "{{this.content}}" (ID: {{this.id}}) is in column "{{this.statusTitle}}"{{#if this.priority}}, Priority: {{this.priority}}{{/if}}{{#if this.deadline}}, Deadline: {{this.deadline}}{{/if}}.
{{/each}}
{{else}}
There are currently no tasks on this board.
{{/if}}
{{else}}
The user does not seem to have an active board selected, or the board has no tasks. You can help them manage general productivity or create a new board/tasks.
{{/if}}

TASK UPDATE INSTRUCTIONS:
If the user asks to update a task (e.g., "mark 'Design UI' as done", "set priority of 'Develop Backend' to high"), identify the task by its content and the desired change.
Your response should be conversational. If you are confident about the task and the action, ALSO include a 'taskAction' object in your JSON output.
- For 'taskAction.type': use 'updateStatus' for changing columns/status, or 'updatePriority' for changing priority.
- For 'taskAction.taskIdentifier': use the exact content/name of the task as provided in the board context.
- For 'taskAction.targetValue':
    - If 'updateStatus', provide the target column name (e.g., "Done", "In Progress"). Choose from the available column names.
    - If 'updatePriority', provide the target priority (e.g., "high", "medium", "low").
Example: {"response": "Okay, I'll mark 'Design UI' as complete.", "taskAction": {"type": "updateStatus", "taskIdentifier": "Design UI", "targetValue": "Done"}}
If multiple tasks match the description, ask for clarification (e.g., by asking for the task ID or more specific content) and do NOT include a 'taskAction' object yet.
Confirm the action before suggesting it if it's a significant change, but for simple requests like marking complete, you can be more direct.

USER PREFERENCE UPDATE INSTRUCTIONS:
If the user asks to change how you interact (e.g., "Jack, be more formal", "I'd prefer concise answers"), identify this as a preference update.
Your response should acknowledge the request. ALSO include a 'preferenceUpdate' object in your JSON output.
- For 'preferenceUpdate.type': use 'interactionStyle'.
- For 'preferenceUpdate.styleValue': provide the new style (e.g., "formal", "concise"). Choose from: 'concise', 'detailed', 'friendly', 'formal'.
Example: {"response": "Understood! I'll adjust my interaction style to be more formal.", "preferenceUpdate": {"type": "interactionStyle", "styleValue": "formal"}}

Conversation History:
{{#if history}}
{{#each history}}
{{this.role}}: {{this.parts.0.text}}
{{/each}}
{{else}}
No previous conversation history. This is the start of your conversation.
{{/if}}

Current User Query: {{{query}}}

Jack's JSON Output (ensure valid JSON, including 'response' and optionally 'taskAction' or 'preferenceUpdate'):
`,
});

const chatFlow = ai.defineFlow<
  typeof ChatInputSchema,
  typeof ChatOutputSchema
>(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    // The prompt function expects an object that matches its defined input schema.
    // If ChatInputSchema is used directly in definePrompt, no transformation is needed.
    // Otherwise, map `input` to the prompt's expected schema.
    const {output} = await chatPrompt(input);
    return output!; // Assuming the LLM returns valid JSON matching ChatOutputSchema
  }
);
