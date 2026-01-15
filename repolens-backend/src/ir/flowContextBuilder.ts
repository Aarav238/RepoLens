/**
 * Flow Context Builder
 * 
 * Phase 7.1: Builds exact JSON context for LLM reasoning
 * 
 * Rules:
 * - One flow at a time
 * - No ordering
 * - No inference
 * - No mutation of IR
 * - Pure deterministic logic
 * 
 * This keeps a clean architectural boundary:
 * - ir/    → truth & deterministic derivations
 * - llm/   → probabilistic reasoning (Phase 7.3+)
 */

import { IR } from './ir.types';
import { FlowContext, FlowContextStep, FlowContextExternal } from './flowContext.types';
import { logger } from '../utils/logger';

/**
 * Builds a FlowContext for a single flow
 * 
 * @param ir - Complete IR object
 * @param flowId - ID of the flow to build context for
 * @returns FlowContext or null if flowId doesn't exist or entry point missing
 * 
 * Error handling (v1 contract):
 * - flowId doesn't exist → return null
 * - Entry point missing → return null
 * - Flow has no steps → return valid context with rawSteps: []
 */
export function buildFlowContext(ir: IR, flowId: string): FlowContext | null {
  // Find the flow
  const flow = ir.flows.find(f => f.id === flowId);
  if (!flow) {
    logger.warn('Flow not found', { flowId });
    return null;
  }

  // DEBUG: Log flow structure to understand what we're working with
  logger.debug('Building FlowContext', {
    flowId,
    flowFrom: flow.from,
    flowTo: flow.to,
    flowType: flow.type,
    metadataStepsCount: flow.metadata?.steps?.length || 0,
    metadataKeys: Object.keys(flow.metadata || {})
  });

  // Find the entry point
  const entryPointId = flow.metadata?.entryPointId;
  const entryPoint = ir.entryPoints.find(ep => ep.id === entryPointId);
  if (!entryPoint) {
    logger.warn('Entry point not found for flow', { flowId, entryPointId });
    return null;
  }

  // Extract raw steps from flow metadata
  // These are unordered transitions (bag of arrows)
  const metadataSteps = flow.metadata?.steps || [];
  logger.debug('Extracting steps from metadata', {
    flowId,
    stepsCount: metadataSteps.length,
    steps: metadataSteps.slice(0, 3) // Log first 3 steps for debugging
  });

  const rawSteps: FlowContextStep[] = metadataSteps.map((step: any) => ({
    from: step.from,
    to: step.to,
    type: step.type,
    metadata: step.metadata
  }));

  // Extract unique services (only from 'call' type steps)
  // Services = actors, Externals = resources
  // Rule: if step.type === "call", add step.from and step.to to services
  const serviceSet = new Set<string>();
  
  // Always include the entry point's service
  serviceSet.add(entryPoint.serviceId);
  
  for (const step of rawSteps) {
    if (step.type === 'call') {
      serviceSet.add(step.from);
      serviceSet.add(step.to);
    }
  }
  
  const services = Array.from(serviceSet);

  // Extract externals used in this flow
  // Find all external IDs referenced in 'external' type steps
  const externalIds = new Set<string>();
  for (const step of rawSteps) {
    if (step.type === 'external') {
      externalIds.add(step.to);
    }
  }

  // Map external IDs to their type and name
  const externals: FlowContextExternal[] = ir.externals
    .filter(ext => externalIds.has(ext.id))
    .map(ext => ({
      type: ext.type,
      name: ext.name
    }));

  // Build the final FlowContext
  const flowContext: FlowContext = {
    flowId,
    entryPoint: {
      method: entryPoint.method || 'UNKNOWN',
      path: entryPoint.path || 'UNKNOWN'
    },
    services,
    rawSteps,
    externals
  };

  logger.debug('FlowContext built', {
    flowId,
    entryPoint: flowContext.entryPoint,
    serviceCount: services.length,
    stepCount: rawSteps.length,
    externalCount: externals.length
  });

  return flowContext;
}

/**
 * Builds FlowContext for all flows in IR
 * Useful for batch processing or debugging
 * 
 * @param ir - Complete IR object
 * @returns Array of FlowContext objects (nulls filtered out)
 */
export function buildAllFlowContexts(ir: IR): FlowContext[] {
  const contexts = ir.flows
    .map(flow => buildFlowContext(ir, flow.id))
    .filter((ctx): ctx is FlowContext => ctx !== null);

  logger.info('All FlowContexts built', {
    totalFlows: ir.flows.length,
    validContexts: contexts.length
  });

  return contexts;
}

/**
 * Debug helper: Logs a FlowContext in a readable format
 * Use this for Phase 7.1 testing
 */
export function logFlowContext(flowContext: FlowContext | null): void {
  if (!flowContext) {
    console.log('FlowContext: null');
    return;
  }

  console.log('\n=== FlowContext ===');
  console.log(`Flow ID: ${flowContext.flowId}`);
  console.log(`Entry Point: ${flowContext.entryPoint.method} ${flowContext.entryPoint.path}`);
  console.log(`Services: [${flowContext.services.join(', ')}]`);
  console.log('Raw Steps:');
  flowContext.rawSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.from} → ${step.to} (${step.type})`);
  });
  console.log('Externals:');
  flowContext.externals.forEach(ext => {
    console.log(`  - ${ext.name} (${ext.type})`);
  });
  console.log('==================\n');
}
