/**
 * Configuration management for North Star MCP
 * Loads configuration from environment variables with sensible defaults
 */

import { z } from 'zod';
import { createModuleLogger } from '../logging/logger.js';

const logger = createModuleLogger('config');

/**
 * Configuration schema with validation
 */
const ConfigSchema = z.object({
  // Storage configuration
  storage: z.object({
    type: z.enum(['file', 'memory']).default('file'),
    path: z.string().default('.north-star'),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    format: z.enum(['pretty', 'json']).default('pretty'),
  }),

  // Alignment engine configuration
  alignment: z.object({
    threshold: z.number().min(0).max(100).default(70),
    weights: z.object({
      vision: z.number().min(0).max(1).default(0.4),
      constraints: z.number().min(0).max(1).default(0.3),
      phase: z.number().min(0).max(1).default(0.2),
      criteria: z.number().min(0).max(1).default(0.1),
    }),
  }),

  // Feature flags
  features: z.object({
    autoBackup: z.boolean().default(true),
    strictValidation: z.boolean().default(true),
    auditLog: z.boolean().default(false),
  }),

  // Plugin configuration
  plugins: z.object({
    enabled: z.boolean().default(true),
    paths: z.array(z.string()).default([]),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const config = {
    storage: {
      type: (process.env.NORTH_STAR_STORAGE_TYPE as 'file' | 'memory') || 'file',
      path: process.env.NORTH_STAR_STORAGE_PATH || '.north-star',
    },
    logging: {
      level: (process.env.NORTH_STAR_LOG_LEVEL as any) || 'info',
      format: (process.env.NORTH_STAR_LOG_FORMAT as 'pretty' | 'json') || 'pretty',
    },
    alignment: {
      threshold: parseInt(process.env.NORTH_STAR_ALIGNMENT_THRESHOLD || '70'),
      weights: {
        vision: parseFloat(process.env.NORTH_STAR_WEIGHT_VISION || '0.4'),
        constraints: parseFloat(process.env.NORTH_STAR_WEIGHT_CONSTRAINTS || '0.3'),
        phase: parseFloat(process.env.NORTH_STAR_WEIGHT_PHASE || '0.2'),
        criteria: parseFloat(process.env.NORTH_STAR_WEIGHT_CRITERIA || '0.1'),
      },
    },
    features: {
      autoBackup: process.env.NORTH_STAR_AUTO_BACKUP !== 'false',
      strictValidation: process.env.NORTH_STAR_STRICT_VALIDATION !== 'false',
      auditLog: process.env.NORTH_STAR_AUDIT_LOG === 'true',
    },
    plugins: {
      enabled: process.env.NORTH_STAR_PLUGINS_ENABLED !== 'false',
      paths: process.env.NORTH_STAR_PLUGINS?.split(',').filter(Boolean) || [],
    },
  };

  try {
    const validated = ConfigSchema.parse(config);
    logger.info({ config: validated }, 'Configuration loaded');
    return validated;
  } catch (error) {
    logger.error({ error }, 'Invalid configuration, using defaults');
    // Return defaults on validation error
    return ConfigSchema.parse({});
  }
}

/**
 * Global configuration instance
 */
export const config = loadConfig();

/**
 * Reload configuration (useful for testing)
 */
export function reloadConfig(): Config {
  const newConfig = loadConfig();
  Object.assign(config, newConfig);
  return config;
}
