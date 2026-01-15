/**
 * Flow Output Validator
 * 
 * Phase 7.4: Output parsing & validation
 * 
 * This is the "seatbelt + airbags" phase.
 * 
 * Responsibilities:
 * - Parse raw LLM output safely
 * - Validate against Phase 7.2 contract
 * - Detect hallucinations (new services/externals)
 * - Return safe, typed result OR safe fallback
 * 
 * Design Principle:
 * > The LLM is untrusted input. Treat it like user input from the internet.
 * 
 * Rules:
 * - NEVER throw
 * - ALWAYS return ValidationResult
 * - ALWAYS validate structure
 * - ALWAYS check for hallucinations
 */

import { OrderedFlowResult, ValidationResult } from './flowOutput.types';
import { FlowContext } from '../ir/flowContext.types';
import { logger } from '../utils/logger';

/**
 * Extracts the first valid JSON block from a string
 * 
 * LLMs sometimes add markdown formatting or extra text.
 * This function finds and extracts just the JSON.
 */
function extractJSON(raw: string): string | null {
  // Trim whitespace
  const trimmed = raw.trim();
  
  // Try direct parse first (most common case)
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Look for JSON code blocks
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }
    
    // Look for first { ... } block
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1);
    }
    
    return null;
  }
}

/**
 * Validates LLM output against Phase 7.2 contract
 * 
 * @param raw - Raw string output from LLM
 * @param context - Original FlowContext used to generate the output
 * @returns ValidationResult with ok/error status
 * 
 * Validation rules (NON-NEGOTIABLE):
 * 1. Output is valid JSON
 * 2. Has orderedSteps (array) and summary (string)
 * 3. Each step has valid order (starts at 1, increments by 1)
 * 4. Each step.from exists in FlowContext.services
 * 5. Each step.to exists in FlowContext.services OR FlowContext.externals
 * 6. Each step.type is valid ('call' | 'external' | 'event')
 * 7. Each step.async is boolean
 * 8. Each step.description is non-empty string
 * 9. No hallucinations (no new services/externals)
 */
