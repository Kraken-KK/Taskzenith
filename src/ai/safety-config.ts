// src/ai/safety-config.ts
import type { SafetySetting } from '@genkit-ai/googleai';

/**
 * Defines a set of safety settings suitable for AI models that should not generate images.
 * This configuration aims to block harmful content across various categories.
 * This can be used in `ai.definePrompt` or `ai.generate` calls.
 */
export function defineNoImageGenerationSafetyConfig(): SafetySetting[] {
  return [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    // CIVIC_INTEGRITY is not available in all models/versions, can be added if supported and needed.
    // {
    //   category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
    //   threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    // },
  ];
}
