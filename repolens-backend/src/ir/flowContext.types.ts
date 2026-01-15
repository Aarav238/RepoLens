/**
 * FlowContext Types
 * 
 * Phase 7.1: Projection of IR for LLM reasoning
 * This is NOT core IR — it's a derived, disposable structure.
 * 
 * Rules:
 * - Small
 * - Grounded
 * - Complete
 * - Deterministic
 */

export interface FlowContextEntryPoint {
  method: string;
  path: string;
}

export interface FlowContextStep {
  from: string;
  to: string;
  type: 'call' | 'external' | 'event';
  metadata?: Record<string, any>;
}

export interface FlowContextExternal {
  type: string;
  name: string;
}

/**
 * FlowContext - The exact JSON context sent to LLM
 * 
 * This is a projection of one flow from the IR,
 * containing only the information needed for reasoning.
 */
export interface FlowContext {
  flowId: string;
  entryPoint: FlowContextEntryPoint;
  services: string[];           // Service IDs only (deduped)
  rawSteps: FlowContextStep[];  // Unordered transitions
  externals: FlowContextExternal[];
}
