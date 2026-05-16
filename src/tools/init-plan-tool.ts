/**
 * Intelligent Master Plan Initialization Tool
 * Gathers context through conversation, then creates master plan
 */

import type { MasterPlan, Phase, Constraint } from '../types.js';
import { LLMClient } from '../engine/llm-client.js';

export interface ProjectContext {
  // Core project info
  projectName?: string;
  projectType?:
    | 'web-app'
    | 'api-service'
    | 'cli-tool'
    | 'library'
    | 'mobile-app'
    | 'desktop-app'
    | 'other';
  description?: string;

  // Technical details
  primaryLanguage?: string;
  frameworks?: string[];
  targetPlatform?: string[];

  // Scope and goals
  mainGoal?: string;
  targetUsers?: string;
  keyFeatures?: string[];

  // Constraints
  timeline?: string;
  teamSize?: number;
  technicalConstraints?: string[];

  // Context quality
  contextScore: number; // 0-100
  missingInfo: string[];
}

/**
 * Calculate how much context we have (0-100)
 */
export function calculateContextScore(context: ProjectContext): number {
  let score = 0;
  const weights = {
    projectName: 10,
    projectType: 15,
    description: 15,
    mainGoal: 20,
    keyFeatures: 15,
    primaryLanguage: 10,
    targetUsers: 10,
    timeline: 5,
  };

  if (context.projectName) score += weights.projectName;
  if (context.projectType) score += weights.projectType;
  if (context.description) score += weights.description;
  if (context.mainGoal) score += weights.mainGoal;
  if (context.keyFeatures && context.keyFeatures.length > 0) score += weights.keyFeatures;
  if (context.primaryLanguage) score += weights.primaryLanguage;
  if (context.targetUsers) score += weights.targetUsers;
  if (context.timeline) score += weights.timeline;

  return Math.min(score, 100);
}

/**
 * Identify what information is still missing
 */
export function identifyMissingInfo(context: ProjectContext): string[] {
  const missing: string[] = [];

  if (!context.projectName) missing.push('project name');
  if (!context.projectType) missing.push('project type (web app, API, CLI tool, etc.)');
  if (!context.mainGoal) missing.push('main goal or vision');
  if (!context.keyFeatures || context.keyFeatures.length === 0)
    missing.push('key features or functionality');
  if (!context.targetUsers) missing.push('target users or audience');
  if (!context.primaryLanguage) missing.push('primary programming language');

  return missing;
}

/**
 * Generate intelligent follow-up questions based on current context
 */
export function generateFollowUpQuestions(context: ProjectContext): string[] {
  const questions: string[] = [];
  const missing = identifyMissingInfo(context);

  // Prioritize questions based on what's missing
  if (missing.includes('project name')) {
    questions.push('What would you like to name this project?');
  }

  if (missing.includes('project type (web app, API, CLI tool, etc.)')) {
    questions.push(
      'What type of project is this? (e.g., web application, REST API, CLI tool, mobile app, library)'
    );
  }

  if (missing.includes('main goal or vision')) {
    questions.push('What is the main goal or vision for this project? What problem does it solve?');
  }

  if (missing.includes('key features or functionality')) {
    questions.push('What are the key features or main functionality you want to build?');
  }

  if (missing.includes('target users or audience')) {
    questions.push('Who are the target users? Who will use this project?');
  }

  if (missing.includes('primary programming language')) {
    questions.push('What programming language or tech stack do you plan to use?');
  }

  // Additional context questions if basics are covered
  if (missing.length === 0) {
    if (!context.timeline) {
      questions.push('Do you have a timeline or deadline for this project?');
    }
    if (!context.technicalConstraints || context.technicalConstraints.length === 0) {
      questions.push(
        'Are there any technical constraints or requirements? (e.g., must use specific framework, must support certain browsers)'
      );
    }
  }

  return questions;
}

/**
 * Generate master plan from gathered context
 */
export async function generateMasterPlanFromContext(context: ProjectContext): Promise<MasterPlan> {
  // Generate vision statement
  const vision =
    context.mainGoal ||
    `Build ${context.projectName || 'a project'} that ${context.description || 'delivers value to users'}.`;

  // Generate success criteria
  const successCriteria = generateSuccessCriteria(context);

  const llmClient = new LLMClient();
  let phases: Phase[] = [];
  let constraints: Constraint[] = [];
  try {
    const details = await llmClient.generatePlanDetails(context);
    phases = details.phases;
    constraints = details.constraints;
  } catch (_e) {
    // fallback
    phases = generatePhases(context);
    constraints = generateConstraints(context);
  }

  const now = new Date().toISOString();

  const processPhases = (rawPhases: Phase[]): Phase[] => {
    return rawPhases.map((p, index) => ({
      ...p,
      id: p.id || `phase-${Date.now()}-${index}`,
      status: index === 0 ? 'active' : 'pending',
      milestones: (p.milestones || []).map((m, mIndex) => ({
        ...m,
        id: m.id || `milestone-${Date.now()}-${index}-${mIndex}`,
        status: 'pending',
        blockers: m.blockers || [],
      })),
    }));
  };

  const processConstraints = (rawConstraints: Constraint[]): Constraint[] => {
    return rawConstraints.map((c, index) => ({
      ...c,
      id: c.id || `constraint-${Date.now()}-${index}`,
      createdAt: now,
    }));
  };

  return {
    id: `plan-${Date.now()}`,
    name: context.projectName || 'Unnamed Project',
    vision,
    successCriteria,
    constraints: processConstraints(constraints),
    phases: processPhases(phases),
    createdAt: now,
    updatedAt: now,
  };
}

