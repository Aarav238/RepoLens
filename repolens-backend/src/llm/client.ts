/**
 * LLM Client
 * 
 * Phase 7.3: Raw LLM client (NO LOGIC)
 * 
 * Responsibilities:
 * - Knows how to talk to OpenAI (or any LLM)
 * - Knows nothing about flows
 * - Knows nothing about RepoLens
 * 
 * This is a network adapter, nothing more.
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Ensure dotenv is loaded (in case this module is imported before server.ts)
dotenv.config();

// Validate API key is present
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  logger.warn('OPENAI_API_KEY not found in environment variables');
}

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: apiKey || '',
});

/**
 * Calls the LLM with system and user prompts
 * 
 * @param systemPrompt - System prompt defining LLM role and behavior
 * @param userPrompt - User prompt (will be JSON.stringify'd)
 * @returns Raw string response from LLM
 * 
 * Important choices (LOCKED):
 * - temperature: 0.2 → stable reasoning
 * - User prompt is JSON.stringify(context) → no ambiguity
 * - Return string only (no parsing, no validation)
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: object
): Promise<string> {
  // Validate API key before making request
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY is not set in environment variables. Please add it to your .env file.');
  }

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPrompt, null, 2) }
      ],
      temperature: 0.2, // Stable reasoning
      response_format: { type: 'json_object' } // Force JSON output
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  } catch (error) {
    logger.error('LLM call failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
