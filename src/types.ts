/**
 * Core type definitions for the North Star MCP
 */

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export type ConstraintType = 'scope' | 'technical' | 'time' | 'complexity';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';
export type PhaseStatus = 'pending' | 'active' | 'completed';
export type DecisionImpact = 'low' | 'medium' | 'high';
export type RuleSeverity = 'warn' | 'error';

/**
 * A constraint that prevents scope creep
 */
export interface Constraint {
  id: string;
  type: ConstraintType;
  description: string;
  rationale: string;
  createdAt: string;
}

/**
 * A milestone within a phase
 */
export interface Milestone {
  id: string;
  description: string;
  acceptanceCriteria: string[];
  status: MilestoneStatus;
  blockers: string[];
  completedAt?: string;
}

/**
 * A phase of the project
 */
export interface Phase {
  id: string;
  name: string;
  objective: string;
  deliverables: string[];
  status: PhaseStatus;
  milestones: Milestone[];
  startedAt?: string;
  completedAt?: string;
}

/**
 * The master plan for the project
 */
export interface MasterPlan {
  schemaVersion?: string; // Optional for backward compatibility, defaults to '1.0.0'
  id: string;
  name: string;
  vision: string;
  successCriteria: string[];
  constraints: Constraint[];
  phases: Phase[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A logged decision
 */
export interface Decision {
  id: string;
  timestamp: string;
  question: string;
  decision: string;
  rationale: string;
  alignmentCheck: boolean;
  impact: DecisionImpact;
  context?: string;
}

/**
 * Result of an alignment check
 */
export interface AlignmentResult {
  score: number;
  isAligned: boolean;
  warnings: string[];
  recommendations: string[];
  relevantConstraints: Constraint[];
}

/**
 * Current focus information
 */
export interface CurrentFocus {
  currentPhase: Phase | null;
  activeMilestones: Milestone[];
  priorityTasks: string[];
  blockers: string[];
  nextSteps: string[];
}

/**
 * Progress metrics
 */
export interface ProgressMetrics {
  totalPhases: number;
  completedPhases: number;
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
  lastUpdated: string;
}

/**
 * Scope validation result
 */
export interface ScopeValidationResult {
  inScope: boolean;
  reasoning: string;
  alternativeSuggestions: string[];
  impactedConstraints: Constraint[];
}

/**
 * Decision review result
 */
export interface DecisionReview {
  decisions: Decision[];
  patterns: string[];
  misalignments: string[];
  recommendations: string[];
}

/**
 * A codebase rule
 */
export interface Rule {
  id: string;
  description: string;
  rationale: string;
  severity: RuleSeverity;
  createdAt: string;
}

/**
 * A scratchpad entry
 */
export interface ScratchpadEntry {
  id: string;
  timestamp: string;
  tag: string;
  content: string;
}

/**
 * A handoff context
 */
export interface HandoffContext {
  timestamp: string;
  summary: string;
  brokenFeatures: string[];
  nextSteps: string[];
}

/**
 * Storage interface
 */
export interface Storage {
  getMasterPlan(): Promise<MasterPlan | null>;
  saveMasterPlan(plan: MasterPlan): Promise<void>;
  getDecisions(): Promise<Decision[]>;
  saveDecision(decision: Decision): Promise<void>;
  getMetrics(): Promise<ProgressMetrics>;
  updateMetrics(metrics: ProgressMetrics): Promise<void>;

  getRules(): Promise<Rule[]>;
  saveRule(rule: Rule): Promise<void>;

  getScratchpad(): Promise<ScratchpadEntry[]>;
  appendScratchpad(entry: ScratchpadEntry): Promise<void>;

  getHandoff(): Promise<HandoffContext | null>;
  saveHandoff(handoff: HandoffContext): Promise<void>;
}
