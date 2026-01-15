/**
 * Flow Enricher
 * 
 * Phase 7.5: IR Enrichment & Flow Loop
 * 
 * This is the conductor that wires everything together:
 * - Builds FlowContext for each flow
 * - Calls LLM for reasoning
 * - Validates output
 * - Attaches results back to flows
 * 
 * Rules:
 * - Process ALL flows (not just one)
 * - Never let one failure break others
 * - Skip flows with no steps (health checks, etc.)
 * - Mutate flows in-place
 * - Never throw
 */

import { IR, Flow } from './ir.types';
import { buildFlowContext } from './flowContextBuilder';
import { reasonAboutFlow } from '../llm/flowReasoner';
import { validateFlowOutput, createFallbackResult } from '../llm/flowOutputValidator';
import { logger, logPhase } from '../utils/logger';

/**
 * Enriches all flows in IR with LLM reasoning
 * 
 * For each flow:
 * 1. Skip if no steps (health checks, middleware-only)
 * 2. Build FlowContext
 * 3. Call LLM
 * 4. Validate output
 * 5. Attach results to flow
 * 
 * @param ir - IR object (flows will be mutated in-place)
 * 
 * Flow selection rules:
 * - flow.metadata.steps.length === 0 → SKIP
 * - FlowContext === null → FAIL
 * - Otherwise → PROCESS
 */
export async function enrichFlowsWithReasoning(ir: IR): Promise<void> {
  logPhase('7.5', 'Enriching flows with LLM reasoning', {
    totalFlows: ir.flows.length
  });

  const flowsWithSteps = ir.flows.filter(f => 
    f.metadata?.steps && Array.isArray(f.metadata.steps) && f.metadata.steps.length > 0
  );

  logger.info('Flow enrichment started', {
    totalFlows: ir.flows.length,
    flowsWithSteps: flowsWithSteps.length,
    flowsToSkip: ir.flows.length - flowsWithSteps.length
  });

  // Process each flow
  for (const flow of ir.flows) {
    const stepCount = flow.metadata?.steps?.length || 0;

    // Rule: Skip flows with no steps
    if (stepCount === 0) {
      flow.reasoningStatus = 'skipped';
      flow.summary = 'No business logic detected for this flow.';
      logger.debug('Flow skipped (no steps)', {
        flowId: flow.id,
        entryPointId: flow.metadata?.entryPointId
      });
      continue;
    }

    // Build FlowContext
    logger.info('[Phase 7.5] Processing flow', {
      flowId: flow.id,
      entryPointId: flow.metadata?.entryPointId,
      stepCount
    });

    const context = buildFlowContext(ir, flow.id);

    if (!context) {
      flow.reasoningStatus = 'failed';
      flow.reasoningError = 'Failed to build flow context.';
      flow.summary = 'Flow explanation could not be generated reliably.';
      logger.warn('Flow context build failed', {
        flowId: flow.id
      });
      continue;
    }

    // Call LLM and validate
    try {
      // Phase 7.3: Call LLM
      logger.info('[Phase 7.3] Calling LLM', {
        flowId: flow.id,
        entryPoint: `${context.entryPoint.method} ${context.entryPoint.path}`
      });

      const raw = await reasonAboutFlow(context);
      
      // Log raw LLM output
      console.log(`\n========== PHASE 7.3 DEBUG: Flow ${flow.id} ==========`);
      console.log(`Entry Point: ${context.entryPoint.method} ${context.entryPoint.path}`);
      console.log('Raw LLM Output:');
      console.log(raw);
      console.log('====================================================\n');

      logger.info('LLM response received', {
        flowId: flow.id,
        responseLength: raw.length,
        responsePreview: raw.substring(0, 200)
      });

      // Phase 7.4: Validate output
      logger.info('[Phase 7.4] Validating LLM output', { flowId: flow.id });
      const validation = validateFlowOutput(raw, context);

      if (validation.ok) {
        // Success: Attach results to flow
        flow.orderedSteps = validation.result!.orderedSteps;
        flow.summary = validation.result!.summary;
        flow.reasoningStatus = 'ok';
        
        console.log(`\n========== PHASE 7.4 DEBUG: Flow ${flow.id} - Validation PASSED ==========`);
        console.log('Ordered Steps:');
        validation.result!.orderedSteps.forEach(step => {
          console.log(`  ${step.order}. ${step.from} → ${step.to} (${step.type})`);
          console.log(`     ${step.description}`);
          console.log(`     async: ${step.async}`);
        });
        console.log('\nSummary:', validation.result!.summary);
        console.log('====================================================\n');
        
        logger.info('Flow enriched successfully', {
          flowId: flow.id,
          stepCount: flow.orderedSteps.length
        });
      } else {
        // Validation failed: Use fallback
        flow.reasoningStatus = 'failed';
        flow.reasoningError = validation.error;
        const fallback = createFallbackResult(validation.error || 'Unknown validation error');
        flow.summary = fallback.summary;
        
        console.log(`\n========== PHASE 7.4 DEBUG: Flow ${flow.id} - Validation FAILED ==========`);
        console.log('Error:', validation.error);
        console.log('Using fallback result...');
        console.log('Fallback summary:', fallback.summary);
        console.log('====================================================\n');
        
        logger.warn('Flow validation failed', {
          flowId: flow.id,
          error: validation.error
        });
      }
    } catch (error) {
      // LLM call failed: Use fallback
      flow.reasoningStatus = 'failed';
      flow.reasoningError = error instanceof Error ? error.message : 'Unexpected error during flow reasoning.';
      flow.summary = 'Flow explanation failed due to an internal error.';
      
      console.log(`\n========== PHASE 7.3 ERROR: Flow ${flow.id} ==========`);
      console.log('LLM call failed:', error instanceof Error ? error.message : String(error));
      console.log('====================================================\n');
      
      logger.error('Flow reasoning failed', {
        flowId: flow.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Summary statistics
  const stats = {
    total: ir.flows.length,
    ok: ir.flows.filter(f => f.reasoningStatus === 'ok').length,
    skipped: ir.flows.filter(f => f.reasoningStatus === 'skipped').length,
    failed: ir.flows.filter(f => f.reasoningStatus === 'failed').length
  };

  logger.info('Flow enrichment complete', stats);
  logPhase('7.5', 'Flow enrichment complete', stats);
}
