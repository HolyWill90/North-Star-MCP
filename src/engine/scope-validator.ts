/**
 * Validates if features/tasks are within project scope
 */

import { MasterPlan, ScopeValidationResult, Constraint } from '../types.js';
import { AlignmentEngine } from './alignment-engine.js';

export class ScopeValidator {
  private alignmentEngine: AlignmentEngine;

  constructor() {
    this.alignmentEngine = new AlignmentEngine();
  }

  /**
   * Validate if a feature is within scope
   */
  validateScope(
    featureDescription: string,
    justification: string,
    plan: MasterPlan
  ): ScopeValidationResult {
    // Check alignment first
    const alignment = this.alignmentEngine.checkAlignment(
      featureDescription,
      plan,
      justification
    );

    // If well-aligned, it's in scope
    if (alignment.isAligned) {
      return {
        inScope: true,
        reasoning: `Feature aligns well with master plan (score: ${alignment.score}/100)`,
        alternativeSuggestions: [],
        impactedConstraints: []
      };
    }

    // Analyze why it's out of scope
    const reasoning = this.buildReasoning(alignment, plan);
    const alternatives = this.generateAlternatives(featureDescription, alignment, plan);

    return {
      inScope: false,
      reasoning,
      alternativeSuggestions: alternatives,
      impactedConstraints: alignment.relevantConstraints
    };
  }

  /**
   * Build reasoning for why feature is out of scope
   */
  private buildReasoning(alignment: any, plan: MasterPlan): string {
    const reasons: string[] = [];

    if (alignment.relevantConstraints.length > 0) {
      reasons.push('Violates project constraints');
    }

    if (alignment.warnings.some((w: string) => w.includes('vision'))) {
      reasons.push('Does not align with project vision');
    }

    if (alignment.warnings.some((w: string) => w.includes('phase'))) {
      reasons.push('Not relevant to current phase');
    }

    if (alignment.warnings.some((w: string) => w.includes('success criteria'))) {
      reasons.push('Does not contribute to success criteria');
    }

    if (reasons.length === 0) {
      reasons.push('Alignment score too low');
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Generate alternative suggestions
   */
  private generateAlternatives(
    feature: string,
    alignment: any,
    plan: MasterPlan
  ): string[] {
    const alternatives: string[] = [];

    // Suggest focusing on current phase
    const activePhase = plan.phases.find(p => p.status === 'active');
    if (activePhase) {
      alternatives.push(`Focus on current phase: "${activePhase.objective}"`);
      
      // Suggest incomplete milestones
      const incompleteMilestones = activePhase.milestones.filter(
        m => m.status !== 'completed'
      );
      if (incompleteMilestones.length > 0) {
        alternatives.push(
          `Complete pending milestones: ${incompleteMilestones.map(m => m.description).join(', ')}`
        );
      }
    }

    // Suggest simpler alternatives if complexity is an issue
    if (alignment.relevantConstraints.some((c: Constraint) => c.type === 'complexity')) {
      alternatives.push('Look for a simpler implementation approach');
      alternatives.push('Break down into smaller, incremental steps');
    }

    // Suggest deferring to later phase
    const pendingPhases = plan.phases.filter(p => p.status === 'pending');
    if (pendingPhases.length > 0) {
      alternatives.push(`Consider adding to a future phase (e.g., ${pendingPhases[0].name})`);
    }

    // Suggest validating against success criteria
    alternatives.push('Ensure the feature directly supports at least one success criterion');

    return alternatives;
  }
}