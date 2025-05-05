'use server';

/**
 * @fileOverview AI-powered task prioritization flow.
 *
 * - prioritizeTasks - A function that prioritizes tasks based on deadlines, importance, and dependencies.
 * - PrioritizeTasksInput - The input type for the prioritizeTasks function.
 * - PrioritizeTasksOutput - The return type for the prioritizeTasks function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const PrioritizeTasksInputSchema = z.object({
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
export type PrioritizeTasksInput = z.infer<typeof PrioritizeTasksInputSchema>;

const PrioritizeTasksOutputSchema = z.object({
  prioritizedTasks: z.array(
    z.object({
      id: z.string().describe('The unique identifier of the task.'),
      priority: z.number().describe('The priority of the task (lower is higher priority).'),
      reason: z.string().describe('The reason for the assigned priority.'),
    })
  ).describe('The list of tasks with assigned priorities and reasons.'),
});
export type PrioritizeTasksOutput = z.infer<typeof PrioritizeTasksOutputSchema>;

export async function prioritizeTasks(input: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  return prioritizeTasksFlow(input);
}

const prioritizeTasksPrompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {
    schema: z.object({
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
    }),
  },
  output: {
    schema: z.object({
      prioritizedTasks: z.array(
        z.object({
          id: z.string().describe('The unique identifier of the task.'),
          priority: z.number().describe('The priority of the task (lower is higher priority).'),
          reason: z.string().describe('The reason for the assigned priority.'),
        })
      ).describe('The list of tasks with assigned priorities and reasons.'),
    }),
  },
  prompt: `You are an AI task prioritization expert. Given a list of tasks with their descriptions, deadlines, importance, and dependencies, you will assign a priority to each task and provide a reason for the assigned priority. Lower priority numbers indicate higher priority.

Tasks:
{{#each tasks}}
- ID: {{this.id}}
  Description: {{this.description}}
  Deadline: {{this.deadline}}
  Importance: {{this.importance}}
  Dependencies: {{this.dependencies}}
{{/each}}

Prioritized Tasks (JSON format):
`,
});

const prioritizeTasksFlow = ai.defineFlow<PrioritizeTasksInputSchema, PrioritizeTasksOutputSchema>(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksInputSchema,
    outputSchema: PrioritizeTasksOutputSchema,
  },
  async input => {
    const {output} = await prioritizeTasksPrompt(input);
    return output!;
  }
);
