import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeController } from './api/analyze.controller';
import { logger, logRequest } from './utils/logger';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.path, res.statusCode, duration);
  });
  
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/analyze-repo', analyzeController);

// Health check
app.get('/health', (req: Request, res: Response) => {
  logger.debug('Health check requested');
  res.json({ status: 'ok', message: 'RepoLens Backend is running' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 RepoLens Backend running on http://localhost:${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'debug'
  });
});
