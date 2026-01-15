import { RepoFile } from '../github/repoFetcher';
import { Signal } from './types';

/**
 * External Scanner
 * 
 * Detects external system interactions:
 * - Database: .save(), .insert(), .query()
 * - HTTP: axios, fetch
 * - Queue: publish, enqueue
 * 
 * TODO: Phase 3 - Implement external interaction detection
 */

export function scanExternals(file: RepoFile): Signal[] {
  // TODO: Phase 3 - Implement:
  // 1. Detect database operations: .save(), .insert(), .query(), etc.
  // 2. Detect HTTP calls: axios.get/post(), fetch()
  // 3. Detect queue operations: publish(), enqueue()
  // 4. Categorize by type (db, http, queue)
  // 5. Return array of external signals

  return [];
}
