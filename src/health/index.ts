/**
 * Health check system for North Star MCP
 * Provides system health status and diagnostics
 */

import { IStorage } from '../storage/storage-interface.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import { createModuleLogger } from '../logging/logger.js';

const logger = createModuleLogger('health');

/**
 * Health check result for a component
 */
export interface CheckResult {
  status: 'ok' | 'error';
  message?: string;
  latency?: number;
  details?: Record<string, any>;
}

/**
 * Overall health check result
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    storage: CheckResult;
    plugins: CheckResult;
    memory: CheckResult;
  };
  timestamp: string;
  uptime: number;
  version: string;
}

/**
 * Health checker
 */
export class HealthChecker {
  private startTime = Date.now();
  private version: string;

  constructor(version: string = '2.0.0') {
    this.version = version;
  }

  /**
   * Perform complete health check
   */
  async check(storage: IStorage, plugins?: PluginRegistry): Promise<HealthCheck> {
    logger.debug('Performing health check');

    const checks = {
      storage: await this.checkStorage(storage),
      plugins: plugins ? await this.checkPlugins(plugins) : { status: 'ok' as const },
      memory: this.checkMemory(),
    };

    // Determine overall status
    const hasError = Object.values(checks).some((c) => c.status === 'error');
    const status = hasError ? 'unhealthy' : 'healthy';

    const result: HealthCheck = {
      status,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: this.version,
    };

    logger.info({ status, uptime: result.uptime }, 'Health check completed');

    return result;
  }

  /**
   * Check storage health
   */
  private async checkStorage(storage: IStorage): Promise<CheckResult> {
    const start = Date.now();

    try {
      // Try to read master plan
      await storage.getMasterPlan();

      const latency = Date.now() - start;

      return {
        status: 'ok',
        message: 'Storage is accessible',
        latency,
        details: {
          type: storage.constructor.name,
        },
      };
    } catch (error) {
      const latency = Date.now() - start;

      logger.error({ error }, 'Storage health check failed');

      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Storage check failed',
        latency,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Check plugins health
   */
  private async checkPlugins(plugins: PluginRegistry): Promise<CheckResult> {
    try {
      const registeredPlugins = plugins.getPlugins();

      return {
        status: 'ok',
        message: 'Plugins are operational',
        details: {
          count: registeredPlugins.length,
          plugins: registeredPlugins.map((p) => ({
            name: p.name,
            version: p.version,
          })),
        },
      };
    } catch (error) {
      logger.error({ error }, 'Plugin health check failed');

      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Plugin check failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): CheckResult {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    // Consider unhealthy if heap usage > 90%
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    const status = heapUsagePercent > 90 ? 'error' : 'ok';

    return {
      status,
      message: status === 'ok' ? 'Memory usage is normal' : 'High memory usage detected',
      details: {
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        rss: `${rssMB} MB`,
        heapUsagePercent: `${heapUsagePercent.toFixed(1)}%`,
      },
    };
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset start time (useful for testing)
   */
  resetUptime(): void {
    this.startTime = Date.now();
  }
}
