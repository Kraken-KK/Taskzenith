'use server';

/**
 * @fileOverview An AI agent for smart task creation based on user goals and projects.
 *
 * - smartTaskCreation - A function that suggests tasks based on user goals and current projects.
 * - SmartTaskCreationInput - The input type for the smartTaskCreation function.
 * - SmartTaskCreationOutput - The return type for the smartTaskCreation function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SmartTaskCreationInputSchema = z.object({
  userGoals: z
    .string()
    .describe('The user goals for which tasks need to be created.'),
  currentProjects: z
    .string()
    .describe('The current projects the user is working on.'),
});
export type SmartTaskCreationInput = z.infer<typeof SmartTaskCreationInputSchema>;

const SmartTaskCreationOutputSchema = z.object({
  suggestedTasks: z
    .array(z.string())
    .describe('An array of suggested tasks based on the user goals and current projects.'),
});
export type SmartTaskCreationOutput = z.infer<typeof SmartTaskCreationOutputSchema>;

export async function smartTaskCreation(input: SmartTaskCreationInput): Promise<SmartTaskCreationOutput> {
  return smartTaskCreationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartTaskCreationPrompt',
  input: {
    schema: z.object({
      userGoals: z
        .string()
        .describe('The user goals for which tasks need to be created.'),
      currentProjects: z
        .string()
        .describe('The current projects the user is working on.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedTasks: z
        .array(z.string())
        .describe('An array of suggested tasks based on the user goals and current projects.'),
    }),
  },
  prompt: `You are a task suggestion AI. You will suggest tasks based on the user's goals and current projects. The tasks should be actionable and relevant to the user's goals and current projects.

User Goals: {{{userGoals}}}
Current Projects: {{{currentProjects}}}

Suggested Tasks:`,
});

const smartTaskCreationFlow = ai.defineFlow<
  typeof SmartTaskCreationInputSchema,
  typeof SmartTaskCreationOutputSchema
>({
  name: 'smartTaskCreationFlow',
  inputSchema: SmartTaskCreationInputSchema,
  outputSchema: SmartTaskCreationOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
