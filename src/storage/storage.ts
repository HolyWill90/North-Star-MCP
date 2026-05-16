/**
 * Storage abstraction for the North Star MCP
 */

import { MasterPlan, Decision, ProgressMetrics, Storage } from '../types.js';

export abstract class BaseStorage implements Storage {
  abstract getMasterPlan(): Promise<MasterPlan | null>;
  abstract saveMasterPlan(plan: MasterPlan): Promise<void>;
  abstract getDecisions(): Promise<Decision[]>;
  abstract saveDecision(decision: Decision): Promise<void>;
  abstract getMetrics(): Promise<ProgressMetrics>;
  abstract updateMetrics(metrics: ProgressMetrics): Promise<void>;

  abstract getRules(): Promise<import('../types.js').Rule[]>;
  abstract saveRule(rule: import('../types.js').Rule): Promise<void>;

  abstract getScratchpad(): Promise<import('../types.js').ScratchpadEntry[]>;
  abstract appendScratchpad(entry: import('../types.js').ScratchpadEntry): Promise<void>;

  abstract getHandoff(): Promise<import('../types.js').HandoffContext | null>;
  abstract saveHandoff(handoff: import('../types.js').HandoffContext): Promise<void>;

  /**
   * Calculate progress metrics from a master plan
   */
  protected calculateMetrics(plan: MasterPlan): ProgressMetrics {
    const totalPhases = plan.phases.length;
    const completedPhases = plan.phases.filter((p) => p.status === 'completed').length;

    const totalMilestones = plan.phases.reduce((sum, phase) => sum + phase.milestones.length, 0);
    const completedMilestones = plan.phases.reduce(
      (sum, phase) => sum + phase.milestones.filter((m) => m.status === 'completed').length,
      0
    );

    const progressPercentage =
      totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    return {
      totalPhases,
      completedPhases,
      totalMilestones,
      completedMilestones,
      progressPercentage,
      lastUpdated: new Date().toISOString(),
    };
  }
}
