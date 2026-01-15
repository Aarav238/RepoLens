import { Request, Response } from 'express';
import { logger, logError, logPhase } from '../utils/logger';
import { fetchRepoFiles } from '../github/repoFetcher';

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
    
    // Phase 3 - Files are already filtered in Phase 2
    logPhase('3', 'Files filtered', { owner, repo, branch, fileCount: repoFiles.length });
    
    // TODO: Phase 4 - Scan files for signals
    logPhase('4', 'Scanning files for signals', { owner, repo, branch });
    
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
      message: 'Phase 2 complete - Repository files fetched',
      input: { owner, repo, branch },
      stats: {
        filesFetched: repoFiles.length,
        totalSize: repoFiles.reduce((sum, f) => sum + f.content.length, 0),
        duration: `${duration}ms`
      },
      // For testing/debugging - showing first 10 file paths
      // Note: ALL files are fetched with full content, stored in repoFiles array
      // These will be used in Phase 4 for signal extraction
      sampleFiles: repoFiles.slice(0, 10).map(f => ({
        path: f.path,
        size: f.content.length,
        preview: f.content.substring(0, 100) + (f.content.length > 100 ? '...' : '')
      })),
      note: `All ${repoFiles.length} files have been fetched with full content and are ready for Phase 4 (signal extraction)`
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
