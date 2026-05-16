/**
 * File-based storage implementation with atomic writes and file locking
 */

import { promises as fs } from 'fs';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';
import * as lockfile from 'proper-lockfile';
import { MasterPlan, Decision, ProgressMetrics, CURRENT_SCHEMA_VERSION } from '../types.js';
import { BaseStorage } from './storage.js';
import { IStorage, DecisionFilter } from './storage-interface.js';
import { StorageError, CorruptionError, ValidationError } from '../errors/errors.js';
import { MasterPlanSchema, DecisionSchema } from '../validation/schemas.js';
import { ZodError } from 'zod';
import { storageLogger } from '../logging/logger.js';
import { MigrationManager } from './migrations/index.js';

export class FileStorage extends BaseStorage implements IStorage {
  private storageDir: string;
  private masterPlanPath: string;
  private decisionsPath: string;
  private metricsPath: string;
  private rulesPath: string;
  private scratchpadJsonPath: string;
  private scratchpadMdPath: string;
  private handoffPath: string;
  private migrationManager: MigrationManager;

  constructor(projectRoot: string) {
    super();
    this.storageDir = path.join(projectRoot, '.north-star');
    this.masterPlanPath = path.join(this.storageDir, 'master-plan.json');
    this.decisionsPath = path.join(this.storageDir, 'decisions.json');
    this.metricsPath = path.join(this.storageDir, 'metrics.json');
    this.rulesPath = path.join(this.storageDir, 'rules.json');
    this.scratchpadJsonPath = path.join(this.storageDir, 'scratchpad.json');
    this.scratchpadMdPath = path.join(this.storageDir, 'scratchpad.md');
    this.handoffPath = path.join(this.storageDir, 'handoff.json');
    this.migrationManager = new MigrationManager();
  }

  /**
   * Initialize storage (ensure directory exists)
   */
  async initialize(): Promise<void> {
    await this.ensureStorageDir();
    storageLogger.info({ dir: this.storageDir }, 'File storage initialized');
  }

  /**
   * Close storage (cleanup resources)
   */
  async close(): Promise<void> {
    storageLogger.info('File storage closed');
    // No resources to clean up for file storage
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
      storageLogger.trace({ dir: this.storageDir }, 'Storage directory exists');
    } catch {
      storageLogger.info({ dir: this.storageDir }, 'Creating storage directory');
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  /**
   * Read JSON file safely with validation
   */
  private async readJsonFile<T>(
    filePath: string,
    validator?: (data: unknown) => T
  ): Promise<T | null> {
    let release: (() => Promise<void>) | null = null;

    try {
      storageLogger.debug({ filePath }, 'Acquiring read lock');
      // Acquire read lock
      release = await lockfile
        .lock(filePath, {
          retries: {
            retries: 5,
            minTimeout: 100,
            maxTimeout: 1000,
          },
          stale: 10000,
        })
        .catch(() => null);

      storageLogger.debug({ filePath }, 'Reading file');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate if validator provided
      if (validator) {
        storageLogger.debug({ filePath }, 'Validating data structure');
        return validator(parsed);
      }

      return parsed as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        storageLogger.debug({ filePath }, 'File not found');
        return null;
      }

      if (error instanceof SyntaxError) {
        storageLogger.error({ filePath, error }, 'JSON corruption detected');
        throw new CorruptionError(`Failed to parse JSON from ${filePath}`, filePath, error);
      }

      if (error instanceof ZodError) {
        storageLogger.error({ filePath, errors: error.errors }, 'Validation failed');
        throw new ValidationError(`Invalid data structure in ${filePath}`, error.errors);
      }

      storageLogger.error({ filePath, error }, 'Failed to read file');
      throw new StorageError(`Failed to read ${filePath}`, error as Error);
    } finally {
      if (release) {
        await release().catch(() => {
          // Ignore unlock errors
        });
      }
    }
  }

  /**
   * Write JSON file atomically with locking
   */
  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    await this.ensureStorageDir();

    let release: (() => Promise<void>) | null = null;

