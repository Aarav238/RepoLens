import { RepoFile } from '../github/repoFetcher';
import { Signal, StructureSignalData } from './types';

/**
 * Structure Scanner
 * 
 * Detects code structure and imports:
 * - import ... from (ES6)
 * - require() (CommonJS)
 * - from x import y (Python)
 * 
 * Used later to infer services and dependencies
 */

export function scanStructure(file: RepoFile): Signal[] {
  const signals: Signal[] = [];
  const content = file.content;

  // 1. Detect ES6 imports: import X from 'module' or import { X, Y } from 'module'
  const es6ImportPattern = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]*\})|(?:\w+))\s+from\s+['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = es6ImportPattern.exec(content)) !== null) {
    const source = match[1];
    
    // Extract imported items
    const importStatement = match[0];
    const namedImports = importStatement.match(/\{([^}]+)\}/);
    const defaultImport = importStatement.match(/import\s+(\w+)\s+from/);
    const namespaceImport = importStatement.match(/import\s+\*\s+as\s+(\w+)/);
    
    const imports: string[] = [];
    if (namedImports) {
      imports.push(...namedImports[1].split(',').map(i => i.trim()));
    } else if (defaultImport) {
      imports.push(defaultImport[1]);
    } else if (namespaceImport) {
      imports.push(`* as ${namespaceImport[1]}`);
    }

    signals.push({
      type: 'structure',
      data: {
        importType: 'es6',
        source,
        imports: imports.length > 0 ? imports : undefined
      } as StructureSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 2. Detect CommonJS requires: require('module')
  const requirePattern = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = requirePattern.exec(content)) !== null) {
    const importName = match[1];
    const source = match[2];

    signals.push({
      type: 'structure',
      data: {
        importType: 'commonjs',
        source,
        imports: [importName]
      } as StructureSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 3. Detect Python imports: from x import y or import x
  const pythonFromImportPattern = /from\s+([\w.]+)\s+import\s+([\w\s,]+)/g;
  while ((match = pythonFromImportPattern.exec(content)) !== null) {
    const source = match[1];
    const importsStr = match[2];
    const imports = importsStr.split(',').map(i => i.trim());

    signals.push({
      type: 'structure',
      data: {
        importType: 'python',
        source,
        imports
      } as StructureSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  const pythonImportPattern = /^import\s+([\w.]+)/gm;
  while ((match = pythonImportPattern.exec(content)) !== null) {
    const source = match[1];

    signals.push({
      type: 'structure',
      data: {
        importType: 'python',
        source
      } as StructureSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 4. Detect Java imports: import package.Class or import package.*
  const javaImportPattern = /^import\s+([\w.]+(?:\.[*])?);/gm;
  while ((match = javaImportPattern.exec(content)) !== null) {
    const source = match[1];

    signals.push({
      type: 'structure',
      data: {
        importType: 'java',
        source
      } as StructureSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 5. Detect Ruby requires: require 'module'
  const rubyRequirePattern = /^require\s+['"]([^'"]+)['"]/gm;
  while ((match = rubyRequirePattern.exec(content)) !== null) {
    const source = match[1];

    signals.push({
      type: 'structure',
      data: {
        importType: 'other',
        source
      } as StructureSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  return signals;
}
