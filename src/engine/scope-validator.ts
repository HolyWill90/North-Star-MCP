/**
 * Validates if features/tasks are within project scope
 */

import { MasterPlan, ScopeValidationResult } from '../types.js';
import { AlignmentEngine } from './alignment-engine.js';
import { LLMClient } from './llm-client.js';

export class ScopeValidator {
  private alignmentEngine: AlignmentEngine;
  private llmClient: LLMClient;

  constructor() {
    this.alignmentEngine = new AlignmentEngine();
    this.llmClient = new LLMClient();
  }

  /**
   * Validate if a feature is within scope
   */
  async validateScope(
    featureDescription: string,
    justification: string,
    plan: MasterPlan
  ): Promise<ScopeValidationResult> {
    try {
      const llmResult = await this.llmClient.validateScope(featureDescription, justification, plan);

      // Let's also get the alignment to see impacted constraints
      const alignment = await this.alignmentEngine.checkAlignment(
        featureDescription,
        plan,
        [],
        justification
      );

      return {
        inScope: llmResult.inScope,
        reasoning: llmResult.reasoning,
        alternativeSuggestions: llmResult.alternativeSuggestions,
        impactedConstraints: alignment.relevantConstraints,
      };
    } catch (_e) {
      // Fallback
      return this.fallbackValidation(featureDescription, justification, plan);
    }
  }

  private async fallbackValidation(
    featureDescription: string,
    justification: string,
    plan: MasterPlan
  ): Promise<ScopeValidationResult> {
    const alignment = await this.alignmentEngine.checkAlignment(
      featureDescription,
      plan,
      [],
      justification
    );

    if (alignment.isAligned) {
      return {
        inScope: true,
        reasoning: `Feature aligns well with master plan (score: ${alignment.score}/100)`,
        alternativeSuggestions: [],
        impactedConstraints: [],
      };
    }

    return {
      inScope: false,
      reasoning: 'Alignment score too low based on fallback heuristic.',
      alternativeSuggestions: ['Look for a simpler implementation approach'],
      impactedConstraints: alignment.relevantConstraints,
    };
  }
}
