import { MasterPlan, Decision, ProgressMetrics, DecisionImpact } from '../types.js';

/**
 * Filter options for querying decisions
 */
export interface DecisionFilter {
  impactLevel?: DecisionImpact;
  after?: string;
  before?: string;
  limit?: number;
}

/**
 * Storage interface for persisting North Star data
 * Implementations can use files, databases, or in-memory storage
 */
export interface IStorage {
  // Master Plan operations
  getMasterPlan(): Promise<MasterPlan | null>;
  saveMasterPlan(plan: MasterPlan): Promise<void>;

  // Decision operations
  getDecisions(filter?: DecisionFilter): Promise<Decision[]>;
  saveDecision(decision: Decision): Promise<void>;
  getDecisionById(id: string): Promise<Decision | null>;

  // Metrics operations
  getMetrics(): Promise<ProgressMetrics>;
  updateMetrics(metrics: ProgressMetrics): Promise<void>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}
