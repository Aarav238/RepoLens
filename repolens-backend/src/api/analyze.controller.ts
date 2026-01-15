import { Request, Response } from 'express';
import { logger, logError, logPhase } from '../utils/logger';
import { fetchRepoFiles } from '../github/repoFetcher';
import { scanFile } from '../scanner';
import { aggregateSignals } from '../aggregator/signalAggregator';

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
    
    // TODO: Phase 5 - Build IR
    logPhase('5', 'Building IR', { owner, repo, branch });
    
    // TODO: Phase 6 - Return IR
    logPhase('6', 'Returning IR', { owner, repo, branch });

    const duration = Date.now() - startTime;
    logger.info('Analysis completed', { 
      owner, 
      repo, 
      branch, 
      duration: `${duration}ms`,
      filesFetched: repoFiles.length
    });

    res.json({
      message: 'Phase 4 complete - Signals aggregated',
      input: { owner, repo, branch },
      stats: {
        filesFetched: repoFiles.length,
        totalSize: repoFiles.reduce((sum, f) => sum + f.content.length, 0),
        signalsExtracted: aggregation.counts.total,
        duration: `${duration}ms`
      },
      signalCounts: aggregation.counts,
      statistics: aggregation.statistics,
      // Sample signals for testing (first 5 of each type)
      sampleSignals: {
        entry: aggregation.byType.entry.slice(0, 5),
        call: aggregation.byType.call.slice(0, 5),
        event: aggregation.byType.event.slice(0, 5),
        external: aggregation.byType.external.slice(0, 5),
        structure: aggregation.byType.structure.slice(0, 5)
      },
      note: `All ${aggregation.counts.total} signals aggregated from ${repoFiles.length} files. Ready for Phase 5 (IR construction).`
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
