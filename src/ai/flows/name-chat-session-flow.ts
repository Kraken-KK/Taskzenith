
'use server';
/**
 * @fileOverview An AI flow to generate a concise name for a chat session based on its initial messages.
 *
 * - nameChatSession - A function that takes a preview of messages and returns a suggested session name.
 * - NameChatSessionInput - The input type for the nameChatSession function.
 * - NameChatSessionOutput - The return type for the nameChatSession function.
 */

import { ai } from '@/ai/ai-instance';
import { NameChatSessionInputSchema, NameChatSessionOutputSchema } from '@/ai/schemas'; // Import specific schemas
import { z } from 'genkit';

export type NameChatSessionInput = z.infer<typeof NameChatSessionInputSchema>;
export type NameChatSessionOutput = z.infer<typeof NameChatSessionOutputSchema>;

export async function nameChatSession(input: NameChatSessionInput): Promise<NameChatSessionOutput> {
  return nameChatSessionFlow(input);
}

const nameChatSessionPrompt = ai.definePrompt({
  name: 'nameChatSessionPrompt',
  input: { schema: NameChatSessionInputSchema }, // Use imported schema
  output: { schema: NameChatSessionOutputSchema }, // Use imported schema
  prompt: `Based on the following initial messages from a chat session, generate a concise and descriptive name for the session (maximum 5 words).
Focus on the main topic or the user's primary query.

Messages Preview:
{{#each messagesPreview}}
{{this.role}}: {{this.parts.0.text}}
{{/each}}

Session Name:
`,
});

const nameChatSessionFlow = ai.defineFlow<NameChatSessionInput, NameChatSessionOutput>(
  {
    name: 'nameChatSessionFlow',
    inputSchema: NameChatSessionInputSchema, // Use imported schema
    outputSchema: NameChatSessionOutputSchema, // Use imported schema
  },
  async (input) => {
    if (!input.messagesPreview || input.messagesPreview.length === 0) {
        return { sessionName: "Chat Session" }; // Fallback name
    }
    const {output} = await nameChatSessionPrompt(input);
    return output || { sessionName: "Chat Session" }; // Fallback if output is null/undefined
  }
);
