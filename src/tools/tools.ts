/**
 * MCP Tools implementation
 */

import { Storage } from '../types.js';
import { AlignmentEngine } from '../engine/alignment-engine.js';
import { ScopeValidator } from '../engine/scope-validator.js';
import { generateId } from '../utils/id-generator.js';
import type {
  MasterPlan,
  Phase,
  Milestone,
  Constraint,
  Decision,
  CurrentFocus,
  DecisionReview,
  ConstraintType,
  DecisionImpact,
  MilestoneStatus
} from '../types.js';

export class NorthStarTools {
  private storage: Storage;
  private alignmentEngine: AlignmentEngine;
  private scopeValidator: ScopeValidator;

  constructor(storage: Storage) {
    this.storage = storage;
    this.alignmentEngine = new AlignmentEngine();
    this.scopeValidator = new ScopeValidator();
  }

  /**
   * Initialize a new master plan
   */
  async initializeMasterPlan(args: {
    name: string;
    vision: string;
    successCriteria: string[];
    constraints: Array<{
      type: ConstraintType;
      description: string;
      rationale: string;
    }>;
    phases: Array<{
      name: string;
      objective: string;
      deliverables: string[];
      milestones: Array<{
        description: string;
        acceptanceCriteria: string[];
      }>;
    }>;
  }): Promise<{ planId: string; summary: string }> {
    const now = new Date().toISOString();
    const planId = generateId();

    const plan: MasterPlan = {
      id: planId,
      name: args.name,
      vision: args.vision,
      successCriteria: args.successCriteria,
      constraints: args.constraints.map(c => ({
        id: generateId(),
        type: c.type,
        description: c.description,
        rationale: c.rationale,
        createdAt: now
      })),
      phases: args.phases.map((p, index) => ({
        id: generateId(),
        name: p.name,
        objective: p.objective,
        deliverables: p.deliverables,
        status: index === 0 ? 'active' : 'pending',
        milestones: p.milestones.map(m => ({
          id: generateId(),
          description: m.description,
          acceptanceCriteria: m.acceptanceCriteria,
          status: 'pending',
          blockers: []
        })),
        ...(index === 0 ? { startedAt: now } : {})
      })),
      createdAt: now,
      updatedAt: now
    };

    await this.storage.saveMasterPlan(plan);

    return {
      planId,
      summary: `Master plan "${args.name}" created with ${args.phases.length} phases and ${args.constraints.length} constraints`
    };
  }

  /**
   * Check alignment of a task with the master plan
   */
  async checkAlignment(args: {
    currentTask: string;
    proposedApproach?: string;
  }): Promise<{
    alignmentScore: number;
    isAligned: boolean;
    warnings: string[];
    recommendations: string[];
    relevantConstraints: Constraint[];
  }> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const result = this.alignmentEngine.checkAlignment(
      args.currentTask,
      plan,
      args.proposedApproach
    );

