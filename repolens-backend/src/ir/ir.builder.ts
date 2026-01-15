import { Signal, EntrySignalData, CallSignalData, EventSignalData, ExternalSignalData } from '../scanner/types';
import { IR, IRMeta, Service, EntryPoint, Event, External, Flow } from './ir.types';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';

/**
 * IR Builder
 * 
 * Converts signals into RAW IR (Intermediate Representation)
 * 
 * Responsibilities:
 * - Infer services from file paths
 * - Build services[], entryPoints[], events[], externals[], flows[]
 * 
 * ⚠️ DO NOT order steps
 * ⚠️ DO NOT use AI
 * This is the truth layer.
 */

export interface BuildIROptions {
  owner: string;
  repo: string;
  branch: string;
  totalFiles: number;
}

interface ServiceInference {
  serviceId: string;
  serviceName: string;
  confidence: number;
}

/**
 * Infers service from file path using hybrid rule-based approach
 * Rule 0: Application root files (highest confidence 0.95)
 * Rule 1: Role-based folders (confidence 0.9)
 * Rule 1.5: Route layer files (confidence 0.85)
 * Rule 2: Domain folder grouping (confidence 0.8)
 * Rule 3: API folder fallback (confidence 0.6)
 * Rule 4: Last-resort fallback (confidence 0.4)
 */
function inferService(filePath: string): ServiceInference {
  const normalizedPath = filePath.toLowerCase();
  const pathParts = filePath.split('/');
  const fileName = pathParts[pathParts.length - 1] || '';
  const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  const fileNameLower = fileName.toLowerCase();

  // Rule 0: Application root files (confidence 0.95)
  // index.js, app.js, server.js, main.js are application entry points
  const rootFiles = ['index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts', 'main.js', 'main.ts'];
  if (rootFiles.includes(fileNameLower)) {
    return {
      serviceId: 'ApplicationRoot',
      serviceName: 'ApplicationRoot',
      confidence: 0.95
    };
  }

  // Rule 1.5: Route layer files (confidence 0.85)
  // routes/*.js files are routing layer, not business services
  if (normalizedPath.includes('/routes/') || normalizedPath.includes('/route/')) {
    return {
      serviceId: 'RouteLayer',
      serviceName: 'RouteLayer',
      confidence: 0.85
    };
  }

  // Rule 1: Role-based folders (confidence 0.9)
  const roleFolders = ['controller', 'controllers', 'service', 'services', 'repo', 'repos', 'repository', 'handler', 'handlers', 'usecase', 'usecases'];
  for (const roleFolder of roleFolders) {
    if (normalizedPath.includes(roleFolder)) {
      // Extract service name from filename
      // e.g., payment.controller.ts -> PaymentController
      const serviceName = fileNameWithoutExt
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      
      return {
        serviceId: serviceName,
        serviceName,
        confidence: 0.9
      };
    }
  }

  // Rule 2: Domain folder grouping (confidence 0.8)
  // Look for domain-like folders (e.g., src/payments/* -> PaymentsService)
  if (pathParts.length >= 2) {
    const domainFolder = pathParts[pathParts.length - 2];
    // Check if it's not a common folder like src, lib, etc.
    const commonFolders = ['src', 'lib', 'app', 'dist', 'build', 'test', 'tests', 'spec', 'specs'];
    if (!commonFolders.includes(domainFolder.toLowerCase())) {
      const serviceName = domainFolder
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('') + 'Service';
      
      return {
        serviceId: serviceName,
        serviceName,
        confidence: 0.8
      };
    }
  }

  // Rule 3: API folder fallback (confidence 0.6)
  if (normalizedPath.includes('api')) {
    return {
      serviceId: 'ApiService',
      serviceName: 'ApiService',
      confidence: 0.6
    };
  }

  // Rule 4: Last-resort fallback (confidence 0.4)
  const hash = createHash('md5').update(filePath).digest('hex').substring(0, 8);
  return {
    serviceId: `UnknownService_${hash}`,
    serviceName: `UnknownService_${hash}`,
    confidence: 0.4
  };
}

