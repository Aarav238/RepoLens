/**
 * IR (Intermediate Representation) Types
 * 
 * Defines the structure of the RAW IR output
 * 
 * TODO: Phase 5 - Define complete IR schema
 */

export interface IR {
  meta: IRMeta;
  services: Service[];
  entryPoints: EntryPoint[];
  events: Event[];
  externals: External[];
  flows: Flow[];
}

export interface IRMeta {
  repo: string;
  owner: string;
  branch: string;
  analyzedAt: string;
  totalFiles: number;
  totalSignals: number;
}

export interface Service {
  id: string;
  name: string;
  files: string[];
  type?: string;
}

export interface EntryPoint {
  id: string;
  serviceId: string;
  type: 'http' | 'grpc' | 'queue' | 'other';
  method?: string;
  path?: string;
  handler?: string;
}

export interface Event {
  id: string;
  name: string;
  producers: string[]; // Service IDs
  consumers: string[]; // Service IDs
}

export interface External {
  id: string;
  type: 'db' | 'http' | 'queue' | 'other';
  name: string;
  operations: string[];
}

import { OrderedStep } from '../llm/flowOutput.types';

export interface Flow {
  id: string;
  from: string; // Service ID or Entry Point ID
  to: string; // Service ID or External ID
  type: 'call' | 'event' | 'external';
  metadata?: Record<string, any>;
  // Phase 7.5: LLM reasoning enrichment (optional)
  orderedSteps?: OrderedStep[];
  summary?: string;
  reasoningStatus?: 'ok' | 'skipped' | 'failed';
  reasoningError?: string;
}
