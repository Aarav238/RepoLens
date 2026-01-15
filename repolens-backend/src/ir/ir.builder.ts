import { Signal } from '../scanner/types';
import { IR, IRMeta, Service, EntryPoint, Event, External, Flow } from './ir.types';
import { logger } from '../utils/logger';

/**
 * IR Builder
 * 
 * Converts signals into RAW IR (Intermediate Representation)
 * 
 * Responsibilities:
 * - Infer services from file paths
 * - Build services[], entryPoints[], events[], externals[], flows[]
 * 
 * ⚠️ DO NOT order steps
 * ⚠️ DO NOT use AI
 * This is the truth layer.
 * 
 * TODO: Phase 5 - Implement IR construction logic
 */

export interface BuildIROptions {
  owner: string;
  repo: string;
  branch: string;
  totalFiles: number;
}

/**
 * Builds IR from signals
 * @param signals - Array of all extracted signals
 * @param options - Build options
 * @returns Complete IR object
 */
export function buildIR(signals: Signal[], options: BuildIROptions): IR {
  const { owner, repo, branch, totalFiles } = options;

  logger.info('Building IR from signals', {
    totalSignals: signals.length,
    totalFiles,
    owner,
    repo,
    branch
  });

  // TODO: Phase 5 - Implement:
  // 1. Infer services from file paths
  // 2. Build services array
  // 3. Build entryPoints array
  // 4. Build events array
  // 5. Build externals array
  // 6. Build flows array (unordered)
  // 7. Build meta object
  // 8. Return complete IR

  const meta: IRMeta = {
    repo,
    owner,
    branch,
    analyzedAt: new Date().toISOString(),
    totalFiles,
    totalSignals: signals.length
  };

  logger.debug('IR meta created', meta);

  const ir: IR = {
    meta,
    services: [],
    entryPoints: [],
    events: [],
    externals: [],
    flows: []
  };

  logger.info('IR built successfully', {
    services: ir.services.length,
    entryPoints: ir.entryPoints.length,
    events: ir.events.length,
    externals: ir.externals.length,
    flows: ir.flows.length
  });

  return ir;
}
