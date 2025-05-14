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
import { PrioritizeTasksInputSchema, PrioritizeTasksOutputSchema } from '@/ai/schemas';

export type PrioritizeTasksInput = z.infer<typeof PrioritizeTasksInputSchema>;
export type PrioritizeTasksOutput = z.infer<typeof PrioritizeTasksOutputSchema>;

export async function prioritizeTasks(input: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  return prioritizeTasksFlow(input);
}

const prioritizeTasksPrompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {
    schema: PrioritizeTasksInputSchema, // Use imported schema
  },
  output: {
    schema: PrioritizeTasksOutputSchema, // Use imported schema
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

const prioritizeTasksFlow = ai.defineFlow<PrioritizeTasksInput, PrioritizeTasksOutput>(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksInputSchema, // Use imported schema
    outputSchema: PrioritizeTasksOutputSchema, // Use imported schema
  },
  async input => {
    const {output} = await prioritizeTasksPrompt(input);
    return output!;
  }
);
