import { Request, Response } from 'express';
import { logger, logError, logPhase } from '../utils/logger';
import { fetchRepoFiles } from '../github/repoFetcher';
import { scanFile } from '../scanner';
import { aggregateSignals } from '../aggregator/signalAggregator';
import { buildIR } from '../ir/ir.builder';
import { buildAllFlowContexts, logFlowContext } from '../ir/flowContextBuilder';
import { enrichFlowsWithReasoning } from '../ir/flowEnricher';

/**
 * POST /analyze-repo
 * Analyzes a GitHub repository and returns the IR (Intermediate Representation)
 * 
 * Request body:
 * {
 *   owner: string,
 *   repo: string,
 *   branch?: string (optional, defaults to 'main')
 * }
 */
export const analyzeController = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { owner, repo, branch = 'main' } = req.body;

    logger.info('Analyze repo request received', { owner, repo, branch });

    if (!owner || !repo) {
      logger.warn('Invalid request: missing required fields', { owner, repo, branch });
      res.status(400).json({
        error: 'Missing required fields: owner and repo are required'
      });
      return;
    }

    logPhase('1', 'Starting repository analysis', { owner, repo, branch });

    // Phase 2 - Fetch repo files (filtering happens inside fetchRepoFiles)
    logPhase('2', 'Fetching repository files', { owner, repo, branch });
    const repoFiles = await fetchRepoFiles({ owner, repo, branch });
    logger.info('Repository files fetched', {
      owner,
      repo,
      branch,
      fileCount: repoFiles.length
    });
    
    // Phase 3 - Scan files for signals (extraction)
    logPhase('3', 'Scanning files for signals', { owner, repo, branch });
    const allSignals = repoFiles.flatMap((file) => scanFile(file));
    logger.info('Signals extracted from files', {
      owner,
      repo,
      branch,
      totalSignals: allSignals.length
    });
    
    // Phase 4 - Aggregate signals
    logPhase('4', 'Aggregating signals', { owner, repo, branch });
    const aggregation = aggregateSignals(allSignals);
    
    logger.info('Signal aggregation complete', {
      owner,
      repo,
      branch,
      ...aggregation.counts,
      statistics: aggregation.statistics
    });
    
    // Phase 5 - Build IR
    logPhase('5', 'Building IR', { owner, repo, branch });
    const ir = buildIR(aggregation.allSignals, {
      owner,
      repo,
      branch,
      totalFiles: repoFiles.length
    });
    
    logger.info('IR construction complete', {
      owner,
      repo,
      branch,
      services: ir.services.length,
      entryPoints: ir.entryPoints.length,
      events: ir.events.length,
      externals: ir.externals.length,
      flows: ir.flows.length
    });

    // Phase 7.1 - Build FlowContexts (for debugging)
    logPhase('7.1', 'Building FlowContexts for LLM', { owner, repo, branch });
    const flowContexts = buildAllFlowContexts(ir);
    
    // DEBUG: Log flow contexts to verify structure
    if (flowContexts.length > 0) {
      const flowWithSteps = flowContexts.find(ctx => ctx.rawSteps.length > 0) || flowContexts[0];
      
      console.log('\n========== PHASE 7.1 DEBUG: FlowContext Sample ==========');
      logFlowContext(flowWithSteps);
      console.log(`Total FlowContexts built: ${flowContexts.length}`);
      console.log(`Flows with steps: ${flowContexts.filter(ctx => ctx.rawSteps.length > 0).length}`);
      console.log(`Flows without steps: ${flowContexts.filter(ctx => ctx.rawSteps.length === 0).length}`);
      console.log('==========================================================\n');
    }

    // Phase 7.5 - Enrich all flows with LLM reasoning
    await enrichFlowsWithReasoning(ir);
    
    // Phase 6 - Return IR
    logPhase('6', 'Returning IR', { owner, repo, branch });

    const duration = Date.now() - startTime;
    logger.info('Analysis completed', { 
      owner, 
      repo, 
      branch, 
      duration: `${duration}ms`,
      filesFetched: repoFiles.length
    });

    // Calculate enrichment statistics
    const enrichmentStats = {
      total: ir.flows.length,
      ok: ir.flows.filter(f => f.reasoningStatus === 'ok').length,
      skipped: ir.flows.filter(f => f.reasoningStatus === 'skipped').length,
      failed: ir.flows.filter(f => f.reasoningStatus === 'failed').length
    };

    res.json({
      message: 'Phase 7.5 complete - IR constructed and enriched with LLM reasoning',
      input: { owner, repo, branch },
      stats: {
        filesFetched: repoFiles.length,
        totalSize: repoFiles.reduce((sum, f) => sum + f.content.length, 0),
        signalsExtracted: aggregation.counts.total,
        flowContextsBuilt: flowContexts.length,
        enrichment: enrichmentStats,
        duration: `${duration}ms`
      },
      ir: {
        meta: ir.meta,
        services: ir.services,
        entryPoints: ir.entryPoints,
        events: ir.events,
        externals: ir.externals,
        flows: ir.flows
      },
      // Phase 7.1: FlowContexts for LLM reasoning
      flowContexts,
      summary: {
        services: ir.services.length,
        entryPoints: ir.entryPoints.length,
        events: ir.events.length,
        externals: ir.externals.length,
        flows: ir.flows.length,
        flowContexts: flowContexts.length
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(error instanceof Error ? error : new Error(String(error)), {
      owner: req.body.owner,
      repo: req.body.repo,
      branch: req.body.branch,
      duration: `${duration}ms`
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
