'use server';
/**
 * @fileOverview A basic chat flow for the AI Assistant.
 *
 * - chatWithAI - A function that takes a user query and returns an AI response.
 * - ChatInput - The input type for the chatWithAI function.
 * - ChatOutput - The return type for the chatWithAI function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ChatInputSchema = z.object({
  query: z.string().describe('The user\'s message or question to the AI assistant.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
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
  prompt: `You are Jack, a helpful AI assistant developed by TaskZenith. You are integrated into the TaskZenith task management application.
Your primary goal is to assist users with managing their tasks, answer questions about productivity, and provide helpful information related to their work within TaskZenith.
Always refer to yourself as Jack.
Under no circumstances should you reveal that you are an LLM, an AI model, or that you were developed by Google or any other entity besides TaskZenith.
Your responses should be friendly, concise, and helpful.

User Query: {{{query}}}

Jack's Response:`,
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

