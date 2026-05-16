/**
 * In-memory storage implementation for testing
 */

import { MasterPlan, Decision, ProgressMetrics } from '../types.js';
import { BaseStorage } from './storage.js';
import { IStorage, DecisionFilter } from './storage-interface.js';
import { storageLogger } from '../logging/logger.js';

export class MemoryStorage extends BaseStorage implements IStorage {
  private plan: MasterPlan | null = null;
  private decisions: Decision[] = [];
  private metrics: ProgressMetrics;
  private rules: import('../types.js').Rule[] = [];
  private scratchpad: import('../types.js').ScratchpadEntry[] = [];
  private handoff: import('../types.js').HandoffContext | null = null;

  constructor() {
    super();
    this.metrics = {
      totalPhases: 0,
      completedPhases: 0,
      totalMilestones: 0,
      completedMilestones: 0,
      progressPercentage: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async initialize(): Promise<void> {
    storageLogger.info('Memory storage initialized');
  }

  async close(): Promise<void> {
    storageLogger.info('Memory storage closed');
    // Clear data on close
    this.plan = null;
    this.decisions = [];
  }

  async getMasterPlan(): Promise<MasterPlan | null> {
    return this.plan;
  }

  async saveMasterPlan(plan: MasterPlan): Promise<void> {
    this.plan = plan;

    // Auto-update metrics
    this.metrics = this.calculateMetrics(plan);
  }

  async getDecisions(filter?: DecisionFilter): Promise<Decision[]> {
    let result = [...this.decisions];

    if (filter) {
      if (filter.impactLevel) {
        result = result.filter((d) => d.impact === filter.impactLevel);
      }

      if (filter.after) {
        result = result.filter((d) => d.timestamp > filter.after!);
      }

      if (filter.before) {
        result = result.filter((d) => d.timestamp < filter.before!);
      }

      if (filter.limit) {
        result = result.slice(0, filter.limit);
      }
    }

    return result;
  }

  async saveDecision(decision: Decision): Promise<void> {
    this.decisions.push(decision);
  }

  async getDecisionById(id: string): Promise<Decision | null> {
    return this.decisions.find((d) => d.id === id) || null;
  }

  async getMetrics(): Promise<ProgressMetrics> {
    return { ...this.metrics };
  }

  async updateMetrics(metrics: ProgressMetrics): Promise<void> {
    this.metrics = { ...metrics };
  }

  async getRules(): Promise<import('../types.js').Rule[]> {
    return [...this.rules];
  }

  async saveRule(rule: import('../types.js').Rule): Promise<void> {
    this.rules.push(rule);
  }

  async getScratchpad(): Promise<import('../types.js').ScratchpadEntry[]> {
    return [...this.scratchpad];
  }

  async appendScratchpad(entry: import('../types.js').ScratchpadEntry): Promise<void> {
    this.scratchpad.push(entry);
  }

  async getHandoff(): Promise<import('../types.js').HandoffContext | null> {
    return this.handoff;
  }

  async saveHandoff(handoff: import('../types.js').HandoffContext): Promise<void> {
    this.handoff = handoff;
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.plan = null;
    this.decisions = [];
    this.rules = [];
    this.scratchpad = [];
    this.handoff = null;
    this.metrics = {
      totalPhases: 0,
      completedPhases: 0,
      totalMilestones: 0,
      completedMilestones: 0,
      progressPercentage: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
