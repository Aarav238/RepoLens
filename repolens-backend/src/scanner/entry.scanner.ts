import { RepoFile } from '../github/repoFetcher';
import { Signal } from './types';

/**
 * Entry Scanner
 * 
 * Detects entry points in the codebase:
 * - Express/Fastify routes
 * - Spring annotations
 * - FastAPI decorators
 * - Rails routes
 * 
 * TODO: Phase 3 - Implement entry point detection
 */

export function scanEntry(file: RepoFile): Signal[] {
  // TODO: Phase 3 - Implement:
  // 1. Detect Express routes: app.get/post/put/delete('/path', handler)
  // 2. Detect Fastify routes: fastify.get/post/put/delete('/path', handler)
  // 3. Detect Spring annotations: @GetMapping, @PostMapping, etc.
  // 4. Detect FastAPI decorators: @app.get/post/put/delete('/path')
  // 5. Detect Rails routes: get/post/put/delete 'path', to: 'controller#action'
  // 6. Return array of entry signals

  return [];
}
