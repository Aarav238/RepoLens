import { logger } from './logger';

/**
 * File Filter Utility
 * 
 * Filters repository files based on allowed extensions and ignored folders
 * 
 * TODO: Phase 2 - Implement filtering logic
 */

export interface FileFilterOptions {
  allowedExtensions?: string[];
  ignoredFolders?: string[];
}

const DEFAULT_ALLOWED_EXTENSIONS = ['.js', '.ts', '.java', '.py', '.rb'];
const DEFAULT_IGNORED_FOLDERS = ['node_modules', 'vendor', 'test', 'spec'];

/**
 * Checks if a file path should be included based on filtering rules
 * @param filePath - The file path to check
 * @param options - Filtering options
 * @returns true if file should be included, false otherwise
 */
export function shouldIncludeFile(
  filePath: string,
  options: FileFilterOptions = {}
): boolean {
  const {
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    ignoredFolders = DEFAULT_IGNORED_FOLDERS
  } = options;

  // TODO: Phase 2 - Implement:
  // 1. Check if file extension is in allowedExtensions
  // 2. Check if any part of path contains ignoredFolders
  // 3. Return true/false

  logger.debug('Checking file for inclusion', { filePath, allowedExtensions, ignoredFolders });
  
  return false;
}