/**
 * Builds IR from signals
 * @param signals - Array of all extracted signals
 * @param options - Build options
 * @returns Complete IR object
 */
export function buildIR(signals: Signal[], options: BuildIROptions): IR {
  const { owner, repo, branch, totalFiles } = options;

  logger.info('Building IR from signals', {
    totalSignals: signals.length,
    totalFiles,
    owner,
    repo,
    branch
  });

  // Step 1: Infer services from file paths
  const fileToService = new Map<string, ServiceInference>();
  const serviceMap = new Map<string, { name: string; files: string[]; confidence: number }>();

  // Collect all unique files from signals
  const uniqueFiles = new Set(signals.map(s => s.file));
  
  for (const filePath of uniqueFiles) {
    const inference = inferService(filePath);
    fileToService.set(filePath, inference);
    
    if (!serviceMap.has(inference.serviceId)) {
      serviceMap.set(inference.serviceId, {
        name: inference.serviceName,
        files: [],
        confidence: inference.confidence
      });
    }
    
    serviceMap.get(inference.serviceId)!.files.push(filePath);
  }

  // Build services array
  const services: Service[] = Array.from(serviceMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    files: data.files,
    type: data.confidence >= 0.8 ? 'service' : undefined
  }));

  logger.info('Services inferred', { count: services.length });

  // Phase 5.7: Build handler → service index
  // This maps exported function names to the services they belong to
  // e.g., { login: "Auth", register: "Auth", createPost: "Posts" }
  const handlerToServiceMap = new Map<string, string>();

  // Helper: Extract exported function names from file content
  const extractExportedHandlers = (fileContent: string): string[] => {
    const handlers: string[] = [];
    
    // Pattern 1: export const handler = async (req, res) => { } or export const handler = (req, res) => {}
    const exportConstPattern = /export\s+const\s+(\w+)\s*=/g;
    let match;
    while ((match = exportConstPattern.exec(fileContent)) !== null) {
      handlers.push(match[1]);
    }
    
    // Pattern 2: export function handler() { } or export async function handler()
    const exportFuncPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
    while ((match = exportFuncPattern.exec(fileContent)) !== null) {
      handlers.push(match[1]);
    }
    
    // Pattern 3: module.exports = { handler1, handler2 } or module.exports.handler = ...
    const moduleExportsPattern = /module\.exports\s*=\s*\{([^}]+)\}/g;
    while ((match = moduleExportsPattern.exec(fileContent)) !== null) {
      const exports = match[1].split(',').map(e => e.trim().split(':')[0].trim());
      handlers.push(...exports.filter(e => e && /^\w+$/.test(e)));
    }
    
    // Pattern 4: module.exports.handler = 
    const moduleExportsDotPattern = /module\.exports\.(\w+)\s*=/g;
    while ((match = moduleExportsDotPattern.exec(fileContent)) !== null) {
      handlers.push(match[1]);
    }
    
    // Pattern 5: exports.handler = 
    const exportsDotPattern = /exports\.(\w+)\s*=/g;
    while ((match = exportsDotPattern.exec(fileContent)) !== null) {
      handlers.push(match[1]);
    }

    return handlers;
  };

  // Build handler map from controller/service files (NOT from route/model/middleware files)
  const controllerServices = services.filter(s => 
    s.id !== 'RouteLayer' && 
    s.id !== 'RoutesService' &&
    s.id !== 'ApplicationRoot' && 
    s.id !== 'ModelsService' && 
    s.id !== 'MiddlewareService'
  );

  // We need the actual file content to extract handlers
  // Use structure signals to get imports, but for handlers we need to scan the signals
  // Actually, we can use the call signals' context or infer from file paths
  
  // Alternative approach: Use entry signals and call signals to build the handler map
  // Entry signals from controller files will have handler names
  for (const signal of signals) {
    if (signal.type === 'entry') {
      const entryData = signal.data as EntrySignalData;
      if (entryData.handler) {
        const serviceInference = fileToService.get(signal.file);
        if (serviceInference && 
            serviceInference.serviceId !== 'RouteLayer' && 
            serviceInference.serviceId !== 'RoutesService' &&
            serviceInference.serviceId !== 'ApplicationRoot') {
          handlerToServiceMap.set(entryData.handler, serviceInference.serviceId);
        }
      }
    }
  }

  // Also build from structure signals - get imported names from route files
  // and map them to the services that export those functions
  for (const signal of signals) {
    if (signal.type === 'structure') {
      const structData = signal.data as { source?: string; imports?: string[] };
      const importSource = structData.source || '';
      
      // If this is a route file importing from controllers
      const fileServiceInference = fileToService.get(signal.file);
      if (fileServiceInference?.serviceId === 'RouteLayer' || fileServiceInference?.serviceId === 'RoutesService') {
        // Find which service this import points to
        for (const service of controllerServices) {
          const serviceNameLower = service.name.toLowerCase()
            .replace('service', '')
            .replace('controller', '');
          
          if (importSource.toLowerCase().includes(serviceNameLower) ||
              importSource.toLowerCase().includes(`/${serviceNameLower}`)) {
            // Map the imported function names to this service
            if (structData.imports) {
              for (const importedName of structData.imports) {
                const cleanName = importedName.trim().split(' ')[0]; // Handle "name as alias"
                if (cleanName && /^\w+$/.test(cleanName)) {
                  handlerToServiceMap.set(cleanName, service.id);
                }
              }
            }
          }
        }
      }
    }
  }

  logger.info('Handler map built', { 
    handlerCount: handlerToServiceMap.size,
    handlers: Array.from(handlerToServiceMap.entries()).slice(0, 10) // Log first 10
  });

  // Step 2: Build entryPoints array (mapped to services)
  const entryPoints: EntryPoint[] = [];
  const entrySignals = signals.filter(s => s.type === 'entry') as Array<Signal & { data: EntrySignalData }>;
  
  let entryPointCounter = 1;
  for (const signal of entrySignals) {
    const serviceInference = fileToService.get(signal.file);
    if (!serviceInference) continue;

    const entryPoint: EntryPoint = {
      id: `ep_${entryPointCounter++}`,
      serviceId: serviceInference.serviceId,
      type: signal.data.entryType || 'http',
      method: signal.data.method,
      path: signal.data.path,
      handler: signal.data.handler
    };
    
    entryPoints.push(entryPoint);
  }

  logger.info('Entry points built', { count: entryPoints.length });

  // Step 3: Build events array (grouped by name)
  const eventMap = new Map<string, { name: string; producers: Set<string>; consumers: Set<string> }>();
  
  const eventSignals = signals.filter(s => s.type === 'event') as Array<Signal & { data: EventSignalData }>;
  
  for (const signal of eventSignals) {
    const serviceInference = fileToService.get(signal.file);
    if (!serviceInference) continue;

    const eventName = signal.data.name;
    if (!eventMap.has(eventName)) {
      eventMap.set(eventName, {
        name: eventName,
        producers: new Set(),
        consumers: new Set()
      });
    }

    const event = eventMap.get(eventName)!;
    if (signal.data.role === 'producer') {
      event.producers.add(serviceInference.serviceId);
    } else if (signal.data.role === 'consumer') {
      event.consumers.add(serviceInference.serviceId);
    }
  }

  const events: Event[] = Array.from(eventMap.entries()).map(([name, data], index) => ({
    id: `evt_${index + 1}`,
    name: data.name,
    producers: Array.from(data.producers),
    consumers: Array.from(data.consumers)
  }));

  logger.info('Events built', { count: events.length });

  // Step 4: Build externals array (dedup by TYPE only, with semantic names)
  // Normalize external names to fixed semantic buckets:
  // - DB → PrimaryDatabase
  // - HTTP → ExternalHTTP
  // - Queue → MessageQueue
  const externalMap = new Map<string, { type: string; semanticName: string; usedBy: Set<string>; operations: Set<string> }>();
  
  const externalSignals = signals.filter(s => s.type === 'external') as Array<Signal & { data: ExternalSignalData }>;
  
  // Helper function to get semantic name for external type
  const getSemanticName = (type: string): string => {
    switch (type) {
      case 'db': return 'PrimaryDatabase';
      case 'http': return 'ExternalHTTP';
      case 'queue': return 'MessageQueue';
      default: return 'ExternalSystem';
    }
  };

  for (const signal of externalSignals) {
    const serviceInference = fileToService.get(signal.file);
    if (!serviceInference) continue;

    // Create dedup key: type ONLY (all db ops go to one external, all http to another, etc.)
    const externalType = signal.data.type || 'other';
    const dedupKey = externalType;

    if (!externalMap.has(dedupKey)) {
      externalMap.set(dedupKey, {
        type: externalType,
        semanticName: getSemanticName(externalType),
        usedBy: new Set(),
        operations: new Set()
      });
    }

    const external = externalMap.get(dedupKey)!;
    external.usedBy.add(serviceInference.serviceId);
    if (signal.data.operation) {
      external.operations.add(signal.data.operation);
    }
  }

  let externalCounter = 1;
  const externals: External[] = Array.from(externalMap.entries()).map(([key, data]) => ({
    id: `ext_${externalCounter++}`,
    type: data.type as 'db' | 'http' | 'queue' | 'other',
    name: data.semanticName,
    operations: Array.from(data.operations)
  }));

  logger.info('Externals built', { count: externals.length });

  // Step 5: Build flows array (one per entry point, unordered)
  // Flows are rooted at entry points and contain unordered transitions in metadata
  const flows: Flow[] = [];
  let flowCounter = 1;

  // Helper: Find ModelsService if it exists
  const modelsService = services.find(s => 
    s.id === 'ModelsService' || 
    s.name === 'ModelsService' ||
    s.files.some(f => f.toLowerCase().includes('/models/'))
  );

  // Helper: Check if a file is in the models folder
  const isModelFile = (filePath: string): boolean => {
    return filePath.toLowerCase().includes('/models/') || filePath.toLowerCase().includes('/model/');
  };

  // Helper: Find controller service using the handler → service index
  const findLinkedController = (routeFile: string, entryHandler?: string): Service | undefined => {
    // Method 1: Direct lookup in handler map (MOST RELIABLE)
    if (entryHandler && handlerToServiceMap.has(entryHandler)) {
      const serviceId = handlerToServiceMap.get(entryHandler)!;
      const service = services.find(s => s.id === serviceId);
      if (service) {
        logger.debug('Controller found via handler map', { handler: entryHandler, service: serviceId });
        return service;
      }
    }

    // Method 2: Check imports from route file and match to controller services
    const structureSignals = signals.filter(
      s => s.type === 'structure' && s.file === routeFile
    );

    for (const structSignal of structureSignals) {
      const importData = structSignal.data as { source?: string; imports?: string[] };
      const importPath = importData.source || '';
      
      // Look for controller imports (e.g., '../controllers/auth')
      for (const service of controllerServices) {
        const serviceNameLower = service.name.toLowerCase()
          .replace('service', '')
          .replace('controller', '');
        
        if (importPath.toLowerCase().includes(serviceNameLower) ||
            importPath.toLowerCase().includes(`/${serviceNameLower}`)) {
          logger.debug('Controller found via import path', { importPath, service: service.id });
          return service;
        }
      }
    }

    // Method 3: Fuzzy match handler name to service name
    if (entryHandler) {
      const handlerLower = entryHandler.toLowerCase();
      
      for (const service of controllerServices) {
        const serviceNameLower = service.name.toLowerCase()
          .replace('service', '')
          .replace('controller', '');
        
        // Match patterns:
        // - 'login' handler -> 'Auth' service (via import context)
        // - 'createPost' handler -> 'Posts' service (contains 'post')
        // - 'getUsers' handler -> 'Users' service (contains 'user')
        if (handlerLower.includes(serviceNameLower) || 
            serviceNameLower.includes(handlerLower.replace(/^(get|create|update|delete|add|remove)/, '').substring(0, 4))) {
          logger.debug('Controller found via fuzzy match', { handler: entryHandler, service: service.id });
          return service;
        }
      }
    }

    return undefined;
  };

  for (const entryPoint of entryPoints) {
    const entryService = services.find(s => s.id === entryPoint.serviceId);
    if (!entryService) continue;

    const serviceFiles = new Set(entryService.files);
    const rawSteps: Array<{ from: string; to: string; type: 'call' | 'event' | 'external'; metadata?: Record<string, any> }> = [];

    // Check if this is a route service (RouteLayer or RoutesService)
    const isRouteService = entryService.id === 'RouteLayer' || 
                           entryService.id === 'RoutesService' ||
                           entryService.files.some(f => f.toLowerCase().includes('/routes/'));

    // Phase 5.7: Route → Controller → ModelsService → DB chain
    if (isRouteService) {
      // Find which route file this entry point is in
      const routeFile = entryPoint.handler ? 
        Array.from(serviceFiles).find(f => f.toLowerCase().includes('/routes/')) || Array.from(serviceFiles)[0] :
        Array.from(serviceFiles)[0];
      
      const linkedController = findLinkedController(routeFile, entryPoint.handler);
      
      if (linkedController) {
        // Step 1: Route → Controller
        rawSteps.push({
          from: entryService.id,
          to: linkedController.id,
          type: 'call',
          metadata: { linkedVia: 'handler', handler: entryPoint.handler }
        });

        // Step 2: Find externals for this controller
        const controllerFiles = new Set(linkedController.files);
        const controllerExternals = signals.filter(
          s => s.type === 'external' && controllerFiles.has(s.file)
        ) as Array<Signal & { data: ExternalSignalData }>;

        for (const extSignal of controllerExternals) {
          const external = externals.find(e => e.type === extSignal.data.type);
          if (external) {
            // Phase 5.7: Route ALL DB operations through ModelsService
            if (external.type === 'db' && modelsService) {
              // Controller → ModelsService → PrimaryDatabase
              rawSteps.push({
                from: linkedController.id,
                to: modelsService.id,
                type: 'call',
                metadata: { via: 'model-layer' }
              });
              rawSteps.push({
                from: modelsService.id,
                to: external.id,
                type: 'external',
                metadata: { externalType: external.type, operation: extSignal.data.operation }
              });
            } else {
              // Direct: Controller → External (for HTTP, Queue, etc.)
              rawSteps.push({
                from: linkedController.id,
                to: external.id,
                type: 'external',
                metadata: { externalType: external.type, operation: extSignal.data.operation }
              });
            }
          }
        }
      } else {
        // No linked controller found - log for debugging
        logger.debug('No controller found for route', { 
          entryPoint: entryPoint.id, 
          handler: entryPoint.handler,
          routeFile 
        });
      }
    }

    // Transition 1: Service → Service (via call signals)
    const callSignals = signals.filter(
      s => s.type === 'call' && serviceFiles.has(s.file)
    ) as Array<Signal & { data: CallSignalData }>;

    for (const callSignal of callSignals) {
      // Try to find target service from the "to" field
      const targetService = services.find(s => 
        callSignal.data.to.includes(s.name) || 
        callSignal.data.to.includes(s.id) ||
        callSignal.data.to.startsWith(s.id + '.')
      );

      if (targetService && targetService.id !== entryPoint.serviceId) {
        rawSteps.push({
          from: entryPoint.serviceId,
          to: targetService.id,
          type: 'call',
          metadata: { callSignal: callSignal.data.to }
        });
      }
    }

    // Transition 2: Service → Event (via producer signals)
    const producerEvents = signals.filter(
      s => s.type === 'event' && 
           serviceFiles.has(s.file) &&
           (s.data as EventSignalData).role === 'producer'
    ) as Array<Signal & { data: EventSignalData }>;

    for (const eventSignal of producerEvents) {
      const event = events.find(e => e.name === eventSignal.data.name);
      if (event) {
        rawSteps.push({
          from: entryPoint.serviceId,
          to: event.id,
          type: 'event',
          metadata: { eventName: event.name, role: 'producer' }
        });
      }
    }

    // Transition 3: Event → Service (via consumer signals)
    for (const event of events) {
      if (event.consumers.includes(entryPoint.serviceId)) {
        rawSteps.push({
          from: event.id,
          to: entryPoint.serviceId,
          type: 'event',
          metadata: { eventName: event.name, role: 'consumer' }
        });
      }
    }

    // Transition 4: Service → External (via external signals)
    // Skip if we already handled this as part of Route → Controller linking above
    if (!isRouteService) {
      const externalSignalsForService = signals.filter(
        s => s.type === 'external' && serviceFiles.has(s.file)
      ) as Array<Signal & { data: ExternalSignalData }>;

      // Check if this is a controller service (should route DB through ModelsService)
      const isControllerService = controllerServices.some(s => s.id === entryService.id);

      for (const extSignal of externalSignalsForService) {
        const external = externals.find(e => e.type === extSignal.data.type);

        if (external) {
          // Phase 5.7: Route DB operations through ModelsService for controller services
          // But NOT for ModelsService itself (avoid circular reference)
          const shouldRouteViaModels = external.type === 'db' && 
                                        modelsService && 
                                        entryService.id !== modelsService.id &&
                                        isControllerService;

          if (shouldRouteViaModels) {
            // Controller → ModelsService → PrimaryDatabase
            rawSteps.push({
              from: entryPoint.serviceId,
              to: modelsService.id,
              type: 'call',
              metadata: { via: 'model-layer' }
            });
            rawSteps.push({
              from: modelsService.id,
              to: external.id,
              type: 'external',
              metadata: { externalType: external.type, operation: extSignal.data.operation }
            });
          } else {
            // Direct connection to external
            rawSteps.push({
              from: entryPoint.serviceId,
              to: external.id,
              type: 'external',
              metadata: { externalType: external.type, operation: extSignal.data.operation }
            });
          }
        }
      }
    }

    // Phase 5.6 Fix #3: Deduplicate steps by (from + to + type)
    const seenSteps = new Set<string>();
    const unorderedSteps = rawSteps.filter(step => {
      const key = `${step.from}:${step.to}:${step.type}`;
      if (seenSteps.has(key)) {
        return false;
      }
      seenSteps.add(key);
      return true;
    });

    // Create one flow per entry point (rooted at entry point)
    // All unordered transitions stored in metadata
    const flow: Flow = {
      id: `flow_${flowCounter++}`,
      from: entryPoint.id,
      to: entryPoint.serviceId,
      type: 'call',
      metadata: {
        entryPointId: entryPoint.id,
        serviceId: entryPoint.serviceId,
        steps: unorderedSteps, // Unordered transitions (bag of arrows)
        stepCount: unorderedSteps.length
      }
    };

    flows.push(flow);
  }

  logger.info('Flows built', { count: flows.length });

  // Build meta
  const meta: IRMeta = {
    repo,
    owner,
    branch,
    analyzedAt: new Date().toISOString(),
    totalFiles,
    totalSignals: signals.length
  };

  const ir: IR = {
    meta,
    services,
    entryPoints,
    events,
    externals,
    flows
  };

  logger.info('IR built successfully', {
    services: ir.services.length,
    entryPoints: ir.entryPoints.length,
    events: ir.events.length,
    externals: ir.externals.length,
    flows: ir.flows.length
  });

  return ir;
}
