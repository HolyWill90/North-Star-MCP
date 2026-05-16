import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorage } from '../../../src/storage/file-storage.js';
import type { MasterPlan } from '../../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileStorage', () => {
  const testDir = '.north-star-test';
  let storage: FileStorage;

  beforeEach(async () => {
    storage = new FileStorage(testDir);
    // Clean up test directory if it exists
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Directory might not exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  function createTestPlan(): MasterPlan {
    return {
      id: 'test-plan-123',
      name: 'Test Project',
      vision: 'Build something great',
      successCriteria: ['Criterion 1', 'Criterion 2'],
      constraints: [],
      phases: [
        {
          id: 'phase-1',
          name: 'Phase 1',
          objective: 'Complete phase 1',
          deliverables: ['Deliverable 1'],
          status: 'active',
          milestones: [],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  describe('saveMasterPlan', () => {
    it('should save a master plan to disk', async () => {
      const plan = createTestPlan();

      await storage.saveMasterPlan(plan);

      // Verify file was created in .north-star subdirectory
      const filePath = path.join(testDir, '.north-star', 'master-plan.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const plan = createTestPlan();

      await storage.saveMasterPlan(plan);

      const dirExists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should overwrite existing plan', async () => {
      const plan1 = createTestPlan();
      const plan2 = { ...createTestPlan(), name: 'Updated Project' };

      await storage.saveMasterPlan(plan1);
      await storage.saveMasterPlan(plan2);

      const loaded = await storage.getMasterPlan();
      expect(loaded?.name).toBe('Updated Project');
    });
  });

  describe('loadMasterPlan', () => {
    it('should load a saved master plan', async () => {
      const plan = createTestPlan();
      await storage.saveMasterPlan(plan);

      const loaded = await storage.getMasterPlan();

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(plan.id);
      expect(loaded?.name).toBe(plan.name);
      expect(loaded?.vision).toBe(plan.vision);
    });

    it('should return null if no plan exists', async () => {
      const loaded = await storage.getMasterPlan();

      expect(loaded).toBeNull();
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Create directory and write invalid JSON
      await fs.mkdir(testDir, { recursive: true });
      const filePath = path.join(testDir, 'master-plan.json');
      await fs.writeFile(filePath, 'invalid json {{{');

      const loaded = await storage.getMasterPlan();

      expect(loaded).toBeNull();
    });
  });

  describe('saveDecision', () => {
    it('should save a decision to disk', async () => {
      const decision = {
        id: 'dec-1',
        question: 'Should we use TypeScript?',
        decision: 'Yes',
        rationale: 'Better type safety',
        alignmentCheck: true,
        impact: 'high' as const,
        timestamp: new Date().toISOString(),
      };

      await storage.saveDecision(decision);

      const filePath = path.join(testDir, '.north-star', 'decisions.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should append decisions', async () => {
      const decision1 = {
        id: 'dec-1',
        question: 'Question 1?',
        decision: 'Decision 1',
        rationale: 'Rationale 1',
        alignmentCheck: true,
        impact: 'high' as const,
        timestamp: new Date().toISOString(),
      };

      const decision2 = {
        id: 'dec-2',
        question: 'Question 2?',
        decision: 'Decision 2',
        rationale: 'Rationale 2',
        alignmentCheck: false,
        impact: 'medium' as const,
        timestamp: new Date().toISOString(),
      };

      await storage.saveDecision(decision1);
      await storage.saveDecision(decision2);

      const loaded = await storage.getDecisions();
      expect(loaded).toHaveLength(2);
    });
  });

  describe('getDecisions', () => {
    it('should load saved decisions', async () => {
      const decision = {
        id: 'dec-1',
        question: 'Test question?',
        decision: 'Test decision',
        rationale: 'Test rationale',
        alignmentCheck: true,
        impact: 'medium' as const,
        timestamp: new Date().toISOString(),
      };

      await storage.saveDecision(decision);
      const loaded = await storage.getDecisions();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('dec-1');
      expect(loaded[0].question).toBe('Test question?');
    });

    it('should return empty array if no decisions exist', async () => {
      const loaded = await storage.getDecisions();

      expect(loaded).toEqual([]);
    });
  });

  describe('data integrity', () => {
    it('should preserve all plan properties through save/load cycle', async () => {
      const plan = createTestPlan();
      plan.constraints = [
        {
          id: 'c1',
          type: 'scope',
          description: 'No feature X',
          rationale: 'Out of scope',
          createdAt: new Date().toISOString(),
        },
      ];

      await storage.saveMasterPlan(plan);
      const loaded = await storage.getMasterPlan();

      expect(loaded).toEqual(plan);
    });

    it('should handle special characters in strings', async () => {
      const plan = createTestPlan();
      plan.vision = 'Build "something" with <special> & characters';

      await storage.saveMasterPlan(plan);
      const loaded = await storage.getMasterPlan();

      expect(loaded?.vision).toBe(plan.vision);
    });
  });
});
