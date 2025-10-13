# North Star MCP

> Keep AI assistants focused on the master plan and prevent scope creep

## Overview

North Star MCP is a Model Context Protocol server that helps AI assistants maintain focus on project goals during development. It prevents scope creep, over-engineering, and feature drift by providing a persistent "project compass" that validates every decision against the master plan.

## The Problem

When AI assistants work on large projects, they often:
- Get distracted by mini-tasks and lose sight of the main goal
- Over-engineer solutions beyond what's needed
- Drift from the original vision as requirements evolve
- Build features that don't align with core objectives
- Create technical debt by not validating against the master plan

## The Solution

North Star MCP provides:
- **Master Plan Storage** - A persistent, hierarchical goal structure
- **Alignment Validation** - Tools to check if work aligns with goals (0-100 score)
- **Progress Tracking** - Measure advancement toward the final objective
- **Scope Guards** - Prevent feature creep and over-complication
- **Decision Framework** - Help AI make choices that serve the master plan

## Installation

```bash
cd NorthStar
npm install
npm run build
```

## Configuration

Add to your Roo Code MCP settings:

**Location:** `C:\Users\BeeLink\AppData\Roaming\Roo-Code\MCP\mcp-servers.json`

```json
{
  "mcpServers": {
    "north-star": {
      "command": "node",
      "args": ["C:/Users/BeeLink/Desktop/NorthStar/build/index.js"],
      "env": {
        "PROJECT_ROOT": "C:/Users/BeeLink/Desktop/NorthStar"
      }
    }
  }
}
```

**Note:** Set `PROJECT_ROOT` to the NorthStar directory so storage is created inside the project.

## Quick Start

### 1. Initialize Master Plan

```typescript
use_mcp_tool("initialize_master_plan", {
  name: "Task Manager App",
  vision: "Simple, fast task manager for individuals with offline support",
  successCriteria: [
    "Users can create, edit, delete tasks",
    "Works offline with local storage",
    "Clean, minimal UI",
    "Loads in under 2 seconds"
  ],
  constraints: [
    {
      type: "scope",
      description: "No user authentication in v1",
      rationale: "Keep it simple, focus on core functionality"
    },
    {
      type: "technical",
      description: "Use vanilla JS, no frameworks",
      rationale: "Minimize dependencies, maximize performance"
    }
  ],
  phases: [
    {
      name: "Core Functionality",
      objective: "Basic CRUD operations working",
      deliverables: ["HTML structure", "Task storage", "Basic UI"],
      milestones: [
        {
          description: "Create task form and storage",
          acceptanceCriteria: ["Form validates input", "Tasks persist in localStorage"]
        }
      ]
    }
  ]
})
```

### 2. Check Alignment Before Work

```typescript
use_mcp_tool("check_alignment", {
  currentTask: "Add drag-and-drop task reordering",
  proposedApproach: "Use HTML5 drag API"
})

// Response:
{
  alignmentScore: 55,
  isAligned: false,
  warnings: [
    "Adds complexity beyond current phase scope",
    "Not required for success criteria"
  ],
  recommendations: [
    "Simple up/down buttons would meet the need",
    "Save drag-and-drop for Phase 2 polish"
  ]
}
```

### 3. Get Current Focus

```typescript
use_mcp_tool("get_current_focus", {})

// Response:
{
  currentPhase: {
    name: "Core Functionality",
    objective: "Basic CRUD operations working"
  },
  priorityTasks: [
    "Create task form and storage",
    "Implement edit functionality"
  ],
  nextSteps: [
    "Focus on phase: Core Functionality",
    "Next task: Create task form and storage"
  ]
}
```

## Available Tools

### `initialize_master_plan`
Create the master plan for your project.

**Parameters:**
- `name` - Project name
- `vision` - Ultimate goal (1-2 sentences)
- `successCriteria` - Array of success criteria
- `constraints` - Array of constraints (type, description, rationale)
- `phases` - Array of phases with milestones

### `check_alignment`
Validate if a task aligns with the master plan.

