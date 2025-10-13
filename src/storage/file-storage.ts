/**
 * File-based storage implementation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { MasterPlan, Decision, ProgressMetrics } from '../types.js';
import { BaseStorage } from './storage.js';

export class FileStorage extends BaseStorage {
  private storageDir: string;
  private masterPlanPath: string;
  private decisionsPath: string;
  private metricsPath: string;

  constructor(projectRoot: string) {
    super();
    this.storageDir = path.join(projectRoot, '.north-star');
    this.masterPlanPath = path.join(this.storageDir, 'master-plan.json');
    this.decisionsPath = path.join(this.storageDir, 'decisions.json');
    this.metricsPath = path.join(this.storageDir, 'metrics.json');
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  /**
   * Read JSON file safely
   */
  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write JSON file safely
   */
  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async getMasterPlan(): Promise<MasterPlan | null> {
    return this.readJsonFile<MasterPlan>(this.masterPlanPath);
  }

  async saveMasterPlan(plan: MasterPlan): Promise<void> {
    await this.writeJsonFile(this.masterPlanPath, plan);
    
    // Auto-update metrics when plan is saved
    const metrics = this.calculateMetrics(plan);
    await this.updateMetrics(metrics);
  }

  async getDecisions(): Promise<Decision[]> {
    const data = await this.readJsonFile<{ decisions: Decision[] }>(this.decisionsPath);
    return data?.decisions || [];
  }

  async saveDecision(decision: Decision): Promise<void> {
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
        lastUpdated: new Date().toISOString()
      };
    }
    
    return metrics;
  }

  async updateMetrics(metrics: ProgressMetrics): Promise<void> {
    await this.writeJsonFile(this.metricsPath, metrics);
  }
}