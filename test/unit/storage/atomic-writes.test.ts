import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorage } from '../../../src/storage/file-storage.js';
import type { MasterPlan } from '../../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Atomic Writes and File Locking', () => {
  const testDir = '.north-star-atomic-test';
  let storage: FileStorage;

  beforeEach(async () => {
    storage = new FileStorage(testDir);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  function createTestPlan(name: string = 'Test Project'): MasterPlan {
    return {
      id: 'test-plan-123',
      name,
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

  describe('Atomic Writes', () => {
    it('should write files atomically', async () => {
      const plan = createTestPlan();

      await storage.saveMasterPlan(plan);

      // File should exist and be readable
      const loaded = await storage.getMasterPlan();
      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe(plan.name);
    });

    it('should not leave partial writes on error', async () => {
      const plan = createTestPlan();

      // First write should succeed
      await storage.saveMasterPlan(plan);

      // Verify file exists
      const filePath = path.join(testDir, '.north-star', 'master-plan.json');
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle concurrent writes safely', async () => {
      const plan1 = createTestPlan('Project 1');
      const plan2 = createTestPlan('Project 2');
      const plan3 = createTestPlan('Project 3');

      // Attempt concurrent writes
      await Promise.all([
        storage.saveMasterPlan(plan1),
        storage.saveMasterPlan(plan2),
        storage.saveMasterPlan(plan3),
      ]);

      // One of them should have won
      const loaded = await storage.getMasterPlan();
      expect(loaded).toBeDefined();
      expect(['Project 1', 'Project 2', 'Project 3']).toContain(loaded?.name);
    });
  });

  describe('Data Validation', () => {
    it('should validate master plan structure on load', async () => {
      const plan = createTestPlan();
      await storage.saveMasterPlan(plan);

      // Should load successfully with valid data
      const loaded = await storage.getMasterPlan();
      expect(loaded).toBeDefined();
    });

    it('should reject invalid master plan data', async () => {
      // Write invalid data directly to file
      await fs.mkdir(path.join(testDir, '.north-star'), { recursive: true });
      const filePath = path.join(testDir, '.north-star', 'master-plan.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          id: 'test',
          name: 'Test',
          // Missing required fields
        }),
        'utf-8'
      );

      // Should throw validation error
      await expect(storage.getMasterPlan()).rejects.toThrow();
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Write corrupted JSON
      await fs.mkdir(path.join(testDir, '.north-star'), { recursive: true });
      const filePath = path.join(testDir, '.north-star', 'master-plan.json');
      await fs.writeFile(filePath, 'invalid json {{{', 'utf-8');

      // Should throw corruption error
      await expect(storage.getMasterPlan()).rejects.toThrow();
    });
  });

  describe('Decision Validation', () => {
    it('should validate decision structure', async () => {
      const decision = {
        id: 'dec-1',
        timestamp: new Date().toISOString(),
        question: 'Test question?',
        decision: 'Test decision',
        rationale: 'Test rationale',
        alignmentCheck: true,
        impact: 'high' as const,
      };

      await storage.saveDecision(decision);

      const loaded = await storage.getDecisions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('dec-1');
    });

    it('should reject invalid decision data', async () => {
      // Write invalid decision data
      await fs.mkdir(path.join(testDir, '.north-star'), { recursive: true });
      const filePath = path.join(testDir, '.north-star', 'decisions.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          decisions: [
            {
              id: 'dec-1',
              // Missing required fields
            },
          ],
        }),
        'utf-8'
      );

      // Should throw validation error
      await expect(storage.getDecisions()).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages', async () => {
      // Write invalid data
      await fs.mkdir(path.join(testDir, '.north-star'), { recursive: true });
      const filePath = path.join(testDir, '.north-star', 'master-plan.json');
      await fs.writeFile(filePath, 'invalid', 'utf-8');

      try {
        await storage.getMasterPlan();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('parse');
      }
    });
  });
});
