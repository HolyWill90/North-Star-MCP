#!/usr/bin/env node

/**
 * North Star MCP Server
 * Keeps AI assistants focused on the master plan
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FileStorage } from './storage/file-storage.js';
import { NorthStarTools } from './tools/tools.js';
import * as schemas from './validation/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// PROJECT_ROOT = the NorthStar install directory (where this script lives).
// Antigravity does not support per-workspace env vars or CLI args.
const PROJECT_ROOT = projectRoot;

import { startUIServer } from './ui-server.js';
import os from 'os';

// Initialize storage and tools
const storage = new FileStorage(PROJECT_ROOT);
const tools = new NorthStarTools(storage, PROJECT_ROOT);

// UI Server will be started in main()
// Create MCP server
const server = new Server(
  {
    name: 'north-star-mcp',
    version: '1.0.0',
    instructions: [
      'MANDATORY: At the start of every conversation and after any context window reset or compression,',
      'call get_current_focus to load the active project plan, phase, constraints, and current work focus.',
      'This server maintains persistent project state that does NOT exist in your conversation history.',
      'If you have lost context about what project you are working on, what phase you are in,',
      'or what constraints apply — the answer is in get_current_focus.',
      'Do not guess or reconstruct project state from memory. Read it from this server.',
    ].join(' '),
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'init_master_plan',
        description:
          'AI-assisted master plan creation. Analyzes conversation context to gather project requirements, then generates an intelligent master plan. Use this when starting a new project - the AI will ask questions to understand the project before creating the plan.',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'object',
              description: 'Project context gathered from conversation',
              properties: {
                projectName: { type: 'string' },
                projectType: {
                  type: 'string',
                  enum: [
                    'web-app',
                    'api-service',
                    'cli-tool',
                    'library',
                    'mobile-app',
                    'desktop-app',
                    'other',
                  ],
                },
                description: { type: 'string' },
                primaryLanguage: { type: 'string' },
                frameworks: {
                  type: 'array',
                  items: { type: 'string' },
                },
                targetPlatform: {
                  type: 'array',
                  items: { type: 'string' },
                },
                mainGoal: { type: 'string' },
                targetUsers: { type: 'string' },
                keyFeatures: {
                  type: 'array',
                  items: { type: 'string' },
                },
                timeline: { type: 'string' },
                teamSize: { type: 'number' },
                technicalConstraints: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
          required: ['context'],
        },
      },
      {
        name: 'initialize_master_plan',
        description:
          'Create a new master plan for the project with vision, phases, and constraints (manual mode - requires all details upfront)',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name',
            },
            vision: {
              type: 'string',
              description: 'The ultimate goal (1-2 sentences)',
            },
            successCriteria: {
              type: 'array',
              items: { type: 'string' },
              description: 'What "done" looks like',
            },
            constraints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['scope', 'technical', 'time', 'complexity'],
                  },
                  description: { type: 'string' },
                  rationale: { type: 'string' },
                },
                required: ['type', 'description', 'rationale'],
              },
              description: 'Constraints to prevent scope creep',
            },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  objective: { type: 'string' },
                  deliverables: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  milestones: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        acceptanceCriteria: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['description', 'acceptanceCriteria'],
                    },
                  },
                },
                required: ['name', 'objective', 'deliverables', 'milestones'],
              },
              description: 'Project phases with milestones',
            },
          },
          required: ['name', 'vision', 'successCriteria', 'constraints', 'phases'],
        },
      },
      {
        name: 'check_alignment',
        description: 'Check if a task aligns with the master plan (returns score 0-100)',
        inputSchema: {
          type: 'object',
          properties: {
            currentTask: {
              type: 'string',
              description: 'Description of the task to validate',
            },
            proposedApproach: {
              type: 'string',
              description: 'Optional: How you plan to implement it',
            },
          },
          required: ['currentTask'],
        },
      },
      {
        name: 'log_decision',
        description: 'Log an important decision with rationale',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question or choice being made',
            },
            decision: {
              type: 'string',
              description: 'The decision made',
            },
            rationale: {
              type: 'string',
              description: 'Why this decision was made',
            },
            impact: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Impact level of this decision',
            },
            context: {
              type: 'string',
              description: 'Optional: Additional context',
            },
          },
          required: ['question', 'decision', 'rationale', 'impact'],
        },
      },
      {
        name: 'update_progress',
        description: 'Update the status of a milestone',
        inputSchema: {
          type: 'object',
          properties: {
            milestoneId: {
              type: 'string',
              description: 'ID of the milestone to update',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'New status',
            },
            notes: {
              type: 'string',
              description: 'Optional: Notes about the progress',
            },
          },
          required: ['milestoneId', 'status'],
        },
      },
      {
        name: 'validate_scope',
        description: 'Check if a feature is within project scope',
        inputSchema: {
          type: 'object',
          properties: {
            featureDescription: {
              type: 'string',
              description: 'Description of the proposed feature',
            },
            justification: {
              type: 'string',
              description: 'Why this feature is needed',
            },
          },
          required: ['featureDescription', 'justification'],
        },
      },
      {
        name: 'get_current_focus',
        description: 'Get what should be worked on right now',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_constraint',
        description: 'Add a new constraint to prevent scope creep',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['scope', 'technical', 'time', 'complexity'],
              description: 'Type of constraint',
            },
            description: {
              type: 'string',
              description: 'What the constraint prevents',
            },
            rationale: {
              type: 'string',
              description: 'Why this constraint exists',
            },
          },
          required: ['type', 'description', 'rationale'],
        },
      },
      {
        name: 'review_decisions',
        description: 'Analyze past decisions for patterns and misalignments',
        inputSchema: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              description: 'Optional: Time range to review',
            },
            impactLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Optional: Filter by impact level',
            },
          },
        },
      },
      {
        name: 'reset_session',
        description:
          'Reset the current project session and clear all data (with optional archiving)',
        inputSchema: {
          type: 'object',
          properties: {
            archive: {
              type: 'boolean',
              description: 'Whether to archive the session before resetting (default: true)',
            },
            reason: {
              type: 'string',
              description: 'Reason for resetting the session',
            },
          },
        },
      },
      {
        name: 'list_archives',
        description: 'List all archived project sessions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_rule',
        description: 'Add a new codebase rule to enforce',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'The rule description' },
            rationale: { type: 'string', description: 'Why this rule exists' },
            severity: { type: 'string', enum: ['warn', 'error'], description: 'Rule severity' },
          },
          required: ['description', 'rationale', 'severity'],
        },
      },
      {
        name: 'read_rules',
        description: 'Read all codebase rules',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'append_scratchpad',
        description: 'Append an entry to the agent scratchpad',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'A short tag for categorization' },
            content: { type: 'string', description: 'The content to append' },
          },
          required: ['tag', 'content'],
        },
      },
      {
        name: 'read_scratchpad',
        description: 'Read the agent scratchpad',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Optional tag to filter by' },
          },
        },
      },
      {
        name: 'create_handoff',
        description: 'Create a session handoff context',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Summary of the current state' },
            brokenFeatures: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of currently broken features',
            },
            nextSteps: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of next steps to take',
            },
          },
          required: ['summary', 'brokenFeatures', 'nextSteps'],
        },
      },
      {
        name: 'read_handoff',
        description: 'Read the latest session handoff context',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'init_master_plan':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.initMasterPlan(args as any), null, 2),
            },
          ],
        };

      case 'initialize_master_plan':
        const initArgs = schemas.InitializeMasterPlanInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.initializeMasterPlan(initArgs), null, 2),
            },
          ],
        };

      case 'check_alignment':
        const checkArgs = schemas.CheckAlignmentInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.checkAlignment(checkArgs), null, 2),
            },
          ],
        };

      case 'log_decision':
        const logArgs = schemas.LogDecisionInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.logDecision(logArgs), null, 2),
            },
          ],
        };

      case 'update_progress':
        const progressArgs = schemas.UpdateProgressInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.updateProgress(progressArgs), null, 2),
            },
          ],
        };

      case 'validate_scope':
        const validateArgs = schemas.ValidateScopeInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.validateScope(validateArgs), null, 2),
            },
          ],
        };

      case 'get_current_focus':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.getCurrentFocus(), null, 2),
            },
          ],
        };

      case 'add_constraint':
        const constraintArgs = schemas.AddConstraintInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.addConstraint(constraintArgs), null, 2),
            },
          ],
        };

      case 'review_decisions':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.reviewDecisions(args as any), null, 2),
            },
          ],
        };

      case 'reset_session':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.resetSession(args as any), null, 2),
            },
          ],
        };

      case 'list_archives':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.listArchives(), null, 2),
            },
          ],
        };

      case 'add_rule':
        const addRuleArgs = schemas.AddRuleInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.addRule(addRuleArgs), null, 2),
            },
          ],
        };

      case 'read_rules':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.readRules(), null, 2),
            },
          ],
        };

      case 'append_scratchpad':
        const appendScratchpadArgs = schemas.AppendScratchpadInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.appendScratchpad(appendScratchpadArgs), null, 2),
            },
          ],
        };

      case 'read_scratchpad':
        const readScratchpadArgs = schemas.ReadScratchpadInputSchema.parse(args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.readScratchpad(readScratchpadArgs), null, 2),
            },
          ],
        };

      case 'create_handoff':
        const createHandoffArgs = schemas.CreateHandoffInputSchema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.createHandoff(createHandoffArgs), null, 2),
            },
          ],
        };

      case 'read_handoff':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.readHandoff(), null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'master-plan://current',
        name: 'Current Master Plan',
        description: 'The active master plan with all details',
        mimeType: 'application/json',
      },
      {
        uri: 'master-plan://vision',
        name: 'Project Vision',
        description: 'Just the vision statement and success criteria',
        mimeType: 'application/json',
      },
      {
        uri: 'master-plan://constraints',
        name: 'Active Constraints',
        description: 'All constraints preventing scope creep',
        mimeType: 'application/json',
      },
      {
        uri: 'master-plan://progress',
        name: 'Progress Metrics',
        description: 'Current progress and completion status',
        mimeType: 'application/json',
      },
      {
        uri: 'master-plan://decisions',
        name: 'Decision History',
        description: 'Log of all decisions made',
        mimeType: 'application/json',
      },
      {
        uri: 'master-plan://next-steps',
        name: 'Next Steps',
        description: 'Recommended next actions',
        mimeType: 'application/json',
      },
      {
        uri: 'north-star://rules',
        name: 'Codebase Rules',
        description: 'All enforced codebase rules',
        mimeType: 'application/json',
      },
      {
        uri: 'north-star://scratchpad',
        name: 'Agent Scratchpad',
        description: 'Persistent agent scratchpad notes',
        mimeType: 'application/json',
      },
      {
        uri: 'north-star://handoff',
        name: 'Session Handoff',
        description: 'Latest session handoff context',
        mimeType: 'application/json',
      },
    ],
  };
});

/**
 * Read resources
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    const plan = await storage.getMasterPlan();

    if (!plan && uri !== 'master-plan://current') {
      throw new Error('No master plan found. Please initialize a master plan first.');
    }

    switch (uri) {
      case 'master-plan://current':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(plan, null, 2),
            },
          ],
        };

      case 'master-plan://vision':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  vision: plan!.vision,
                  successCriteria: plan!.successCriteria,
                },
                null,
                2
              ),
            },
          ],
        };

      case 'master-plan://constraints':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(plan!.constraints, null, 2),
            },
          ],
        };

      case 'master-plan://progress':
        const metrics = await storage.getMetrics();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(metrics, null, 2),
            },
          ],
        };

      case 'master-plan://decisions':
        const decisions = await storage.getDecisions();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(decisions, null, 2),
            },
          ],
        };

      case 'master-plan://next-steps':
        const focus = await tools.getCurrentFocus();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(focus.nextSteps, null, 2),
            },
          ],
        };

      case 'north-star://rules':
        const rules = await tools.readRules();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(rules.rules, null, 2),
            },
          ],
        };

      case 'north-star://scratchpad':
        const scratchpad = await tools.readScratchpad({});
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(scratchpad.entries, null, 2),
            },
          ],
        };

      case 'north-star://handoff':
        const handoff = await tools.readHandoff();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(handoff.handoff, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read resource ${uri}: ${errorMessage}`);
  }
});

import { ModelManager } from './engine/model-manager.js';

const modelManager = new ModelManager();

/**
 * Start the server
 */
async function main() {
  // Scan the user's Desktop (and subdirectories) for .north-star projects
  const scanRoots = [join(os.homedir(), 'Desktop')];
  await startUIServer(storage, projectRoot, PROJECT_ROOT, scanRoots, 9889);

  // Start the model manager (will spin up LLM if down)
  try {
    await modelManager.start();
  } catch (error) {
    console.error('Warning: Model manager failed to start LLM. Check if FLM is installed.', error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`North Star MCP Server running on stdio for project: ${PROJECT_ROOT}`);
}

let shuttingDown = false;

async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error('\nGracefully shutting down NorthStar...');

  try {
    // Generate an automatic handoff before dying
    await tools.generateAutonomousHandoff();
  } catch (e) {
    console.error('Failed to generate autonomous handoff on shutdown:', e);
  }

  modelManager.stop();
  process.exit(0);
}

// Cleanup on exit
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
