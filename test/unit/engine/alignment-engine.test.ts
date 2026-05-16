import { describe, it, expect, vi } from 'vitest';
import { AlignmentEngine } from '../../../src/engine/alignment-engine.js';
import type { MasterPlan } from '../../../src/types.js';

// Mock the LLMClient so we don't need a live LLM for unit testing
vi.mock('../../../src/engine/llm-client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      checkAlignment: vi.fn().mockImplementation(async (task: string, _plan: MasterPlan) => {
        // Mock simple heuristic responses based on task string for test determinism
        if (task.includes('perfect')) {
          return {
            isAligned: true,
            score: 95,
            warnings: [],
            recommendations: [],
            violates_constraints: false,
          };
        } else if (task.includes('authentication')) {
          return {
            isAligned: false,
            score: 40,
            warnings: ['Violates constraint: No user authentication in v1'],
            recommendations: ['Drop authentication features'],
            violates_constraints: true,
          };
        } else if (task.includes('frontend')) {
          return {
            isAligned: false,
            score: 30,
            warnings: ['Not relevant to current phase'],
            recommendations: ['Focus on Backend API'],
            violates_constraints: false,
          };
        } else if (task.includes('complex')) {
          return {
            isAligned: false,
            score: 40,
            warnings: ['Too complex'],
            recommendations: ['Look for simpler approach'],
            violates_constraints: true,
          };
        }

        return {
          isAligned: true,
          score: 80,
          warnings: [],
          recommendations: [],
          violates_constraints: false,
        };
      }),
      checkDecisionConflicts: vi.fn().mockImplementation(async (decision: string) => {
        if (decision.includes('authentication')) {
          return ['May conflict with constraint: No user authentication in v1'];
        }
        return [];
      }),
    })),
  };
});

describe('AlignmentEngine', () => {
  const engine = new AlignmentEngine();

  function createTestPlan(overrides: Partial<MasterPlan> = {}): MasterPlan {
    return {
      id: 'test-plan',
      name: 'Test Project',
      vision: 'Build simple task manager',
      successCriteria: ['Users can create tasks', 'Tasks persist'],
      constraints: [],
      phases: [
        {
          id: 'phase-1',
          name: 'Core Features',
          objective: 'Create CRUD operations',
          deliverables: ['Task creation', 'Task editing'],
          status: 'active',
          milestones: [],
          startedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('checkAlignment', () => {
    it('should score perfect alignment highly', async () => {
      const plan = createTestPlan({
        vision: 'Build simple task manager with CRUD operations',
      });

      const result = await engine.checkAlignment(
        'This is a perfect task for CRUD operations',
        plan
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.isAligned).toBe(true);
      expect(result.warnings.length).toBeLessThanOrEqual(1);
    });

    it('should detect constraint violations', async () => {
      const plan = createTestPlan({
        vision: 'Simple task manager',
        constraints: [
          {
            id: 'c1',
            type: 'scope',
            description: 'No user authentication in v1',
            rationale: 'Keep it simple',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const result = await engine.checkAlignment('Add user authentication and login system', plan);

      expect(result.score).toBeLessThan(70);
      expect(result.isAligned).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should recognize phase misalignment', async () => {
      const plan = createTestPlan({
        vision: 'Build web app',
        phases: [
          {
            id: 'phase-1',
            name: 'Backend API',
            objective: 'Create REST endpoints',
            deliverables: ['API endpoints'],
            status: 'active',
            milestones: [],
          },
        ],
      });

      const result = await engine.checkAlignment('Design frontend UI components', plan);

      expect(result.score).toBeLessThan(70);
      expect(result.warnings.some((w) => w.includes('phase'))).toBe(true);
    });

    it('should provide recommendations for misaligned tasks', async () => {
      const plan = createTestPlan({
        vision: 'Simple app',
        constraints: [
          {
            id: 'c1',
            type: 'complexity',
            description: 'No complex features',
            rationale: 'Keep it simple',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const result = await engine.checkAlignment('Add complex machine learning features', plan);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.isAligned).toBe(false);
    });

    it('should handle empty constraints gracefully', async () => {
      const plan = createTestPlan({
        constraints: [],
      });

      const result = await engine.checkAlignment('Any task', plan);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
