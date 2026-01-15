import { RepoFile } from '../github/repoFetcher';
import { Signal, ExternalSignalData } from './types';

/**
 * External Scanner
 * 
 * Detects external system interactions:
 * - Database: .save(), .insert(), .query()
 * - HTTP: axios, fetch
 * - Queue: publish, enqueue
 */

export function scanExternals(file: RepoFile): Signal[] {
  const signals: Signal[] = [];
  const content = file.content;

  // 1. Detect database operations
  const dbOperations = ['save', 'insert', 'update', 'delete', 'remove', 'find', 'findOne', 'findById', 'query', 'execute', 'create', 'destroy'];
  
  for (const op of dbOperations) {
    // Pattern: .save(), .insert(), etc.
    const dbPattern = new RegExp(`\\.${op}\\s*\\(`, 'gi');
    let match;
    while ((match = dbPattern.exec(content)) !== null) {
      // Try to extract model/table name from context
      const contextBefore = content.substring(Math.max(0, match.index - 50), match.index);
      const modelMatch = contextBefore.match(/(\w+)\s*\.\s*$/);
      const target = modelMatch ? modelMatch[1] : 'database';

      signals.push({
        type: 'external',
        data: {
          type: 'db',
          operation: op,
          target
        } as ExternalSignalData,
        file: file.path,
        confidence: 0.8
      });
    }
  }

  // 2. Detect HTTP calls: axios.get/post/put/delete()
  const axiosPattern = /axios\.(get|post|put|delete|patch|request)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = axiosPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const url = match[2];

    signals.push({
      type: 'external',
      data: {
        type: 'http',
        operation: method,
        target: url
      } as ExternalSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 3. Detect fetch() calls
  const fetchPattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = fetchPattern.exec(content)) !== null) {
    const url = match[1];

    signals.push({
      type: 'external',
      data: {
        type: 'http',
        operation: 'GET',
        target: url
      } as ExternalSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 4. Detect queue operations: enqueue(), publish()
  // Deny-list to filter out false positives (multer, file uploads, etc.)
  const queueDenyList = ['multer', 'file', 'upload', 'limit', 'size', 'mb', 'kb', 'gb', 'storage', 'buffer', 'stream', 'body-parser', 'bodyparser'];
  const queueOperations = ['enqueue', 'dequeue', 'publish', 'subscribe', 'send', 'receive'];
  
  // Helper function to check if context contains deny-listed keywords
  const isQueueFalsePositive = (context: string): boolean => {
    const contextLower = context.toLowerCase();
    // Check deny-list keywords
    if (queueDenyList.some(keyword => contextLower.includes(keyword))) {
      return true;
    }
    // Check if queue name looks like a file size (e.g., "30mb", "10kb")
    if (/\d+\s*(mb|kb|gb|bytes?)/i.test(context)) {
      return true;
    }
    return false;
  };

  for (const op of queueOperations) {
    const queuePattern = new RegExp(`\\.${op}\\s*\\(`, 'gi');
    while ((match = queuePattern.exec(content)) !== null) {
      // Get context around the match to check for false positives
      const contextBefore = content.substring(Math.max(0, match.index - 100), match.index);
      const contextAfter = content.substring(match.index, match.index + 100);
      const fullContext = contextBefore + contextAfter;

      // Skip if this looks like a false positive
      if (isQueueFalsePositive(fullContext)) {
        continue;
      }

      // Try to extract queue name
      const queueMatch = contextAfter.match(/['"`]([^'"`]+)['"`]/);
      const queueName = queueMatch ? queueMatch[1] : 'queue';

      // Additional check: skip if extracted queue name looks like file size
      if (/^\d+\s*(mb|kb|gb|bytes?)$/i.test(queueName)) {
        continue;
      }

      signals.push({
        type: 'external',
        data: {
          type: 'queue',
          operation: op,
          target: queueName
        } as ExternalSignalData,
        file: file.path,
        confidence: 0.8
      });
    }
  }

  // 5. Detect SQL queries (basic patterns)
  const sqlPattern = /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+[^;]+/gi;
  while ((match = sqlPattern.exec(content)) !== null) {
    const query = match[0].substring(0, 50); // First 50 chars

    signals.push({
      type: 'external',
      data: {
        type: 'db',
        operation: 'query',
        target: query
      } as ExternalSignalData,
      file: file.path,
      confidence: 0.7
    });
  }

  return signals;
}
