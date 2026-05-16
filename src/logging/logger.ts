/**
 * Centralized logging configuration using Pino
 */

import pino from 'pino';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Determine log level from environment variable
const LOG_LEVEL = process.env.NORTH_STAR_LOG_LEVEL || 'info';

// Determine if we're in development mode
const _isDevelopment = process.env.NODE_ENV !== 'production';

// Get project root and ensure .north-star directory exists
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const NORTH_STAR_DIR = join(PROJECT_ROOT, '.north-star');
const LOG_FILE = join(NORTH_STAR_DIR, 'north-star.log');

// Ensure .north-star directory exists
if (!existsSync(NORTH_STAR_DIR)) {
  mkdirSync(NORTH_STAR_DIR, { recursive: true });
}

/**
 * Create the base logger with appropriate configuration
 * Logs to both console (pretty) and file (JSON)
 */
export const logger = pino({
  level: LOG_LEVEL,
  transport: {
    targets: [
      // File output (JSON formatted)
      {
        target: 'pino/file',
        options: {
          destination: LOG_FILE,
          mkdir: true,
        },
        level: 'debug', // Log more detail to file
      },
    ],
  },
  base: {
    service: 'north-star-mcp',
  },
});

// Log where the log file is
console.error(`📝 Logs: ${LOG_FILE}`);

/**
 * Create a child logger for a specific module
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

/**
 * Log levels:
 * - trace: Very detailed debugging information
 * - debug: Debugging information
 * - info: General informational messages
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors that cause the application to crash
 */

// Export commonly used loggers
export const storageLogger = createModuleLogger('storage');
export const alignmentLogger = createModuleLogger('alignment');
export const toolsLogger = createModuleLogger('tools');
export const validationLogger = createModuleLogger('validation');
