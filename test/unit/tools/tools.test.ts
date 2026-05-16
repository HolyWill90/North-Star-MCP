import { describe, it, expect, beforeEach } from 'vitest';
import { NorthStarTools } from '../../../src/tools/tools.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';

describe('NorthStarTools', () => {
  let storage: MemoryStorage;
  let tools: NorthStarTools;

  beforeEach(() => {
    storage = new MemoryStorage();
    tools = new NorthStarTools(storage, '/fake/project/root');
  });

  describe('initializeMasterPlan', () => {
    it('should create a new master plan with all required fields', async () => {
      const result = await tools.initializeMasterPlan({
        name: 'Test Project',
        vision: 'Build a test project that validates NorthStar tools',
        successCriteria: ['All tests pass', 'Coverage above 80%'],
        constraints: [{ type: 'scope', description: 'No UI work', rationale: 'Backend only' }],
        phases: [
          {
            name: 'Phase 1',
            objective: 'Build core',
            deliverables: ['Core module'],
            milestones: [{ description: 'Core done', acceptanceCriteria: ['Tests pass'] }],
          },
        ],
      });

      expect(result.planId).toBeDefined();
      expect(result.summary).toContain('Test Project');

      const plan = await storage.getMasterPlan();
      expect(plan).not.toBeNull();
      expect(plan!.name).toBe('Test Project');
      expect(plan!.phases).toHaveLength(1);
      expect(plan!.phases[0].status).toBe('active');
      expect(plan!.constraints).toHaveLength(1);
    });

    it('should set first phase to active status', async () => {
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A test project with multiple phases',
        successCriteria: ['Done'],
        constraints: [],
        phases: [
          {
            name: 'Phase 1',
            objective: 'First',
            deliverables: ['D1'],
            milestones: [{ description: 'M1', acceptanceCriteria: ['AC1'] }],
          },
          {
            name: 'Phase 2',
            objective: 'Second',
            deliverables: ['D2'],
            milestones: [{ description: 'M2', acceptanceCriteria: ['AC2'] }],
          },
        ],
      });

      const plan = await storage.getMasterPlan();
      expect(plan!.phases[0].status).toBe('active');
      expect(plan!.phases[1].status).toBe('pending');
    });
  });

  describe('logDecision', () => {
    it('should save a decision and return an ID', async () => {
      // Need a plan first for alignment check
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A project for testing decision logging',
        successCriteria: ['Decisions tracked'],
        constraints: [],
        phases: [
          {
            name: 'P1',
            objective: 'O1',
            deliverables: ['D1'],
            milestones: [{ description: 'M1', acceptanceCriteria: ['AC1'] }],
          },
        ],
      });

      const result = await tools.logDecision({
        question: 'Should we use vitest?',
        decision: 'Yes, vitest',
        rationale: 'Fast and compatible with ESM',
        impact: 'medium',
      });

      expect(result.decisionId).toBeDefined();
      expect(result.alignmentValidated).toBe(true);

      const decisions = await storage.getDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].question).toBe('Should we use vitest?');
    });
  });

  describe('addRule', () => {
    it('should add a codebase rule', async () => {
      const result = await tools.addRule({
        description: 'No console.log in production',
        rationale: 'Use structured logging instead',
        severity: 'error',
      });

      expect(result.ruleId).toBeDefined();

      const rules = await storage.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].description).toBe('No console.log in production');
      expect(rules[0].severity).toBe('error');
    });
  });

  describe('addConstraint', () => {
    it('should add a constraint to the plan', async () => {
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A project for testing constraint addition',
        successCriteria: ['Constraints enforced'],
        constraints: [],
        phases: [
          {
            name: 'P1',
            objective: 'O1',
            deliverables: ['D1'],
            milestones: [{ description: 'M1', acceptanceCriteria: ['AC1'] }],
          },
        ],
      });

      const result = await tools.addConstraint({
        type: 'technical',
        description: 'Must use TypeScript',
        rationale: 'Type safety',
      });

      expect(result.constraintId).toBeDefined();

      const plan = await storage.getMasterPlan();
      expect(plan!.constraints).toHaveLength(1);
      expect(plan!.constraints[0].type).toBe('technical');
    });

    it('should throw if no plan exists', async () => {
      await expect(
        tools.addConstraint({
          type: 'scope',
          description: 'No X',
          rationale: 'Y',
        })
      ).rejects.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update milestone status', async () => {
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A project for testing progress updates',
        successCriteria: ['Progress tracked'],
        constraints: [],
        phases: [
          {
            name: 'P1',
            objective: 'O1',
            deliverables: ['D1'],
            milestones: [
              { description: 'M1', acceptanceCriteria: ['AC1'] },
              { description: 'M2', acceptanceCriteria: ['AC2'] },
            ],
          },
        ],
      });

      const plan = await storage.getMasterPlan();
      const milestoneId = plan!.phases[0].milestones[0].id;

      const result = await tools.updateProgress({
        milestoneId,
        status: 'completed',
      });

      expect(result.updated).toBe(true);

      const updated = await storage.getMasterPlan();
      expect(updated!.phases[0].milestones[0].status).toBe('completed');
    });

    it('should auto-advance phase when all milestones complete', async () => {
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A project for testing phase auto-advancement',
        successCriteria: ['Phases auto-advance'],
        constraints: [],
        phases: [
          {
            name: 'P1',
            objective: 'O1',
            deliverables: ['D1'],
            milestones: [{ description: 'M1', acceptanceCriteria: ['AC1'] }],
          },
          {
            name: 'P2',
            objective: 'O2',
            deliverables: ['D2'],
            milestones: [{ description: 'M2', acceptanceCriteria: ['AC2'] }],
          },
        ],
      });

      const plan = await storage.getMasterPlan();
      const milestoneId = plan!.phases[0].milestones[0].id;

      await tools.updateProgress({ milestoneId, status: 'completed' });

      const updated = await storage.getMasterPlan();
      expect(updated!.phases[0].status).toBe('completed');
      expect(updated!.phases[1].status).toBe('active');
    });
  });

  describe('scratchpad', () => {
    it('should append and read entries', async () => {
      await tools.appendScratchpad({ tag: 'test', content: 'Entry 1' });
      await tools.appendScratchpad({ tag: 'debug', content: 'Entry 2' });

      const all = await tools.readScratchpad({});
      expect(all.entries).toHaveLength(2);

      const filtered = await tools.readScratchpad({ tag: 'debug' });
      expect(filtered.entries).toHaveLength(1);
      expect(filtered.entries[0].content).toBe('Entry 2');
    });
  });

  describe('handoff', () => {
    it('should create and read handoff context', async () => {
      await tools.createHandoff({
        summary: 'Session done',
        brokenFeatures: ['Feature X'],
        nextSteps: ['Fix Feature X', 'Add tests'],
      });

      const handoff = await tools.readHandoff();
      expect(handoff.handoff).not.toBeNull();
      expect(handoff.handoff!.summary).toBe('Session done');
      expect(handoff.handoff!.brokenFeatures).toContain('Feature X');
      expect(handoff.handoff!.nextSteps).toHaveLength(2);
    });
  });

  describe('getCurrentFocus', () => {
    it('should return the active phase and milestones', async () => {
      await tools.initializeMasterPlan({
        name: 'Test',
        vision: 'A project for testing focus detection',
        successCriteria: ['Focus works'],
        constraints: [],
        phases: [
          {
            name: 'P1',
            objective: 'Build core',
            deliverables: ['D1'],
            milestones: [{ description: 'M1', acceptanceCriteria: ['AC1'] }],
          },
        ],
      });

      const focus = await tools.getCurrentFocus();
      expect(focus.currentPhase).not.toBeNull();
      expect(focus.currentPhase!.name).toBe('P1');
    });

    it('should throw if no plan exists', async () => {
      await expect(tools.getCurrentFocus()).rejects.toThrow('No master plan found');
    });
  });
});
