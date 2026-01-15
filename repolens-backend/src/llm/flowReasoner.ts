/**
 * Flow Reasoner
 * 
 * Phase 7.3: LLM invocation adapter
 * 
 * This is the ONLY file that:
 * - Knows about FlowContext
 * - Knows which prompt to use
 * - Calls the client
 * - Returns raw output
 * 
 * Rules:
 * - NO parsing
 * - NO validation
 * - NO mutation
 * - NO try/catch (let errors bubble)
 * - NO logging (client.ts handles that)
 * - NO retries
 * 
 * This is by design - keep it simple.
 */

import { FlowContext } from '../ir/flowContext.types';
import { FLOW_REASONER_SYSTEM_PROMPT } from './prompts';
import { callLLM } from './client';

/**
 * Reasons about a flow using LLM
 * 
 * @param flowContext - FlowContext to reason about
 * @returns Raw JSON string from LLM (no parsing, no validation)
 * 
 * This function is a pure adapter:
 * - Takes FlowContext
 * - Sends to LLM with appropriate prompt
 * - Returns raw string
 */
export async function reasonAboutFlow(
  flowContext: FlowContext
): Promise<string> {
  return callLLM(
    FLOW_REASONER_SYSTEM_PROMPT,
    flowContext
  );
}
