import { Signal } from '../scanner/types';
import { logger } from '../utils/logger';

/**
 * Signal Aggregator
 * 
 * Phase 4: Aggregates all signals extracted from repository files
 * Provides statistics and organized signal collections
 */

export interface SignalAggregation {
  allSignals: Signal[];
  byType: {
    entry: Signal[];
    call: Signal[];
    event: Signal[];
    external: Signal[];
    structure: Signal[];
  };
  counts: {
    entry: number;
    call: number;
    event: number;
    external: number;
    structure: number;
    total: number;
  };
  statistics: {
    entryPoints: {
      byMethod: Record<string, number>;
      uniquePaths: number;
    };
    events: {
      producers: number;
      consumers: number;
      uniqueEvents: number;
    };
    externals: {
      byType: Record<string, number>;
      uniqueTargets: number;
    };
    calls: {
      uniqueCallers: number;
      uniqueCallees: number;
    };
  };
}

/**
 * Aggregates signals from all files
 * @param signals - Array of all signals extracted from repository files
 * @returns Aggregated signal data with statistics
 */
export function aggregateSignals(signals: Signal[]): SignalAggregation {
  logger.info('Aggregating signals', { totalSignals: signals.length });

  // Group signals by type
  const byType = {
    entry: signals.filter(s => s.type === 'entry'),
    call: signals.filter(s => s.type === 'call'),
    event: signals.filter(s => s.type === 'event'),
    external: signals.filter(s => s.type === 'external'),
    structure: signals.filter(s => s.type === 'structure')
  };

  // Count signals by type
  const counts = {
    entry: byType.entry.length,
    call: byType.call.length,
    event: byType.event.length,
    external: byType.external.length,
    structure: byType.structure.length,
    total: signals.length
  };

  // Calculate statistics
  const statistics = {
    entryPoints: {
      byMethod: {} as Record<string, number>,
      uniquePaths: 0
    },
    events: {
      producers: 0,
      consumers: 0,
      uniqueEvents: 0
    },
    externals: {
      byType: {} as Record<string, number>,
      uniqueTargets: 0
    },
    calls: {
      uniqueCallers: 0,
      uniqueCallees: 0
    }
  };

  // Entry point statistics
  const entryPaths = new Set<string>();
  byType.entry.forEach(signal => {
    const data = signal.data as any;
    if (data.method) {
      statistics.entryPoints.byMethod[data.method] = 
        (statistics.entryPoints.byMethod[data.method] || 0) + 1;
    }
    if (data.path) {
      entryPaths.add(data.path);
    }
  });
  statistics.entryPoints.uniquePaths = entryPaths.size;

  // Event statistics
  const uniqueEvents = new Set<string>();
  byType.event.forEach(signal => {
    const data = signal.data as any;
    if (data.name) {
      uniqueEvents.add(data.name);
    }
    if (data.role === 'producer') {
      statistics.events.producers++;
    } else if (data.role === 'consumer') {
      statistics.events.consumers++;
    }
  });
  statistics.events.uniqueEvents = uniqueEvents.size;

  // External statistics
  const uniqueTargets = new Set<string>();
  byType.external.forEach(signal => {
    const data = signal.data as any;
    if (data.type) {
      statistics.externals.byType[data.type] = 
        (statistics.externals.byType[data.type] || 0) + 1;
    }
    if (data.target) {
      uniqueTargets.add(data.target);
    }
  });
  statistics.externals.uniqueTargets = uniqueTargets.size;

  // Call statistics
  const uniqueCallers = new Set<string>();
  const uniqueCallees = new Set<string>();
  byType.call.forEach(signal => {
    const data = signal.data as any;
    if (data.from) {
      uniqueCallers.add(data.from);
    }
    if (data.to) {
      uniqueCallees.add(data.to);
    }
  });
  statistics.calls.uniqueCallers = uniqueCallers.size;
  statistics.calls.uniqueCallees = uniqueCallees.size;

  logger.info('Signal aggregation complete', {
    totalSignals: counts.total,
    entryPoints: counts.entry,
    events: counts.event,
    externals: counts.external,
    calls: counts.call,
    structures: counts.structure
  });

  logger.debug('Signal statistics', statistics);

  return {
    allSignals: signals,
    byType,
    counts,
    statistics
  };
}
