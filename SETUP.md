# North Star MCP - Setup Guide

## Quick Setup

### 1. Build Complete ✓

The project has been built successfully. All TypeScript files have been compiled to JavaScript in the `build/` directory.

### 2. Add to Roo Code

To use North Star MCP with Roo Code, add it to your MCP servers configuration:

**Location:** `C:\Users\BeeLink\AppData\Roaming\Roo-Code\MCP\mcp-servers.json`

**Configuration:**
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

**Important:** The `PROJECT_ROOT` should point to the NorthStar directory so that `.north-star/` storage is created inside the project, not in the workspace root.

### 3. Restart Roo Code

After adding the configuration, restart Roo Code to load the MCP server.

### 4. Verify Connection

In Roo Code, you should see "north-star" in the list of connected MCP servers. You can verify by trying:

```typescript
use_mcp_tool("get_current_focus", {})
```

If no master plan exists yet, it will prompt you to create one.

## First Use

### Initialize Your Master Plan

```typescript
use_mcp_tool("initialize_master_plan", {
  name: "Your Project Name",
  vision: "What you're ultimately trying to achieve",
  successCriteria: [
    "Criterion 1",
    "Criterion 2"
  ],
  constraints: [
    {
      type: "scope",
      description: "What you won't do",
      rationale: "Why this constraint exists"
    }
  ],
  phases: [
    {
      name: "Phase 1",
      objective: "What this phase achieves",
      deliverables: ["Deliverable 1", "Deliverable 2"],
      milestones: [
        {
          description: "Milestone description",
          acceptanceCriteria: ["Criterion 1", "Criterion 2"]
        }
      ]
    }
  ]
})
```

### Check Alignment Before Work

Before starting any task:

```typescript
use_mcp_tool("check_alignment", {
  currentTask: "Description of what you want to do",
  proposedApproach: "How you plan to do it (optional)"
})
```

This returns a score 0-100 and warnings if the task doesn't align with your master plan.

## Example Workflow

See [`examples/north-star-mcp-plan.json`](examples/north-star-mcp-plan.json) for a real example - the master plan for building this MCP itself!

## Storage Location

Master plan and decisions are stored in:
```
<your-project>/.north-star/
  ├── master-plan.json
  ├── decisions.json
  └── metrics.json
```

You can commit these files to version control to share the master plan with your team.

## Troubleshooting

### Server Not Connecting

1. Check that the path in `mcp-servers.json` is correct
2. Verify the build directory exists: `NorthStar/build/index.js`
3. Check Roo Code logs for error messages

### TypeScript Errors During Development

If you modify the source code:
```bash
cd NorthStar
npm run build
```

Then restart Roo Code to reload the server.

### Master Plan Not Found

If you get "No master plan found" errors, initialize one first using `initialize_master_plan`.

## Development

To modify the MCP:

1. Edit files in `src/`
2. Run `npm run build`
3. Restart Roo Code

For continuous development:
```bash
npm run watch
```

This will rebuild automatically when you save files.

## Next Steps

1. ✓ Build completed
2. Add to Roo Code MCP configuration
3. Restart Roo Code
4. Initialize your master plan
5. Start using alignment checks in your workflow

## Support

For issues or questions, refer to:
- [README.md](README.md) - Full documentation
- [examples/north-star-mcp-plan.json](examples/north-star-mcp-plan.json) - Real example