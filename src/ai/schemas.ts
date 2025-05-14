// src/ai/schemas.ts
import { z } from 'genkit';

/**
 * Defines the structure for a single message in a conversation history.
 * This schema is used by multiple AI flows.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'model']).describe("The role of the message sender, either 'user' or 'model' (for AI)."),
  parts: z.array(z.object({ text: z.string() })).describe("The content parts of the message. We primarily use one text part."),
});

// You can also export the inferred type if needed directly from here
// export type MessageHistoryItem = z.infer<typeof MessageSchema>;