export function validateFlowOutput(
  raw: string,
  context: FlowContext
): ValidationResult {
  // 1. Extract and parse JSON safely
  const jsonString = extractJSON(raw);
  if (!jsonString) {
    logger.warn('Failed to extract JSON from LLM output', {
      flowId: context.flowId,
      rawLength: raw.length,
      rawPreview: raw.substring(0, 200)
    });
    return {
      ok: false,
      result: null,
      error: 'Invalid JSON returned by LLM - could not extract JSON block'
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    logger.warn('JSON parse error', {
      flowId: context.flowId,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      result: null,
      error: 'Invalid JSON returned by LLM - parse error'
    };
  }

  // 2. Structure validation
  if (!parsed || typeof parsed !== 'object') {
    logger.warn('Parsed output is not an object', {
      flowId: context.flowId,
      parsedType: typeof parsed,
      parsedValue: String(parsed).substring(0, 200)
    });
    return {
      ok: false,
      result: null,
      error: 'Output does not match expected schema - not an object'
    };
  }

  // Debug: Log what we actually got
  logger.debug('Parsed LLM output structure', {
    flowId: context.flowId,
    keys: Object.keys(parsed),
    orderedStepsType: typeof parsed.orderedSteps,
    orderedStepsIsArray: Array.isArray(parsed.orderedSteps),
    hasSummary: typeof parsed.summary === 'string'
  });

  // Transform LLM output to match expected schema (handle common variations)
  // LLM sometimes uses different field names, so we normalize them
  if (!Array.isArray(parsed.orderedSteps)) {
    // Try common variations
    if (Array.isArray(parsed.orderedExecution)) {
      logger.info('Transforming orderedExecution to orderedSteps', { flowId: context.flowId });
      parsed.orderedSteps = parsed.orderedExecution;
      delete parsed.orderedExecution;
    } else if (Array.isArray(parsed.steps)) {
      logger.info('Transforming steps to orderedSteps', { flowId: context.flowId });
      parsed.orderedSteps = parsed.steps;
      delete parsed.steps;
    }
  }

  // Transform step fields if needed
  if (Array.isArray(parsed.orderedSteps)) {
    parsed.orderedSteps = parsed.orderedSteps.map((step: any, index: number) => {
      const transformed: any = { ...step };
      
      // Normalize order field
      if (transformed.step !== undefined && transformed.order === undefined) {
        transformed.order = transformed.step;
        delete transformed.step;
      }
      if (transformed.order === undefined) {
        transformed.order = index + 1;
      }
      
      // Normalize type field
      if (transformed.interaction !== undefined && transformed.type === undefined) {
        transformed.type = transformed.interaction;
        delete transformed.interaction;
      }
      
      // Normalize async field (invert sync to async)
      if (transformed.sync !== undefined && transformed.async === undefined) {
        transformed.async = !transformed.sync;
        delete transformed.sync;
      }
      
      // Ensure description exists
      if (!transformed.description || transformed.description.trim() === '') {
        transformed.description = `${transformed.from} → ${transformed.to} (${transformed.type})`;
      }
      
      return transformed;
    });
  }

  // Generate summary if missing
  if (!parsed.summary || typeof parsed.summary !== 'string') {
    if (Array.isArray(parsed.orderedSteps) && parsed.orderedSteps.length > 0) {
      parsed.summary = `Flow executes ${parsed.orderedSteps.length} step(s) from ${parsed.orderedSteps[0]?.from || 'entry'} to ${parsed.orderedSteps[parsed.orderedSteps.length - 1]?.to || 'completion'}.`;
      logger.info('Generated missing summary', { flowId: context.flowId });
    } else {
      parsed.summary = 'Flow execution details could not be determined.';
    }
  }

  if (!Array.isArray(parsed.orderedSteps)) {
    logger.warn('orderedSteps is not an array after transformation', {
      flowId: context.flowId,
      orderedStepsType: typeof parsed.orderedSteps,
      orderedStepsValue: parsed.orderedSteps ? String(parsed.orderedSteps).substring(0, 200) : 'null/undefined',
      allKeys: Object.keys(parsed)
    });
    return {
      ok: false,
      result: null,
      error: `Output does not match expected schema - orderedSteps is not an array (got ${typeof parsed.orderedSteps}). Keys: ${Object.keys(parsed).join(', ')}`
    };
  }

  if (typeof parsed.summary !== 'string') {
    return {
      ok: false,
      result: null,
      error: 'Output does not match expected schema - summary is not a string'
    };
  }

  // 3. Build validation sets
  const services = new Set(context.services);
  const externals = new Set(context.externals.map(e => e.name));

  // 4. Step-by-step validation
  const steps = parsed.orderedSteps;
  
  if (steps.length === 0) {
    // Empty steps are valid (e.g., health check endpoints)
    return {
      ok: true,
      result: {
        orderedSteps: [],
        summary: parsed.summary
      }
    };
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // 4.1. Order validation
    if (typeof step.order !== 'number' || step.order !== i + 1) {
      return {
        ok: false,
        result: null,
        error: `Step ordering is invalid - expected order ${i + 1}, got ${step.order}`
      };
    }

    // 4.2. From validation (must be a service)
    if (typeof step.from !== 'string' || !services.has(step.from)) {
      logger.warn('Hallucinated service detected', {
        flowId: context.flowId,
        stepIndex: i,
        hallucinatedService: step.from,
        validServices: Array.from(services)
      });
      return {
        ok: false,
        result: null,
        error: `Hallucinated service detected - '${step.from}' does not exist in flow context`
      };
    }

    // 4.3. To validation (must be a service OR external)
    if (typeof step.to !== 'string') {
      return {
        ok: false,
        result: null,
        error: `Invalid step.to - must be a string, got ${typeof step.to}`
      };
    }

    if (!services.has(step.to) && !externals.has(step.to)) {
      logger.warn('Hallucinated target detected', {
        flowId: context.flowId,
        stepIndex: i,
        hallucinatedTarget: step.to,
        validServices: Array.from(services),
        validExternals: Array.from(externals)
      });
      return {
        ok: false,
        result: null,
        error: `Hallucinated target detected - '${step.to}' does not exist in flow context`
      };
    }

    // 4.4. Type validation
    if (!['call', 'external', 'event'].includes(step.type)) {
      return {
        ok: false,
        result: null,
        error: `Invalid step type - must be 'call', 'external', or 'event', got '${step.type}'`
      };
    }

    // 4.5. Async validation
    if (typeof step.async !== 'boolean') {
      return {
        ok: false,
        result: null,
        error: `Invalid async flag - must be boolean, got ${typeof step.async}`
      };
    }

    // 4.6. Description validation
    if (typeof step.description !== 'string' || step.description.trim().length === 0) {
      return {
        ok: false,
        result: null,
        error: `Invalid description - must be non-empty string, got '${step.description}'`
      };
    }
  }

  // 5. Success - return validated result
  logger.debug('Flow output validated successfully', {
    flowId: context.flowId,
    stepCount: steps.length
  });

  return {
    ok: true,
    result: parsed as OrderedFlowResult
  };
}

/**
 * Creates a safe fallback result when validation fails
 * 
 * This ensures the system never crashes and UI can still render.
 */
export function createFallbackResult(error: string): OrderedFlowResult {
  return {
    orderedSteps: [],
    summary: `Flow explanation could not be generated reliably: ${error}`
  };
}
