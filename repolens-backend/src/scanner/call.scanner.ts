import { RepoFile } from '../github/repoFetcher';
import { Signal, CallSignalData } from './types';

/**
 * Call Scanner
 * 
 * Detects method calls and function invocations:
 * - service.method()
 * - this.method()
 * - self.method()
 * 
 * TODO: Phase 3 - Implement call detection
 */

export function scanCalls(file: RepoFile): Signal[] {
  const signals: Signal[] = [];
  const content = file.content;

  // Extract context (class/function name) from file
  const getContext = (): string => {
    // Try to find class name
    const classMatch = content.match(/(?:class|export\s+class)\s+(\w+)/);
    if (classMatch) return classMatch[1];
    
    // Try to find function name
    const funcMatch = content.match(/(?:function|export\s+function|const\s+\w+\s*=\s*(?:async\s+)?function)\s+(\w+)/);
    if (funcMatch) return funcMatch[1];
    
    // Use filename as fallback
    const fileName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown';
    return fileName;
  };

  const context = getContext();

  // 1. Detect service.method() patterns (excluding common built-ins)
  // Pattern: identifier.identifier( - but exclude console, Math, etc.
  const serviceCallPattern = /\b([a-zA-Z_$][\w$]*)\s*\.\s*([a-zA-Z_$][\w$]*)\s*\(/g;
  const excludedPrefixes = ['console', 'Math', 'Date', 'String', 'Number', 'Array', 'Object', 'JSON', 'window', 'document', 'process', 'Buffer'];
  
  let match;
  while ((match = serviceCallPattern.exec(content)) !== null) {
    const caller = match[1];
    const method = match[2];
    
    // Skip if it's a common built-in
    if (excludedPrefixes.includes(caller)) continue;
    
    // Skip if it's a number or common pattern
    if (/^\d/.test(caller)) continue;

    signals.push({
      type: 'call',
      data: {
        from: context,
        to: `${caller}.${method}`
      } as CallSignalData,
      file: file.path,
      confidence: 0.7
    });
  }

  // 2. Detect this.method() patterns
  const thisCallPattern = /\bthis\s*\.\s*([a-zA-Z_$][\w$]*)\s*\(/g;
  while ((match = thisCallPattern.exec(content)) !== null) {
    const method = match[1];

    signals.push({
      type: 'call',
      data: {
        from: context,
        to: `this.${method}`
      } as CallSignalData,
      file: file.path,
      confidence: 0.8
    });
  }

  // 3. Detect self.method() patterns (Ruby)
  const selfCallPattern = /\bself\s*\.\s*([a-zA-Z_$][\w$]*)\s*\(/g;
  while ((match = selfCallPattern.exec(content)) !== null) {
    const method = match[1];

    signals.push({
      type: 'call',
      data: {
        from: context,
        to: `self.${method}`
      } as CallSignalData,
      file: file.path,
      confidence: 0.8
    });
  }

  // 4. Detect super.method() patterns
  const superCallPattern = /\bsuper\s*\.\s*([a-zA-Z_$][\w$]*)\s*\(/g;
  while ((match = superCallPattern.exec(content)) !== null) {
    const method = match[1];

    signals.push({
      type: 'call',
      data: {
        from: context,
        to: `super.${method}`
      } as CallSignalData,
      file: file.path,
      confidence: 0.75
    });
  }

  return signals;
}
