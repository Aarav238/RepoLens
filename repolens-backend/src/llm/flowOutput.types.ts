/**
 * Flow Output Types
 * 
 * Phase 7.2: Output JSON contract (LOCKED)
 * 
 * These types define the exact structure that the LLM must return.
 * Any deviation is considered invalid and will be rejected.
 */

/**
 * Ordered Step
 * 
 * Represents a single step in the ordered flow execution.
 * All fields are required and must match the Phase 7.2 contract.
 */
export interface OrderedStep {
  order: number;              // Starts at 1, increments by 1
  from: string;               // Must exist in FlowContext.services
  to: string;                 // Must exist in FlowContext.services OR FlowContext.externals
  type: 'call' | 'external' | 'event';  // Must match original step type
  description: string;        // Non-empty, human-readable intent
  async: boolean;             // true only for explicit async patterns
}

/**
 * Ordered Flow Result
 * 
 * The validated output from LLM reasoning.
 * This is what gets attached to the IR in Phase 7.5.
 */
export interface OrderedFlowResult {
  orderedSteps: OrderedStep[];
  summary: string;            // Human-readable flow explanation
}

/**
 * Validation Result
 * 
 * Result of validating LLM output.
 * 
 * - ok: true → result contains valid OrderedFlowResult
 * - ok: false → result is null, error explains why
 * 
 * This ensures we NEVER throw - always return a safe result.
 */
export interface ValidationResult {
  ok: boolean;
  result: OrderedFlowResult | null;
  error?: string;            // Human-readable error if validation failed
}
