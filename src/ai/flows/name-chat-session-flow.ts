
'use server';
/**
 * @fileOverview An AI flow to generate a concise name for a chat session based on its initial messages.
 *
 * - nameChatSession - A function that takes a preview of messages and returns a suggested session name.
 * - NameChatSessionInput - The input type for the nameChatSession function.
 * - NameChatSessionOutput - The return type for the nameChatSession function.
 */

import { ai } from '@/ai/ai-instance';
import { MessageSchema as MessageHistoryItemSchema } from '@/ai/schemas';
import { z } from 'genkit';

const NameChatSessionInputSchema = z.object({
  messagesPreview: z.array(MessageHistoryItemSchema).min(1).max(6)
    .describe('A preview of the initial messages in the chat session (1 to 6 messages).'),
});
export type NameChatSessionInput = z.infer<typeof NameChatSessionInputSchema>;

const NameChatSessionOutputSchema = z.object({
  sessionName: z.string().describe('A concise and descriptive name for the chat session (max 5 words).'),
});
export type NameChatSessionOutput = z.infer<typeof NameChatSessionOutputSchema>;

export async function nameChatSession(input: NameChatSessionInput): Promise<NameChatSessionOutput> {
  return nameChatSessionFlow(input);
}

const nameChatSessionPrompt = ai.definePrompt({
  name: 'nameChatSessionPrompt',
  input: { schema: NameChatSessionInputSchema },
  output: { schema: NameChatSessionOutputSchema },
  prompt: `Based on the following initial messages from a chat session, generate a concise and descriptive name for the session (maximum 5 words).
Focus on the main topic or the user's primary query.

Messages Preview:
{{#each messagesPreview}}
{{this.role}}: {{this.parts.0.text}}
{{/each}}

Session Name:
`,
});

const nameChatSessionFlow = ai.defineFlow(
  {
    name: 'nameChatSessionFlow',
    inputSchema: NameChatSessionInputSchema,
    outputSchema: NameChatSessionOutputSchema,
  },
  async (input) => {
    if (!input.messagesPreview || input.messagesPreview.length === 0) {
        return { sessionName: "Chat Session" }; // Fallback name
    }
    const {output} = await nameChatSessionPrompt(input);
    return output || { sessionName: "Chat Session" }; // Fallback if output is null/undefined
  }
);