    return {
      alignmentScore: result.score,
      isAligned: result.isAligned,
      warnings: result.warnings,
      recommendations: result.recommendations,
      relevantConstraints: result.relevantConstraints
    };
  }

  /**
   * Log a decision
   */
  async logDecision(args: {
    question: string;
    decision: string;
    rationale: string;
    impact: DecisionImpact;
    context?: string;
  }): Promise<{
    decisionId: string;
    alignmentValidated: boolean;
    conflicts: string[];
  }> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const decision: Decision = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      question: args.question,
      decision: args.decision,
      rationale: args.rationale,
      alignmentCheck: true,
      impact: args.impact,
      context: args.context
    };

    // Check for conflicts with constraints
    const conflicts: string[] = [];
    const decisionLower = args.decision.toLowerCase();
    
    for (const constraint of plan.constraints) {
      const constraintTerms = constraint.description.toLowerCase().split(/\W+/);
      if (constraintTerms.some(term => term.length > 3 && decisionLower.includes(term))) {
        conflicts.push(`May conflict with constraint: ${constraint.description}`);
      }
    }

    await this.storage.saveDecision(decision);

    return {
      decisionId: decision.id,
      alignmentValidated: true,
      conflicts
    };
  }

  /**
   * Update progress on a milestone
   */
  async updateProgress(args: {
    milestoneId: string;
    status: MilestoneStatus;
    notes?: string;
  }): Promise<{
    updated: boolean;
    nextMilestone: Milestone | null;
    overallProgress: number;
  }> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    let milestoneFound = false;
    let nextMilestone: Milestone | null = null;

    // Update the milestone
    for (const phase of plan.phases) {
      const milestoneIndex = phase.milestones.findIndex(m => m.id === args.milestoneId);
      if (milestoneIndex !== -1) {
        phase.milestones[milestoneIndex].status = args.status;
        if (args.status === 'completed') {
          phase.milestones[milestoneIndex].completedAt = new Date().toISOString();
        }
        milestoneFound = true;

        // Check if all milestones in phase are complete
        const allComplete = phase.milestones.every(m => m.status === 'completed');
        if (allComplete && phase.status === 'active') {
          phase.status = 'completed';
          phase.completedAt = new Date().toISOString();

          // Activate next phase
          const nextPhaseIndex = plan.phases.findIndex(p => p.id === phase.id) + 1;
          if (nextPhaseIndex < plan.phases.length) {
            plan.phases[nextPhaseIndex].status = 'active';
            plan.phases[nextPhaseIndex].startedAt = new Date().toISOString();
          }
        }

        // Find next pending milestone
        nextMilestone = phase.milestones.find(m => m.status === 'pending') || null;
        break;
      }
    }

    if (!milestoneFound) {
      throw new Error(`Milestone with ID ${args.milestoneId} not found`);
    }

    plan.updatedAt = new Date().toISOString();
    await this.storage.saveMasterPlan(plan);

    const metrics = await this.storage.getMetrics();

    return {
      updated: true,
      nextMilestone,
      overallProgress: metrics.progressPercentage
    };
  }

  /**
   * Validate if a feature is within scope
   */
  async validateScope(args: {
    featureDescription: string;
    justification: string;
  }): Promise<{
    inScope: boolean;
    reasoning: string;
    alternativeSuggestions: string[];
    impactedConstraints: Constraint[];
  }> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const result = this.scopeValidator.validateScope(
      args.featureDescription,
      args.justification,
      plan
    );

    return result;
  }

  /**
   * Get current focus
   */
  async getCurrentFocus(): Promise<CurrentFocus> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const currentPhase = plan.phases.find(p => p.status === 'active') || null;
    const activeMilestones = currentPhase
      ? currentPhase.milestones.filter(m => m.status === 'in_progress')
      : [];

    const priorityTasks: string[] = [];
    const blockers: string[] = [];

    if (currentPhase) {
      // Get pending milestones as priority tasks
      const pendingMilestones = currentPhase.milestones.filter(m => m.status === 'pending');
      priorityTasks.push(...pendingMilestones.map(m => m.description));

      // Collect blockers
      for (const milestone of currentPhase.milestones) {
        blockers.push(...milestone.blockers);
      }
    }

    const nextSteps: string[] = [];
    if (currentPhase) {
      nextSteps.push(`Focus on phase: ${currentPhase.name}`);
      nextSteps.push(`Objective: ${currentPhase.objective}`);
      if (priorityTasks.length > 0) {
        nextSteps.push(`Next task: ${priorityTasks[0]}`);
      }
    }

    return {
      currentPhase,
      activeMilestones,
      priorityTasks,
      blockers: [...new Set(blockers)],
      nextSteps
    };
  }

  /**
   * Add a new constraint
   */
  async addConstraint(args: {
    type: ConstraintType;
    description: string;
    rationale: string;
  }): Promise<{
    constraintId: string;
    impactedAreas: string[];
  }> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const constraint: Constraint = {
      id: generateId(),
      type: args.type,
      description: args.description,
      rationale: args.rationale,
      createdAt: new Date().toISOString()
    };

    plan.constraints.push(constraint);
    plan.updatedAt = new Date().toISOString();
    await this.storage.saveMasterPlan(plan);

    // Identify potentially impacted areas
    const impactedAreas: string[] = [];
    const constraintTerms = args.description.toLowerCase().split(/\W+/);

    for (const phase of plan.phases) {
      const phaseText = (phase.name + ' ' + phase.objective).toLowerCase();
      if (constraintTerms.some(term => term.length > 3 && phaseText.includes(term))) {
        impactedAreas.push(phase.name);
      }
    }

    return {
      constraintId: constraint.id,
      impactedAreas
    };
  }

  /**
   * Review past decisions
   */
  async reviewDecisions(args: {
    timeRange?: string;
    impactLevel?: DecisionImpact;
  }): Promise<DecisionReview> {
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    let decisions = await this.storage.getDecisions();

    // Filter by impact level if specified
    if (args.impactLevel) {
      decisions = decisions.filter(d => d.impact === args.impactLevel);
    }

    // Analyze patterns
    const patterns: string[] = [];
    const misalignments: string[] = [];
    const recommendations: string[] = [];

    // Check for constraint violations in decisions
    for (const decision of decisions) {
      const decisionLower = decision.decision.toLowerCase();
      for (const constraint of plan.constraints) {
        const constraintTerms = constraint.description.toLowerCase().split(/\W+/);
        if (constraintTerms.some(term => term.length > 3 && decisionLower.includes(term))) {
          misalignments.push(
            `Decision "${decision.decision}" may conflict with constraint: ${constraint.description}`
          );
        }
      }
    }

    // Identify patterns
    if (decisions.length > 5) {
      const highImpactCount = decisions.filter(d => d.impact === 'high').length;
      if (highImpactCount > decisions.length * 0.3) {
        patterns.push('High frequency of high-impact decisions - consider if scope is too ambitious');
      }
    }

    if (misalignments.length > 0) {
      recommendations.push('Review constraints - they may need adjustment');
      recommendations.push('Ensure future decisions are validated against constraints');
    }

    return {
      decisions,
      patterns,
      misalignments,
      recommendations
    };
  }
}