/**
 * MCP Tools implementation
 */

import { Storage } from '../types.js';
import { AlignmentEngine } from '../engine/alignment-engine.js';
import { ScopeValidator } from '../engine/scope-validator.js';
import { generateId } from '../utils/id-generator.js';
import { toolsLogger } from '../logging/logger.js';
import { LLMClient } from '../engine/llm-client.js';
import { SessionManager } from './session-manager.js';
import {
  ProjectContext,
  calculateContextScore,
  identifyMissingInfo,
  generateFollowUpQuestions,
  generateMasterPlanFromContext,
  hasEnoughContext,
} from './init-plan-tool.js';
import type {
  MasterPlan,
  Milestone,
  Constraint,
  Decision,
  CurrentFocus,
  DecisionReview,
  ConstraintType,
  DecisionImpact,
  MilestoneStatus,
} from '../types.js';

export class NorthStarTools {
  private storage: Storage;
  private alignmentEngine: AlignmentEngine;
  private scopeValidator: ScopeValidator;
  private sessionManager: SessionManager;
  private projectRoot: string;

  constructor(storage: Storage, projectRoot?: string) {
    this.storage = storage;
    this.alignmentEngine = new AlignmentEngine();
    this.scopeValidator = new ScopeValidator();
    this.projectRoot = projectRoot || process.cwd();
    this.sessionManager = new SessionManager(storage, this.projectRoot);
  }

  /**
   * AI-assisted master plan initialization
   * Analyzes context and creates intelligent plan
   * Automatically archives old session data
   */
  async initMasterPlan(args: { context: ProjectContext }): Promise<{
    success: boolean;
    planId?: string;
    summary?: string;
    contextScore: number;
    missingInfo: string[];
    followUpQuestions?: string[];
    message: string;
    sessionCleared?: boolean;
    archivePath?: string;
  }> {
    const context = args.context;

    // Calculate context score
    const contextScore = calculateContextScore(context);
    const missingInfo = identifyMissingInfo(context);

    toolsLogger.info(
      { contextScore, missingInfoCount: missingInfo.length },
      'Analyzing project context'
    );

    // Check if we have enough context
    if (!hasEnoughContext(context)) {
      const questions = generateFollowUpQuestions(context);

      toolsLogger.info(
        { questionsGenerated: questions.length },
        'Insufficient context - generating follow-up questions'
      );

      return {
        success: false,
        contextScore,
        missingInfo,
        followUpQuestions: questions,
        message: `Need more information to create master plan (${contextScore}% complete). Please provide: ${missingInfo.join(', ')}`,
      };
    }

    // Check if we should clear old session
    const existingPlan = await this.storage.getMasterPlan();
    let sessionCleared = false;
    let archivePath: string | undefined;

    if (existingPlan) {
      toolsLogger.info(
        { oldProject: existingPlan.name, newProject: context.projectName },
        'Existing master plan found - archiving before creating new one'
      );

      const clearResult = await this.sessionManager.clearSession(
        true,
        `New project started: ${context.projectName}`
      );

      sessionCleared = true;
      archivePath = clearResult.archivePath;

      toolsLogger.info(
        { archived: clearResult.archived, filesCleared: clearResult.filesCleared.length },
        'Old session cleared and archived'
      );
    }

    // Generate master plan from context
    toolsLogger.info('Sufficient context gathered - generating master plan');
    const plan = await generateMasterPlanFromContext(context);

    // Save the plan
    await this.storage.saveMasterPlan(plan);

    toolsLogger.info(
      { planId: plan.id, name: plan.name, sessionCleared },
      'Master plan created successfully from context'
    );

    return {
      success: true,
      planId: plan.id,
      summary: `Master plan "${plan.name}" created with ${plan.phases.length} phases and ${plan.constraints.length} constraints${sessionCleared ? ' (previous session archived)' : ''}`,
      contextScore,
      missingInfo: [],
      message:
        'Master plan created successfully! The AI gathered sufficient context through conversation.',
      sessionCleared,
      archivePath,
    };
  }

