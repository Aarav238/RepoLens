import { RepoFile } from '../github/repoFetcher';
import { Signal, EntrySignalData } from './types';

/**
 * Entry Scanner
 * 
 * Detects entry points in the codebase:
 * - Express/Fastify routes
 * - Spring annotations
 * - FastAPI decorators
 * - Rails routes
 */

export function scanEntry(file: RepoFile): Signal[] {
  const signals: Signal[] = [];
  const content = file.content;
  const lines = content.split('\n');

  // 1. Express/Fastify routes: app.get/post/put/delete/patch('/path', handler)
  // Pattern: (app|router|fastify)\.(get|post|put|delete|patch|all)\s*\(
  const expressRoutePattern = /(?:app|router|fastify)\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = expressRoutePattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    // Try to extract handler name from next few lines
    const handlerMatch = content.substring(match.index).match(/,\s*(\w+)|=>\s*\{|function\s+(\w+)/i);
    const handler = handlerMatch ? (handlerMatch[1] || handlerMatch[2] || 'anonymous') : 'anonymous';

    signals.push({
      type: 'entry',
      data: {
        entryType: 'http',
        method,
        path,
        handler
      } as EntrySignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 2. Spring annotations: @GetMapping, @PostMapping, @RequestMapping, etc.
  const springPattern = /@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\([^)]*value\s*=\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = springPattern.exec(content)) !== null) {
    const path = match[1];
    const annotationMatch = content.substring(0, match.index).match(/@(\w+Mapping)/);
    const annotation = annotationMatch ? annotationMatch[1] : 'RequestMapping';
    const method = annotation.replace('Mapping', '').toUpperCase() || 'GET';

    // Try to find method name
    const methodMatch = content.substring(match.index).match(/(?:public|private|protected)?\s*\w+\s+(\w+)\s*\(/);
    const handler = methodMatch ? methodMatch[1] : 'unknown';

    signals.push({
      type: 'entry',
      data: {
        entryType: 'http',
        method,
        path,
        handler
      } as EntrySignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 3. FastAPI decorators: @app.get/post/put/delete('/path')
  const fastApiPattern = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = fastApiPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    
    // Try to find function name
    const funcMatch = content.substring(match.index).match(/(?:async\s+)?def\s+(\w+)\s*\(/);
    const handler = funcMatch ? funcMatch[1] : 'unknown';

    signals.push({
      type: 'entry',
      data: {
        entryType: 'http',
        method,
        path,
        handler
      } as EntrySignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 4. Rails routes: get/post/put/delete 'path', to: 'controller#action'
  const railsPattern = /(get|post|put|delete|patch)\s+['"`]([^'"`]+)['"`]\s*,\s*to:\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = railsPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const to = match[3];
    const [controller, action] = to.split('#');

    signals.push({
      type: 'entry',
      data: {
        entryType: 'http',
        method,
        path,
        handler: `${controller}#${action}`
      } as EntrySignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  return signals;
}
