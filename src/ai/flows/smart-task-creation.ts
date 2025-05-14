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
import { SmartTaskCreationInputSchema, SmartTaskCreationOutputSchema } from '@/ai/schemas';

export type SmartTaskCreationInput = z.infer<typeof SmartTaskCreationInputSchema>;
export type SmartTaskCreationOutput = z.infer<typeof SmartTaskCreationOutputSchema>;

export async function smartTaskCreation(input: SmartTaskCreationInput): Promise<SmartTaskCreationOutput> {
  return smartTaskCreationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartTaskCreationPrompt',
  input: {
    schema: SmartTaskCreationInputSchema, // Use imported schema
  },
  output: {
    schema: SmartTaskCreationOutputSchema, // Use imported schema
  },
  prompt: `You are a task suggestion AI. You will suggest tasks based on the user's goals and current projects. The tasks should be actionable and relevant to the user's goals and current projects.

User Goals: {{{userGoals}}}
Current Projects: {{{currentProjects}}}

Suggested Tasks:`,
});

const smartTaskCreationFlow = ai.defineFlow<
  SmartTaskCreationInput,
  SmartTaskCreationOutput
>({
  name: 'smartTaskCreationFlow',
  inputSchema: SmartTaskCreationInputSchema, // Use imported schema
  outputSchema: SmartTaskCreationOutputSchema, // Use imported schema
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
