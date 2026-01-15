import winston from 'winston';

/**
 * Logger Configuration
 * 
 * Provides structured logging throughout the application
 * - Console output for development
 * - File logging for production
 * - Different log levels based on environment
 */

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create base transports (file transports are always included)
const transports: winston.transport[] = [
  // Write all logs with level 'error' and below to error.log
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: logFormat
  }),
  // Write all logs to combined.log
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: logFormat
  })
];

// Add console transport with appropriate format based on environment
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
  })
);

// Create the logger
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'repolens-backend' },
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log', format: logFormat })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log', format: logFormat })
  ]
});

// Helper methods for common logging patterns
export const logRequest = (method: string, path: string, statusCode: number, duration: number) => {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    duration: `${duration}ms`
  });
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export const logPhase = (phase: string, message: string, data?: Record<string, any>) => {
  logger.info(`[Phase ${phase}] ${message}`, data || {});
};

export const logSignal = (type: string, count: number, file?: string) => {
  logger.debug('Signal extracted', {
    type,
    count,
    file
  });
};
