'use server';
/**
 * @fileOverview A basic chat flow for the AI Assistant.
 *
 * - chatWithAI - A function that takes a user query and returns an AI response.
 * - ChatInputSchema - The input type for the chatWithAI function.
 * - ChatOutputSchema - The return type for the chatWithAI function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

export const ChatInputSchema = z.object({
  query: z.string().describe('The user\'s message or question to the AI assistant.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatOutputSchema = z.object({
  response: z.string().describe('The AI assistant\'s response to the user query.'),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chatWithAI(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: {
    schema: ChatInputSchema,
  },
  output: {
    schema: ChatOutputSchema,
  },
  prompt: `You are a helpful AI assistant integrated into a task management application called TaskZenith.
Your goal is to assist users with managing their tasks, answering questions about productivity, and providing helpful information related to their work.
Keep your responses concise and helpful.

User Query: {{{query}}}

AI Response:`,
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
  async input => {
    const {output} = await chatPrompt(input);
    // Directly return the output as the schema matches ChatOutputSchema
    return output!;
  }
);
