/**
 * Core alignment engine that validates work against the master plan
 */

import { MasterPlan, AlignmentResult, Constraint } from '../types.js';
import { alignmentLogger } from '../logging/logger.js';
import { LLMClient } from './llm-client.js';

export class AlignmentEngine {
  private llmClient: LLMClient;

  constructor() {
    this.llmClient = new LLMClient();
  }

  /**
   * Check if a task aligns with the master plan using LLM
   */
  async checkAlignment(
    task: string,
    plan: MasterPlan,
    rules: import('../types.js').Rule[] = [],
    proposedApproach?: string
  ): Promise<AlignmentResult> {
    alignmentLogger.info({ task, planId: plan.id }, 'Checking task alignment via LLM');

    try {
      const llmResult = await this.llmClient.checkAlignment(task, plan, rules, proposedApproach);

      const relevantConstraints: Constraint[] = [];
      if (llmResult.violates_constraints) {
        // If LLM says it violates constraints, we also ask it which ones, or we can just run a quick check
        const conflicts = await this.llmClient.checkDecisionConflicts(
          task + (proposedApproach ? ' ' + proposedApproach : ''),
          plan
        );
        for (const conflictText of conflicts) {
          // Attempt to map conflict text back to constraints if needed, but for now we'll just log warnings
          llmResult.warnings.push(conflictText);
        }
      }

      const result: AlignmentResult = {
        score: llmResult.score,
        isAligned: llmResult.isAligned,
        warnings: llmResult.warnings,
        recommendations: llmResult.recommendations,
        relevantConstraints,
      };

      alignmentLogger.info(
        {
          task,
          score: result.score,
          isAligned: result.isAligned,
          warningCount: result.warnings.length,
        },
        'Alignment check complete'
      );

      return result;
    } catch (error) {
      alignmentLogger.error(
        { error },
        'LLM alignment check failed. Falling back to simple heuristic.'
      );
      // Fallback logic if LLM is unavailable
      return this.fallbackHeuristic();
    }
  }

  /**
   * Simple fallback if LLM is down
   */
  private fallbackHeuristic(): AlignmentResult {
    return {
      score: 50,
      isAligned: true,
      warnings: ['LLM was unreachable. This is a default fallback response.'],
      recommendations: ['Ensure your local LLM is running and accessible.'],
      relevantConstraints: [],
    };
  }
}