  /**
   * Initialize a new master plan (manual mode)
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
    toolsLogger.info(
      { name: args.name, phaseCount: args.phases.length },
      'Initializing master plan'
    );
    const now = new Date().toISOString();
    const planId = generateId();

    const plan: MasterPlan = {
      id: planId,
      name: args.name,
      vision: args.vision,
      successCriteria: args.successCriteria,
      constraints: args.constraints.map((c) => ({
        id: generateId(),
        type: c.type,
        description: c.description,
        rationale: c.rationale,
        createdAt: now,
      })),
      phases: args.phases.map((p, index) => ({
        id: generateId(),
        name: p.name,
        objective: p.objective,
        deliverables: p.deliverables,
        status: index === 0 ? 'active' : 'pending',
        milestones: p.milestones.map((m) => ({
          id: generateId(),
          description: m.description,
          acceptanceCriteria: m.acceptanceCriteria,
          status: 'pending',
          blockers: [],
        })),
        ...(index === 0 ? { startedAt: now } : {}),
      })),
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveMasterPlan(plan);

    toolsLogger.info({ planId, name: args.name }, 'Master plan initialized successfully');
    return {
      planId,
      summary: `Master plan "${args.name}" created with ${args.phases.length} phases and ${args.constraints.length} constraints`,
    };
  }

  /**
   * Check alignment of a task with the master plan
   */
  async checkAlignment(args: { currentTask: string; proposedApproach?: string }): Promise<{
    alignmentScore: number;
    isAligned: boolean;
    warnings: string[];
    recommendations: string[];
    relevantConstraints: Constraint[];
  }> {
    toolsLogger.info({ task: args.currentTask }, 'Checking task alignment');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const rules = await this.storage.getRules();

    const result = await this.alignmentEngine.checkAlignment(
      args.currentTask,
      plan,
      rules,
      args.proposedApproach
    );

    return {
      alignmentScore: result.score,
      isAligned: result.isAligned,
      warnings: result.warnings,
      recommendations: result.recommendations,
      relevantConstraints: result.relevantConstraints,
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
    toolsLogger.info({ question: args.question, impact: args.impact }, 'Logging decision');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
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
      context: args.context,
    };

    // Check for conflicts with constraints using the LLM
    const llm = new LLMClient();
    const conflicts: string[] = await llm.checkDecisionConflicts(args.decision, plan);

    await this.storage.saveDecision(decision);

    toolsLogger.info(
      { decisionId: decision.id, conflictCount: conflicts.length },
      'Decision logged'
    );
    return {
      decisionId: decision.id,
      alignmentValidated: true,
      conflicts,
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
    toolsLogger.info(
      { milestoneId: args.milestoneId, status: args.status },
      'Updating milestone progress'
    );
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    let milestoneFound = false;
    let nextMilestone: Milestone | null = null;

    // Update the milestone
    for (let pIndex = 0; pIndex < plan.phases.length; pIndex++) {
      const phase = plan.phases[pIndex];
      const milestoneIndex = phase.milestones.findIndex((m) => m.id === args.milestoneId);
      if (milestoneIndex !== -1) {
        phase.milestones[milestoneIndex].status = args.status;
        if (args.status === 'completed') {
          phase.milestones[milestoneIndex].completedAt = new Date().toISOString();
        }
        milestoneFound = true;

        // Check if all milestones in phase are complete
        const allComplete = phase.milestones.every((m) => m.status === 'completed');
        if (allComplete && phase.status === 'active') {
          phase.status = 'completed';
          phase.completedAt = new Date().toISOString();

          // Activate next phase using the current index
          const nextPhaseIndex = pIndex + 1;
          if (nextPhaseIndex < plan.phases.length) {
            plan.phases[nextPhaseIndex].status = 'active';
            plan.phases[nextPhaseIndex].startedAt = new Date().toISOString();
          }
        }

        // Find next pending milestone
        nextMilestone = phase.milestones.find((m) => m.status === 'pending') || null;
        break;
      }
    }

    if (!milestoneFound) {
      toolsLogger.error({ milestoneId: args.milestoneId }, 'Milestone not found');
      throw new Error(`Milestone with ID ${args.milestoneId} not found`);
    }

    plan.updatedAt = new Date().toISOString();
    await this.storage.saveMasterPlan(plan);

    const metrics = await this.storage.getMetrics();

    toolsLogger.info(
      { milestoneId: args.milestoneId, progress: metrics.progressPercentage },
      'Progress updated'
    );
    return {
      updated: true,
      nextMilestone,
      overallProgress: metrics.progressPercentage,
    };
  }

  /**
   * Validate if a feature is within scope
   */
  async validateScope(args: { featureDescription: string; justification: string }): Promise<{
    inScope: boolean;
    reasoning: string;
    alternativeSuggestions: string[];
    impactedConstraints: Constraint[];
  }> {
    toolsLogger.info({ feature: args.featureDescription }, 'Validating scope');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const result = await this.scopeValidator.validateScope(
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
    toolsLogger.info('Getting current focus');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const currentPhase = plan.phases.find((p) => p.status === 'active') || null;
    const activeMilestones = currentPhase
      ? currentPhase.milestones.filter((m) => m.status === 'in_progress')
      : [];

    const priorityTasks: string[] = [];
    const blockers: string[] = [];

    if (currentPhase) {
      // Get pending milestones as priority tasks
      const pendingMilestones = currentPhase.milestones.filter((m) => m.status === 'pending');
      priorityTasks.push(...pendingMilestones.map((m) => m.description));

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
      nextSteps,
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
    toolsLogger.info({ type: args.type, description: args.description }, 'Adding constraint');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    const constraint: Constraint = {
      id: generateId(),
      type: args.type,
      description: args.description,
      rationale: args.rationale,
      createdAt: new Date().toISOString(),
    };

    plan.constraints.push(constraint);
    plan.updatedAt = new Date().toISOString();
    await this.storage.saveMasterPlan(plan);

    // Identify potentially impacted areas
    const impactedAreas: string[] = [];
    const constraintTerms = args.description.toLowerCase().split(/\W+/);

    for (const phase of plan.phases) {
      const phaseText = (phase.name + ' ' + phase.objective).toLowerCase();
      if (constraintTerms.some((term) => term.length > 3 && phaseText.includes(term))) {
        impactedAreas.push(phase.name);
      }
    }

    toolsLogger.info(
      { constraintId: constraint.id, impactedCount: impactedAreas.length },
      'Constraint added'
    );
    return {
      constraintId: constraint.id,
      impactedAreas,
    };
  }

  /**
   * Review past decisions
   */
  async reviewDecisions(args: {
    timeRange?: string;
    impactLevel?: DecisionImpact;
  }): Promise<DecisionReview> {
    toolsLogger.info({ impactLevel: args.impactLevel }, 'Reviewing decisions');
    const plan = await this.storage.getMasterPlan();
    if (!plan) {
      toolsLogger.error('No master plan found');
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    let decisions = await this.storage.getDecisions();

    // Filter by impact level if specified
    if (args.impactLevel) {
      decisions = decisions.filter((d) => d.impact === args.impactLevel);
    }

    // Analyze patterns
    const patterns: string[] = [];
    const misalignments: string[] = [];
    const recommendations: string[] = [];

    // Check for constraint violations in decisions
    for (const decision of decisions) {
      const decisionLower = decision.decision.toLowerCase();
      for (const constraint of plan.constraints) {
        const constraintTerms = constraint.description
          .toLowerCase()
          .split(/\W+/)
          .filter((t) => t.length > 0);
        if (constraintTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(decisionLower))) {
          misalignments.push(
            `Decision "${decision.decision}" may conflict with constraint: ${constraint.description}`
          );
        }
      }
    }

    // Identify patterns
    if (decisions.length > 5) {
      const highImpactCount = decisions.filter((d) => d.impact === 'high').length;
      if (highImpactCount > decisions.length * 0.3) {
        patterns.push(
          'High frequency of high-impact decisions - consider if scope is too ambitious'
        );
      }
    }

    if (misalignments.length > 0) {
      recommendations.push('Review constraints - they may need adjustment');
      recommendations.push('Ensure future decisions are validated against constraints');
    }

    toolsLogger.info(
      {
        decisionCount: decisions.length,
        patternCount: patterns.length,
        misalignmentCount: misalignments.length,
      },
      'Decision review complete'
    );
    return {
      decisions,
      patterns,
      misalignments,
      recommendations,
    };
  }

  /**
   * Reset session - clear all data and optionally archive
   */
  async resetSession(args: { archive?: boolean; reason?: string }): Promise<{
    success: boolean;
    archived: boolean;
    archivePath?: string;
    filesCleared: string[];
    message: string;
  }> {
    const archive = args.archive !== false; // Default to true
    const reason = args.reason || 'Manual session reset';

    toolsLogger.info({ archive, reason }, 'Resetting session');

    try {
      const result = await this.sessionManager.clearSession(archive, reason);

      toolsLogger.info(
        {
          archived: result.archived,
          filesCleared: result.filesCleared.length,
        },
        'Session reset successfully'
      );

      return {
        success: true,
        archived: result.archived,
        archivePath: result.archivePath,
        filesCleared: result.filesCleared,
        message: `Session reset successfully. ${result.filesCleared.length} files cleared${result.archived ? ' and archived' : ''}.`,
      };
    } catch (error) {
      toolsLogger.error({ error }, 'Failed to reset session');
      throw error;
    }
  }

  /**
   * List archived sessions
   */
  async listArchives(): Promise<{
    archives: Array<{
      path: string;
      archivedAt: string;
      reason: string;
      projectName: string;
      totalDecisions: number;
      completionPercentage: number;
    }>;
    count: number;
  }> {
    toolsLogger.info('Listing archived sessions');

    const archives = await this.sessionManager.listArchives();

    return {
      archives,
      count: archives.length,
    };
  }

  // --- V2 Agentic Co-Pilot Tools --- //

  /**
   * Add a codebase rule
   */
  async addRule(args: {
    description: string;
    rationale: string;
    severity: import('../types.js').RuleSeverity;
  }): Promise<{ ruleId: string; message: string }> {
    toolsLogger.info({ description: args.description }, 'Adding codebase rule');
    const rule: import('../types.js').Rule = {
      id: generateId(),
      description: args.description,
      rationale: args.rationale,
      severity: args.severity,
      createdAt: new Date().toISOString(),
    };
    await this.storage.saveRule(rule);
    return { ruleId: rule.id, message: 'Rule added successfully' };
  }

  /**
   * Read all codebase rules
   */
  async readRules(): Promise<{ rules: import('../types.js').Rule[] }> {
    toolsLogger.info('Reading codebase rules');
    const rules = await this.storage.getRules();
    return { rules };
  }

  /**
   * Append an entry to the scratchpad
   */
  async appendScratchpad(args: {
    tag: string;
    content: string;
  }): Promise<{ entryId: string; message: string }> {
    toolsLogger.info({ tag: args.tag }, 'Appending to scratchpad');
    const entry: import('../types.js').ScratchpadEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      tag: args.tag,
      content: args.content,
    };
    await this.storage.appendScratchpad(entry);
    return { entryId: entry.id, message: 'Appended to scratchpad successfully' };
  }

  /**
   * Read scratchpad entries
   */
  async readScratchpad(args: {
    tag?: string;
  }): Promise<{ entries: import('../types.js').ScratchpadEntry[] }> {
    toolsLogger.info({ tag: args.tag }, 'Reading scratchpad');
    let entries = await this.storage.getScratchpad();
    if (args.tag) {
      entries = entries.filter((e) => e.tag === args.tag);
    }
    return { entries };
  }

  /**
   * Create a session handoff
   */
  async createHandoff(args: {
    summary: string;
    brokenFeatures: string[];
    nextSteps: string[];
  }): Promise<{ message: string }> {
    toolsLogger.info('Creating session handoff');
    const handoff: import('../types.js').HandoffContext = {
      timestamp: new Date().toISOString(),
      summary: args.summary,
      brokenFeatures: args.brokenFeatures,
      nextSteps: args.nextSteps,
    };
    await this.storage.saveHandoff(handoff);
    return { message: 'Session handoff saved successfully' };
  }

  /**
   * Read the latest session handoff
   */
  async readHandoff(): Promise<{ handoff: import('../types.js').HandoffContext | null }> {
    toolsLogger.info('Reading session handoff');
    const handoff = await this.storage.getHandoff();
    return { handoff };
  }

  /**
   * Autonomously generate a handoff from scratchpad entries
   */
  async generateAutonomousHandoff(): Promise<void> {
    const entries = await this.storage.getScratchpad();
    if (!entries || entries.length === 0) return;

    toolsLogger.info('Autonomously generating session handoff...');
    const llm = new LLMClient();
    const result = await llm.generateHandoff(entries);

    await this.storage.saveHandoff({
      summary: result.summary,
      brokenFeatures: result.brokenFeatures,
      nextSteps: result.nextSteps,
      timestamp: new Date().toISOString(),
    });
    toolsLogger.info('Autonomous handoff completed and saved.');
  }
}
