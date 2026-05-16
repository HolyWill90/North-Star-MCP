/**
 * Zod schemas for validating North Star MCP data structures
 */

import { z } from 'zod';

// Enums
export const ConstraintTypeSchema = z.enum(['scope', 'technical', 'time', 'complexity']);
export const MilestoneStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
export const PhaseStatusSchema = z.enum(['pending', 'active', 'completed']);
export const DecisionImpactSchema = z.enum(['low', 'medium', 'high']);

// Constraint schema
export const ConstraintSchema = z.object({
  id: z.string().min(1),
  type: ConstraintTypeSchema,
  description: z.string().min(1),
  rationale: z.string().min(1),
  createdAt: z.string().datetime(),
});

// Milestone schema
export const MilestoneSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  status: MilestoneStatusSchema,
  blockers: z.array(z.string()),
  completedAt: z.string().datetime().optional(),
});

// Phase schema
export const PhaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  deliverables: z.array(z.string().min(1)).min(1),
  status: PhaseStatusSchema,
  milestones: z.array(MilestoneSchema),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

// Master Plan schema
export const MasterPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  vision: z.string().min(10, 'Vision must be at least 10 characters'),
  successCriteria: z.array(z.string().min(1)).min(1, 'At least one success criterion required'),
  constraints: z.array(ConstraintSchema),
  phases: z.array(PhaseSchema).min(1, 'At least one phase required'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Decision schema
export const DecisionSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  question: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  alignmentCheck: z.boolean(),
  impact: DecisionImpactSchema,
  context: z.string().optional(),
});

// Tool input schemas
export const InitializeMasterPlanInputSchema = z.object({
  name: z.string().min(1),
  vision: z.string().min(10),
  successCriteria: z.array(z.string().min(1)).min(1),
  constraints: z.array(
    z.object({
      type: ConstraintTypeSchema,
      description: z.string().min(1),
      rationale: z.string().min(1),
    })
  ),
  phases: z
    .array(
      z.object({
        name: z.string().min(1),
        objective: z.string().min(1),
        deliverables: z.array(z.string().min(1)).min(1),
        milestones: z.array(
          z.object({
            description: z.string().min(1),
            acceptanceCriteria: z.array(z.string().min(1)).min(1),
          })
        ),
      })
    )
    .min(1),
});

export const CheckAlignmentInputSchema = z.object({
  currentTask: z.string().min(1),
  proposedApproach: z.string().optional(),
});

export const LogDecisionInputSchema = z.object({
  question: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  impact: DecisionImpactSchema,
  context: z.string().optional(),
});

export const UpdateProgressInputSchema = z.object({
  milestoneId: z.string().min(1),
  status: MilestoneStatusSchema,
  notes: z.string().optional(),
});

export const ValidateScopeInputSchema = z.object({
  featureDescription: z.string().min(1),
  justification: z.string().min(1),
});

export const AddConstraintInputSchema = z.object({
  type: ConstraintTypeSchema,
  description: z.string().min(1),
  rationale: z.string().min(1),
});

export const AddRuleInputSchema = z.object({
  description: z.string().min(1),
  rationale: z.string().min(1),
  severity: z.enum(['warn', 'error']),
});

export const AppendScratchpadInputSchema = z.object({
  tag: z.string().min(1),
  content: z.string().min(1),
});

export const ReadScratchpadInputSchema = z.object({
  tag: z.string().optional(),
});

export const CreateHandoffInputSchema = z.object({
  summary: z.string().min(1),
  brokenFeatures: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

// Type exports
export type MasterPlanInput = z.infer<typeof InitializeMasterPlanInputSchema>;
export type CheckAlignmentInput = z.infer<typeof CheckAlignmentInputSchema>;
export type LogDecisionInput = z.infer<typeof LogDecisionInputSchema>;
export type UpdateProgressInput = z.infer<typeof UpdateProgressInputSchema>;
export type ValidateScopeInput = z.infer<typeof ValidateScopeInputSchema>;
export type AddConstraintInput = z.infer<typeof AddConstraintInputSchema>;
export type AddRuleInput = z.infer<typeof AddRuleInputSchema>;
export type AppendScratchpadInput = z.infer<typeof AppendScratchpadInputSchema>;
export type ReadScratchpadInput = z.infer<typeof ReadScratchpadInputSchema>;
export type CreateHandoffInput = z.infer<typeof CreateHandoffInputSchema>;
