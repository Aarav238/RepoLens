import { RepoFile } from '../github/repoFetcher';
import { Signal } from './types';
import { scanEntry } from './entry.scanner';
import { scanCalls } from './call.scanner';
import { scanEvents } from './event.scanner';
import { scanExternals } from './external.scanner';
import { scanStructure } from './structure.scanner';
import { logger } from '../utils/logger';

/**
 * Scans a file and extracts all signals
 * 
 * Combines all scanner outputs into a single array of signals
 * 
 * @param file - The repository file to scan
 * @returns Array of all extracted signals from the file
 */
export function scanFile(file: RepoFile): Signal[] {
  logger.debug('Scanning file for signals', { file: file.path });
  
  const entrySignals = scanEntry(file);
  const callSignals = scanCalls(file);
  const eventSignals = scanEvents(file);
  const externalSignals = scanExternals(file);
  const structureSignals = scanStructure(file);

  const allSignals = [
    ...entrySignals,
    ...callSignals,
    ...eventSignals,
    ...externalSignals,
    ...structureSignals
  ];

  // Log signal counts by type
  const signalCounts = {
    entry: entrySignals.length,
    call: callSignals.length,
    event: eventSignals.length,
    external: externalSignals.length,
    structure: structureSignals.length,
    total: allSignals.length
  };

  logger.debug('Signals extracted from file', { 
    file: file.path, 
    ...signalCounts 
  });

  return allSignals;
}
