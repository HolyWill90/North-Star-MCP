/**
 * Core alignment engine that validates work against the master plan
 */

import { MasterPlan, AlignmentResult, Constraint, Phase } from '../types.js';

export class AlignmentEngine {
  /**
   * Check if a task aligns with the master plan
   */
  checkAlignment(task: string, plan: MasterPlan, proposedApproach?: string): AlignmentResult {
    let score = 100;
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const relevantConstraints: Constraint[] = [];

    // 1. Check vision alignment (40 points)
    const visionScore = this.checkVisionAlignment(task, plan.vision, proposedApproach);
    score -= (100 - visionScore) * 0.4;
    
    if (visionScore < 70) {
      warnings.push(`Task may not align with project vision: "${plan.vision}"`);
      recommendations.push('Consider how this task directly serves the ultimate goal');
    }

    // 2. Check constraints (30 points)
    const constraintViolations = this.checkConstraints(task, plan.constraints, proposedApproach);
    score -= constraintViolations.length * 10;
    
    for (const violation of constraintViolations) {
      warnings.push(`Violates constraint: "${violation.description}"`);
      relevantConstraints.push(violation);
    }

    // 3. Check phase relevance (20 points)
    const phaseResult = this.checkPhaseRelevance(task, plan.phases);
    score -= (100 - phaseResult.score) * 0.2;
    
    if (!phaseResult.isRelevant) {
      warnings.push(phaseResult.warning);
      recommendations.push(phaseResult.recommendation);
    }

    // 4. Check success criteria (10 points)
    const criteriaScore = this.checkSuccessCriteria(task, plan.successCriteria);
    score -= (100 - criteriaScore) * 0.1;
    
    if (criteriaScore < 50) {
      warnings.push('Task does not clearly contribute to success criteria');
      recommendations.push('Ensure this task helps achieve at least one success criterion');
    }

    // Generate final recommendations
    if (score < 70) {
      recommendations.push('Consider if this task is essential for the current phase');
      recommendations.push('Look for simpler alternatives that better align with constraints');
    }

    return {
      score: Math.max(0, Math.round(score)),
      isAligned: score >= 70,
      warnings,
      recommendations,
      relevantConstraints
    };
  }

  /**
   * Check if task aligns with the project vision
   */
  private checkVisionAlignment(task: string, vision: string, approach?: string): number {
    const taskLower = task.toLowerCase();
    const visionLower = vision.toLowerCase();
    const approachLower = approach?.toLowerCase() || '';
    
    // Extract key terms from vision
    const visionTerms = this.extractKeyTerms(visionLower);
    const taskTerms = this.extractKeyTerms(taskLower + ' ' + approachLower);
    
    // Calculate overlap
    const overlap = visionTerms.filter(term => taskTerms.includes(term)).length;
    const score = visionTerms.length > 0 ? (overlap / visionTerms.length) * 100 : 50;
    
    return Math.min(100, score);
  }

  /**
   * Check if task violates any constraints
   */
  private checkConstraints(task: string, constraints: Constraint[], approach?: string): Constraint[] {
    const violations: Constraint[] = [];
    const taskLower = task.toLowerCase();
    const approachLower = approach?.toLowerCase() || '';
    const combined = taskLower + ' ' + approachLower;

    for (const constraint of constraints) {
      const constraintTerms = this.extractKeyTerms(constraint.description.toLowerCase());
      
      // Check if task mentions constraint-related terms
      const hasViolation = constraintTerms.some(term => combined.includes(term));
      
      if (hasViolation) {
        violations.push(constraint);
      }
    }

    return violations;
  }

  /**
   * Check if task is relevant to current phase
   */
  private checkPhaseRelevance(task: string, phases: Phase[]): {
    score: number;
    isRelevant: boolean;
    warning: string;
    recommendation: string;
  } {
    const activePhase = phases.find(p => p.status === 'active');
    
    if (!activePhase) {
      return {
        score: 50,
        isRelevant: false,
        warning: 'No active phase found',
        recommendation: 'Start with Phase 1 or activate a phase first'
      };
    }

    const taskLower = task.toLowerCase();
    const phaseTerms = this.extractKeyTerms(
      activePhase.objective.toLowerCase() + ' ' +
      activePhase.deliverables.join(' ').toLowerCase()
    );

    const taskTerms = this.extractKeyTerms(taskLower);
    const overlap = phaseTerms.filter(term => taskTerms.includes(term)).length;
    const score = phaseTerms.length > 0 ? (overlap / phaseTerms.length) * 100 : 30;

    return {
      score: Math.min(100, score),
      isRelevant: score >= 40,
      warning: `Task may not be relevant to current phase: "${activePhase.name}"`,
      recommendation: `Focus on phase objective: "${activePhase.objective}"`
    };
  }

  /**
   * Check if task contributes to success criteria
   */
  private checkSuccessCriteria(task: string, criteria: string[]): number {
    const taskLower = task.toLowerCase();
    const taskTerms = this.extractKeyTerms(taskLower);
    
    let totalScore = 0;
    for (const criterion of criteria) {
      const criterionTerms = this.extractKeyTerms(criterion.toLowerCase());
      const overlap = criterionTerms.filter(term => taskTerms.includes(term)).length;
      const score = criterionTerms.length > 0 ? (overlap / criterionTerms.length) * 100 : 0;
      totalScore += score;
    }

    return criteria.length > 0 ? totalScore / criteria.length : 50;
  }

  /**
   * Extract meaningful terms from text
   */
  private extractKeyTerms(text: string): string[] {
    // Remove common words
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'should', 'can', 'must', 'have'
    ]);

    return text
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => word.toLowerCase());
  }
}