    try {
      storageLogger.debug({ filePath }, 'Acquiring write lock');
      // Acquire write lock
      release = await lockfile
        .lock(filePath, {
          retries: {
            retries: 5,
            minTimeout: 100,
            maxTimeout: 1000,
          },
          stale: 10000,
        })
        .catch(() => null);

      storageLogger.debug({ filePath }, 'Writing file atomically');
      // Write atomically
      await writeFileAtomic(filePath, JSON.stringify(data, null, 2), 'utf-8');
      storageLogger.info({ filePath }, 'File written successfully');
    } catch (error) {
      storageLogger.error({ filePath, error }, 'Failed to write file');
      throw new StorageError(`Failed to write ${filePath}`, error as Error);
    } finally {
      if (release) {
        await release().catch(() => {
          // Ignore unlock errors
        });
      }
    }
  }

  async getMasterPlan(): Promise<MasterPlan | null> {
    storageLogger.info('Loading master plan');

    // Read raw data without validation first
    const raw = await this.readJsonFile<any>(this.masterPlanPath);

    if (!raw) {
      return null;
    }

    // Check if migration is needed
    const currentVersion = raw.schemaVersion || '1.0.0';

    if (this.migrationManager.needsMigration(raw)) {
      storageLogger.info(
        {
          currentVersion,
          targetVersion: CURRENT_SCHEMA_VERSION,
        },
        'Migrating master plan schema'
      );

      try {
        const migrated = this.migrationManager.migrate(raw, currentVersion);

        // Save migrated version
        await this.saveMasterPlan(migrated);

        storageLogger.info(
          {
            from: currentVersion,
            to: migrated.schemaVersion,
          },
          'Master plan migrated successfully'
        );

        // Validate and return migrated data
        return MasterPlanSchema.parse(migrated);
      } catch (error) {
        storageLogger.error({ error }, 'Migration failed');
        throw new StorageError('Failed to migrate master plan schema', error as Error);
      }
    }

    // No migration needed, just validate
    try {
      return MasterPlanSchema.parse(raw);
    } catch (error) {
      if (error instanceof ZodError) {
        storageLogger.error({ errors: error.errors }, 'Validation failed');
        throw new ValidationError('Invalid master plan structure', error.errors);
      }
      throw error;
    }
  }

  async saveMasterPlan(plan: MasterPlan): Promise<void> {
    storageLogger.info({ planId: plan.id, planName: plan.name }, 'Saving master plan');

    // Ensure schema version is set
    const planWithVersion = {
      ...plan,
      schemaVersion: plan.schemaVersion || CURRENT_SCHEMA_VERSION,
    };

    await this.writeJsonFile(this.masterPlanPath, planWithVersion);

    // Auto-update metrics when plan is saved
    const metrics = this.calculateMetrics(plan);
    await this.updateMetrics(metrics);
  }

  async getDecisions(filter?: DecisionFilter): Promise<Decision[]> {
    storageLogger.info({ filter }, 'Loading decisions');
    const data = await this.readJsonFile<{ decisions: Decision[] }>(
      this.decisionsPath,
      (data: any) => {
        if (!data || !Array.isArray(data.decisions)) {
          return { decisions: [] };
        }
        return {
          decisions: data.decisions.map((d: unknown) => DecisionSchema.parse(d)),
        };
      }
    );

    let decisions = data?.decisions || [];

    // Apply filters if provided
    if (filter) {
      if (filter.impactLevel) {
        decisions = decisions.filter((d) => d.impact === filter.impactLevel);
      }

      if (filter.after) {
        decisions = decisions.filter((d) => d.timestamp > filter.after!);
      }

      if (filter.before) {
        decisions = decisions.filter((d) => d.timestamp < filter.before!);
      }

      if (filter.limit) {
        decisions = decisions.slice(0, filter.limit);
      }
    }

    return decisions;
  }

  async getDecisionById(id: string): Promise<Decision | null> {
    storageLogger.debug({ decisionId: id }, 'Loading decision by ID');
    const decisions = await this.getDecisions();
    return decisions.find((d) => d.id === id) || null;
  }

  async saveDecision(decision: Decision): Promise<void> {
    storageLogger.info({ decisionId: decision.id, impact: decision.impact }, 'Saving decision');
    const decisions = await this.getDecisions();
    decisions.push(decision);
    await this.writeJsonFile(this.decisionsPath, { decisions });
  }

  async getMetrics(): Promise<ProgressMetrics> {
    const metrics = await this.readJsonFile<ProgressMetrics>(this.metricsPath);

    if (!metrics) {
      // If no metrics exist, calculate from master plan
      const plan = await this.getMasterPlan();
      if (plan) {
        return this.calculateMetrics(plan);
      }

      // Return empty metrics
      return {
        totalPhases: 0,
        completedPhases: 0,
        totalMilestones: 0,
        completedMilestones: 0,
        progressPercentage: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    return metrics;
  }

  async updateMetrics(metrics: ProgressMetrics): Promise<void> {
    await this.writeJsonFile(this.metricsPath, metrics);
  }

  async getRules(): Promise<import('../types.js').Rule[]> {
    const data = await this.readJsonFile<{ rules: import('../types.js').Rule[] }>(this.rulesPath);
    return data?.rules || [];
  }

  async saveRule(rule: import('../types.js').Rule): Promise<void> {
    const rules = await this.getRules();
    rules.push(rule);
    await this.writeJsonFile(this.rulesPath, { rules });
  }

  async getScratchpad(): Promise<import('../types.js').ScratchpadEntry[]> {
    const data = await this.readJsonFile<{ entries: import('../types.js').ScratchpadEntry[] }>(
      this.scratchpadJsonPath
    );
    return data?.entries || [];
  }

  async appendScratchpad(entry: import('../types.js').ScratchpadEntry): Promise<void> {
    const entries = await this.getScratchpad();
    entries.push(entry);
    await this.writeJsonFile(this.scratchpadJsonPath, { entries });

    // Also append to markdown file for readability
    const mdContent = `\n## [${entry.tag}] ${entry.timestamp}\n${entry.content}\n`;
    await fs.appendFile(this.scratchpadMdPath, mdContent, 'utf-8').catch((err) => {
      storageLogger.error({ error: err }, 'Failed to append to scratchpad markdown');
    });
  }

  async getHandoff(): Promise<import('../types.js').HandoffContext | null> {
    return await this.readJsonFile<import('../types.js').HandoffContext>(this.handoffPath);
  }

  async saveHandoff(handoff: import('../types.js').HandoffContext): Promise<void> {
    await this.writeJsonFile(this.handoffPath, handoff);
  }
}
