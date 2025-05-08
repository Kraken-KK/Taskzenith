'use server';
/**
 * @fileOverview A basic chat flow for the AI Assistant with conversation history.
 *
 * - chatWithAI - A function that takes a user query and conversation history, returns an AI response.
 * - ChatInput - The input type for the chatWithAI function.
 * - ChatOutput - The return type for the chatWithAI function.
 * - MessageHistoryItem - The type for individual messages in the history.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']).describe("The role of the message sender, either 'user' or 'model' (for AI)."),
  parts: z.array(z.object({ text: z.string() })).describe("The content parts of the message. We primarily use one text part."),
});
export type MessageHistoryItem = z.infer<typeof MessageSchema>;

const ChatInputSchema = z.object({
  query: z.string().describe("The user's current message or question to the AI assistant."),
  history: z.array(MessageSchema).optional().describe('The conversation history up to this point. Each item has a role ("user" or "model") and parts (the message text).'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe("The AI assistant's response to the user query."),
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
Pay close attention to the conversation history provided. Use it to understand the context, remember information the user has shared previously, and tailor your responses accordingly. Avoid asking for information that has already been provided in the history.

Conversation History:
{{#if history}}
{{#each history}}
{{#if (eq this.role "user")}}User: {{this.parts.0.text}}
{{else}}Jack: {{this.parts.0.text}}
{{/if}}
{{/each}}
{{else}}
No previous conversation history. This is the start of your conversation.
{{/if}}

Current User Query: {{{query}}}

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

