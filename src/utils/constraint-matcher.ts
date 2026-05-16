import { Constraint } from '../types.js';
import { createModuleLogger } from '../logging/logger.js';

const logger = createModuleLogger('constraint-matcher');

/**
 * Utility for matching text against constraints to detect potential conflicts
 */
export class ConstraintMatcher {
  private static readonly STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'has',
    'he',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'that',
    'the',
    'to',
    'was',
    'will',
    'with',
    'should',
    'can',
    'must',
    'have',
    'this',
    'but',
    'not',
    'or',
    'if',
    'when',
    'where',
    'how',
    'what',
  ]);

  /**
   * Check if text potentially conflicts with a constraint
   */
  static hasConflict(text: string, constraint: Constraint): boolean {
    const textLower = text.toLowerCase();
    const constraintTerms = this.extractKeyTerms(constraint.description.toLowerCase());

    const hasMatch = constraintTerms.some((term) => term.length > 3 && textLower.includes(term));

    if (hasMatch) {
      logger.debug(
        {
          text: text.substring(0, 50),
          constraint: constraint.description,
          constraintType: constraint.type,
        },
        'Potential constraint conflict detected'
      );
    }

    return hasMatch;
  }

  /**
   * Find all constraints that might conflict with text
   */
  static findConflicts(text: string, constraints: Constraint[]): Constraint[] {
    return constraints.filter((c) => this.hasConflict(text, c));
  }

  /**
   * Extract meaningful terms from text (removes stop words)
   */
  static extractKeyTerms(text: string): string[] {
    return text
      .split(/\W+/)
      .filter((word) => word.length > 2 && !this.STOP_WORDS.has(word.toLowerCase()))
      .map((word) => word.toLowerCase());
  }

  /**
   * Calculate similarity score between two texts (0-100)
   * Based on shared key terms
   */
  static calculateSimilarity(text1: string, text2: string): number {
    const terms1 = new Set(this.extractKeyTerms(text1));
    const terms2 = new Set(this.extractKeyTerms(text2));

    if (terms1.size === 0 || terms2.size === 0) {
      return 0;
    }

    const intersection = new Set([...terms1].filter((term) => terms2.has(term)));

    const union = new Set([...terms1, ...terms2]);

    return Math.round((intersection.size / union.size) * 100);
  }
}
