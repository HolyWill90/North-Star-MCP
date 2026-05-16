/**
 * Prometheus metrics for North Star MCP
 * Provides observability into system operations
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { createModuleLogger } from '../logging/logger.js';

const logger = createModuleLogger('metrics');

/**
 * Metrics registry
 */
export const registry = new Registry();

// Add default metrics (process CPU, memory, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register: registry });

/**
 * Tool invocation metrics
 */
export const toolInvocations = new Counter({
  name: 'north_star_tool_invocations_total',
  help: 'Total number of tool invocations',
  labelNames: ['tool', 'status'],
  registers: [registry],
});

export const toolDuration = new Histogram({
  name: 'north_star_tool_duration_seconds',
  help: 'Duration of tool execution in seconds',
  labelNames: ['tool'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

/**
 * Alignment metrics
 */
export const alignmentScores = new Histogram({
  name: 'north_star_alignment_score',
  help: 'Distribution of alignment scores',
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [registry],
});

export const alignmentChecks = new Counter({
  name: 'north_star_alignment_checks_total',
  help: 'Total number of alignment checks',
  labelNames: ['aligned'],
  registers: [registry],
});

export const constraintViolations = new Counter({
  name: 'north_star_constraint_violations_total',
  help: 'Total number of constraint violations detected',
  labelNames: ['constraint_type'],
  registers: [registry],
});

/**
 * Storage metrics
 */
export const storageOperations = new Counter({
  name: 'north_star_storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation', 'status'],
  registers: [registry],
});

export const storageOperationDuration = new Histogram({
  name: 'north_star_storage_operation_duration_seconds',
  help: 'Duration of storage operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

/**
 * Project metrics
 */
export const projectProgress = new Gauge({
  name: 'north_star_project_progress_percentage',
  help: 'Overall project completion percentage',
  registers: [registry],
});

export const totalMilestones = new Gauge({
  name: 'north_star_total_milestones',
  help: 'Total number of milestones in the project',
  registers: [registry],
});

export const completedMilestones = new Gauge({
  name: 'north_star_completed_milestones',
  help: 'Number of completed milestones',
  registers: [registry],
});

export const activeMilestones = new Gauge({
  name: 'north_star_active_milestones',
  help: 'Number of milestones currently in progress',
  registers: [registry],
});

export const totalPhases = new Gauge({
  name: 'north_star_total_phases',
  help: 'Total number of phases in the project',
  registers: [registry],
});

export const completedPhases = new Gauge({
  name: 'north_star_completed_phases',
  help: 'Number of completed phases',
  registers: [registry],
});

/**
 * Decision metrics
 */
export const decisionsLogged = new Counter({
  name: 'north_star_decisions_logged_total',
  help: 'Total number of decisions logged',
  labelNames: ['impact'],
  registers: [registry],
});

/**
 * Plugin metrics
 */
export const pluginsRegistered = new Gauge({
  name: 'north_star_plugins_registered',
  help: 'Number of registered plugins',
  registers: [registry],
});

export const pluginHookExecutions = new Counter({
  name: 'north_star_plugin_hook_executions_total',
  help: 'Total number of plugin hook executions',
  labelNames: ['hook', 'status'],
  registers: [registry],
});

/**
 * Initialize metrics with current state
 */
export function initializeMetrics(): void {
  logger.info('Metrics initialized');
}

/**
 * Get metrics as Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  return registry.metrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  registry.resetMetrics();
  logger.debug('Metrics reset');
}
