/**
 * Signal Types
 * 
 * Defines the structure of signals extracted from code files
 */

export interface Signal {
  type: 'entry' | 'call' | 'event' | 'external' | 'structure';
  data: any;
  file: string;
  confidence: number;
}

/**
 * Entry Signal Data
 */
export interface EntrySignalData {
  entryType: 'http' | 'grpc' | 'queue' | 'other';
  method?: string; // HTTP method: GET, POST, PUT, DELETE, etc.
  path?: string; // Route path
  handler?: string; // Handler function name
}

/**
 * Call Signal Data
 */
export interface CallSignalData {
  from: string; // Caller context (e.g., "Controller")
  to: string; // Callee (e.g., "Service.method")
}

/**
 * Event Signal Data
 */
export interface EventSignalData {
  name: string; // Event name (e.g., "PAYMENT_INITIATED")
  role: 'producer' | 'consumer';
}

/**
 * External Signal Data
 */
export interface ExternalSignalData {
  type: 'db' | 'http' | 'queue' | 'other';
  operation?: string; // e.g., "save", "get", "publish"
  target?: string; // e.g., database name, URL, queue name
}

/**
 * Structure Signal Data
 */
export interface StructureSignalData {
  importType: 'es6' | 'commonjs' | 'python' | 'java' | 'other';
  source: string; // Module/package name
  imports?: string[]; // Imported items
}