**Parameters:**
- `currentTask` - Description of the task
- `proposedApproach` (optional) - How you plan to implement it

**Returns:** Score 0-100, warnings, and recommendations

### `validate_scope`
Check if a feature is within project scope.

**Parameters:**
- `featureDescription` - What you want to build
- `justification` - Why it's needed

**Returns:** In-scope status, reasoning, and alternatives

### `log_decision`
Record important decisions with rationale.

**Parameters:**
- `question` - The decision being made
- `decision` - What was decided
- `rationale` - Why
- `impact` - low/medium/high

### `update_progress`
Update milestone completion status.

**Parameters:**
- `milestoneId` - ID of the milestone
- `status` - pending/in_progress/completed

### `get_current_focus`
Get what should be worked on now.

**Returns:** Current phase, active milestones, priority tasks

### `add_constraint`
Add a new constraint to prevent scope creep.

**Parameters:**
- `type` - scope/technical/time/complexity
- `description` - What it prevents
- `rationale` - Why it exists

### `review_decisions`
Analyze past decisions for patterns.

**Parameters:**
- `impactLevel` (optional) - Filter by impact

**Returns:** Decisions, patterns, misalignments

## Available Resources

Access via `access_mcp_resource`:

- `master-plan://current` - Full master plan
- `master-plan://vision` - Vision and success criteria only
- `master-plan://constraints` - All constraints
- `master-plan://progress` - Progress metrics
- `master-plan://decisions` - Decision history
- `master-plan://next-steps` - Recommended next actions

## Workflow Integration

### Before Starting Any Task

```typescript
// 1. Check alignment
const alignment = await use_mcp_tool("check_alignment", {
  currentTask: "Add feature X"
});

// 2. If not aligned, show warnings
if (!alignment.isAligned) {
  // Present warnings and alternatives to user
}

// 3. Proceed with work
// 4. Log decision
await use_mcp_tool("log_decision", {
  question: "How to implement feature X?",
  decision: "Use approach Y",
  rationale: "Best fits constraints",
  impact: "medium"
});

// 5. Update progress
await use_mcp_tool("update_progress", {
  milestoneId: "milestone-id",
  status: "completed"
});
```

## Storage

All data is stored in `.north-star/` directory:
- `master-plan.json` - The master plan
- `decisions.json` - Decision log
- `metrics.json` - Progress metrics

## Alignment Scoring

Tasks are scored 0-100 based on:
- **Vision alignment** (40%) - Does it serve the ultimate goal?
- **Constraint compliance** (30%) - Does it violate any constraints?
- **Phase relevance** (20%) - Is it relevant to current phase?
- **Success criteria** (10%) - Does it contribute to success?

**Score >= 70** = Aligned ✓  
**Score < 70** = Warning ⚠️

## Best Practices

1. **Always start with context** - Check master plan before work
2. **Validate before building** - Use `check_alignment` for every task
3. **Log important decisions** - Document architectural choices
4. **Update progress regularly** - Keep metrics current
5. **Review periodically** - Use `review_decisions` to spot patterns

## Example: Preventing Scope Creep

```typescript
// User asks for a complex feature
User: "Add real-time collaboration with WebSockets"

// AI checks alignment
const result = await use_mcp_tool("check_alignment", {
  currentTask: "Add real-time collaboration",
  proposedApproach: "WebSockets + operational transforms"
});

// Result shows misalignment
{
  alignmentScore: 25,
  isAligned: false,
  warnings: [
    "Violates constraint: 'No backend, pure client-side'",
    "Violates constraint: 'Keep it simple'",
    "Not in current phase deliverables"
  ],
  recommendations: [
    "Focus on core single-user features first",
    "Consider for v2 after validating core concept",
    "Current priority: Complete Phase 1 deliverables"
  ]
}

// AI presents alternatives
AI: "This feature conflicts with our constraints. 
     We agreed to keep v1 simple and client-side only.
     Should we adjust the master plan, or focus on core features first?"
```

## License

MIT