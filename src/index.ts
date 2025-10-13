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
import { FileStorage } from './storage/file-storage.js';
import { NorthStarTools } from './tools/tools.js';

// Get project root from environment or use current directory
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

// Initialize storage and tools
const storage = new FileStorage(PROJECT_ROOT);
const tools = new NorthStarTools(storage);

// Create MCP server
const server = new Server(
  {
    name: 'north-star-mcp',
    version: '1.0.0',
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
        name: 'initialize_master_plan',
        description: 'Create a new master plan for the project with vision, phases, and constraints',
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
      case 'initialize_master_plan':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.initializeMasterPlan(args as any), null, 2),
            },
          ],
        };

      case 'check_alignment':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.checkAlignment(args as any), null, 2),
            },
          ],
        };

      case 'log_decision':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.logDecision(args as any), null, 2),
            },
          ],
        };

      case 'update_progress':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.updateProgress(args as any), null, 2),
            },
          ],
        };

      case 'validate_scope':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.validateScope(args as any), null, 2),
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
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await tools.addConstraint(args as any), null, 2),
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

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read resource ${uri}: ${errorMessage}`);
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('North Star MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});