function generateSuccessCriteria(context: ProjectContext): string[] {
  const criteria: string[] = [];

  // Feature-based criteria
  if (context.keyFeatures && context.keyFeatures.length > 0) {
    context.keyFeatures.forEach((feature) => {
      criteria.push(`${feature} is implemented and working`);
    });
  }

  // Type-specific criteria
  if (context.projectType === 'web-app') {
    criteria.push('Application is responsive and works on all target devices');
    criteria.push('User experience is smooth and intuitive');
  } else if (context.projectType === 'api-service') {
    criteria.push('All API endpoints are documented and tested');
    criteria.push('API handles errors gracefully');
  } else if (context.projectType === 'cli-tool') {
    criteria.push('CLI is easy to use with clear help documentation');
    criteria.push('Commands execute reliably');
  }

  // User-focused criteria
  if (context.targetUsers) {
    criteria.push(`${context.targetUsers} can successfully use the core features`);
  }

  // Quality criteria
  criteria.push('Code is well-documented and maintainable');
  criteria.push('Core functionality has test coverage');

  return criteria;
}

function generateConstraints(context: ProjectContext): Constraint[] {
  const constraints: Constraint[] = [];
  const now = new Date().toISOString();

  // Scope constraint (always important)
  constraints.push({
    id: `constraint-${Date.now()}-1`,
    type: 'scope',
    description: 'Focus on MVP features first, avoid scope creep',
    rationale: 'Build core functionality before adding nice-to-have features',
    createdAt: now,
  });

  // Technical constraints
  if (context.technicalConstraints && context.technicalConstraints.length > 0) {
    context.technicalConstraints.forEach((constraint, index) => {
      constraints.push({
        id: `constraint-${Date.now()}-tech-${index}`,
        type: 'technical',
        description: constraint,
        rationale: 'Project requirement or technical limitation',
        createdAt: now,
      });
    });
  }

  // Tech stack constraint
  if (context.primaryLanguage || (context.frameworks && context.frameworks.length > 0)) {
    const stack = [context.primaryLanguage, ...(context.frameworks || [])]
      .filter(Boolean)
      .join(', ');

    constraints.push({
      id: `constraint-${Date.now()}-stack`,
      type: 'technical',
      description: `Use ${stack} as primary technology stack`,
      rationale: 'Maintain consistency and leverage existing expertise',
      createdAt: now,
    });
  }

  // Timeline constraint
  if (context.timeline) {
    constraints.push({
      id: `constraint-${Date.now()}-time`,
      type: 'time',
      description: `Complete project within ${context.timeline}`,
      rationale: 'Project deadline or milestone requirement',
      createdAt: now,
    });
  }

  // Complexity constraint
  if (context.teamSize === 1 || !context.teamSize) {
    constraints.push({
      id: `constraint-${Date.now()}-complexity`,
      type: 'complexity',
      description: 'Keep architecture simple and maintainable',
      rationale: 'Solo developer - avoid over-engineering',
      createdAt: now,
    });
  }

  return constraints;
}

function generatePhases(context: ProjectContext): Phase[] {
  const phases: Phase[] = [];
  const timestamp = Date.now();

  // Phase 1: Planning & Setup
  phases.push({
    id: `${timestamp}-planning`,
    name: 'Phase 1: Planning & Setup',
    objective: 'Define requirements and set up development environment',
    deliverables: [
      'Project requirements documented',
      'Development environment configured',
      'Project structure created',
      'Initial dependencies installed',
    ],
    milestones: [
      {
        id: `${timestamp}-setup`,
        description: 'Development environment ready',
        acceptanceCriteria: [
          'Project structure is organized',
          'Development tools are configured',
          'Can run basic "hello world" successfully',
        ],
        status: 'pending',
        blockers: [],
      },
    ],
    status: 'pending',
  });

  // Phase 2: Core Implementation
  const coreDeliverables =
    context.keyFeatures && context.keyFeatures.length > 0
      ? context.keyFeatures.map((f) => `${f} implemented`)
      : ['Core functionality implemented', 'Main features working'];

  phases.push({
    id: `${timestamp}-core`,
    name: 'Phase 2: Core Implementation',
    objective: 'Build the main features and functionality',
    deliverables: [...coreDeliverables, 'Error handling in place', 'Basic validation working'],
    milestones: [
      {
        id: `${timestamp}-mvp`,
        description: 'MVP is functional',
        acceptanceCriteria: [
          'All core features work end-to-end',
          'Happy path scenarios are tested',
          'Basic error handling is in place',
        ],
        status: 'pending',
        blockers: [],
      },
    ],
    status: 'pending',
  });

  // Phase 3: Testing & Polish
  phases.push({
    id: `${timestamp}-polish`,
    name: 'Phase 3: Testing & Polish',
    objective: 'Ensure quality and prepare for release',
    deliverables: [
      'Comprehensive tests written',
      'Documentation complete',
      'Code reviewed and refactored',
      'Performance optimized',
    ],
    milestones: [
      {
        id: `${timestamp}-release`,
        description: 'Ready for release',
        acceptanceCriteria: [
          'All success criteria are met',
          'Test coverage is adequate',
          'Documentation is clear and complete',
          'No critical bugs remain',
        ],
        status: 'pending',
        blockers: [],
      },
    ],
    status: 'pending',
  });

  return phases;
}

/**
 * Check if we have enough context to create a master plan
 * Threshold: 70% context score
 */
export function hasEnoughContext(context: ProjectContext): boolean {
  const score = calculateContextScore(context);
  return score >= 70;
}
