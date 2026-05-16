# NorthStar

An MCP server that anchors AI agents to their original goal.

## The Problem

LLM agents drift from the user's original objective during long tasks. This happens through three documented mechanisms:

1. **Context compression** — platforms summarize old messages to fit the context window, losing constraints, decisions, and rationale
2. **Sycophancy** — agents treat every piece of user feedback as a new directive, abandoning the previous plan
3. **Tangent-chasing** — agents discover new information mid-task and rewrite their priorities around it

These compound. After compression the agent has weak context. The user says something. The agent latches onto that instead of re-reading the plan. It drifts. The original goal gets buried.

Research confirms this: goal drift in multi-turn agent interactions is [well-documented](https://arxiv.org/search/?query=LLM+goal+drift) (AAAI/AIES-25, Microsoft/Salesforce "Lost in Conversation", Apollo Research).

## How NorthStar Addresses It

NorthStar uses two mechanisms:

### 1. Server Instructions (Automatic Re-Orientation)

NorthStar sets the MCP `instructions` field during server initialization. Clients that support it inject this into the agent's system prompt on every turn — including after context window compression. The instruction tells the agent to call `get_current_focus` to reload the project plan.

This is the key feature. It survives context resets because it comes from the MCP connection handshake, not from conversation history.

### 2. Persistent Project State (The Anchor)

NorthStar stores structured project state on disk:

- **Master plan** — vision, phases, milestones, success criteria
- **Constraints** — explicit boundaries the agent should respect
- **Decision log** — what was decided and why
- **Codebase rules** — persistent rules agents must follow
- **Session handoff** — context for seamless agent resumption

When the agent calls `get_current_focus`, it gets all of this back in one response — re-grounding it to the original objective.

## Setup

### Install

```bash
git clone https://github.com/HolyWill90/North-Star-MCP.git
cd North-Star-MCP
npm install
npm run build
```

### Configure MCP

Add to your MCP client config (e.g. `~/.gemini/antigravity/mcp_config.json`):

```json
{
  "mcpServers": {
    "north-star": {
      "command": "node",
      "args": ["C:/absolute/path/to/North-Star-MCP/build/index.js"]
    }
  }
}
```

### Initialize a Project

Ask your agent to call `init_master_plan` with your project context, or use `initialize_master_plan` to define everything manually.

### Dashboard

A web dashboard starts automatically at `http://localhost:9889` showing project state across all discovered projects.

## MCP Tools

| Tool | Purpose |
|---|---|
| `init_master_plan` | AI-assisted plan creation from project context |
| `initialize_master_plan` | Manual plan creation with full details |
| `get_current_focus` | **Core tool** — returns current phase, constraints, and next steps |
| `check_alignment` | Score how well a task aligns with the plan (0-100) |
| `validate_scope` | Check if a proposed feature is within project scope |
| `log_decision` | Record a decision with rationale and impact level |
| `update_progress` | Update milestone status (auto-advances phases) |
| `add_constraint` | Add scope/technical/time/complexity constraints |
| `add_rule` | Add codebase rules agents must follow |
| `read_rules` | Read all active rules |
| `review_decisions` | Analyze past decisions for patterns |
| `append_scratchpad` | Add persistent working notes |
| `read_scratchpad` | Read scratchpad entries (filterable by tag) |
| `create_handoff` | Create session handoff context |
| `read_handoff` | Read the latest handoff |
| `reset_session` | Archive and reset project state |
| `list_archives` | List archived sessions |

## MCP Resources

NorthStar also exposes project state as MCP resources for host-driven context injection:

| Resource URI | Content |
|---|---|
| `master-plan://current` | Full master plan |
| `master-plan://progress` | Completion metrics |
| `master-plan://constraints` | Active constraints |
| `master-plan://decisions` | Decision history |
| `master-plan://next-steps` | Recommended next actions |
| `north-star://rules` | Codebase rules |
| `north-star://scratchpad` | Agent scratchpad |
| `north-star://handoff` | Latest session handoff |

## Architecture

```
src/
├── index.ts              # MCP server, tools, resources, stdio transport
├── ui-server.ts          # Express dashboard with SSE streaming
├── cli.ts                # Project onboarding CLI
├── types.ts              # Core type definitions
├── engine/
│   ├── alignment-engine.ts   # LLM-powered alignment scoring
│   ├── llm-client.ts         # Local LLM client (OpenAI-compatible)
│   ├── model-manager.ts      # LLM process lifecycle
│   └── scope-validator.ts    # Scope validation logic
├── storage/
│   ├── file-storage.ts       # Atomic file storage with locking
│   ├── memory-storage.ts     # In-memory storage for testing
│   └── migrations/           # Schema version migrations
├── tools/
│   ├── tools.ts              # All MCP tool implementations
│   ├── init-plan-tool.ts     # AI plan generation
│   └── session-manager.ts    # Archive management
└── validation/
    └── schemas.ts            # Zod input validation
```

## Local LLM (Optional)

NorthStar can use a local LLM for alignment scoring and AI-assisted plan generation. It expects an OpenAI-compatible API at `http://127.0.0.1:52625/v1/chat/completions`.

Tested with:
- **DeepSeek R1 Distill Llama 8B** on Intel NPU via FLM

If no LLM is available, alignment scoring falls back to heuristic matching (keyword overlap + constraint checking).

## Testing

```bash
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
```

## Known Limitations

- MCP `instructions` field support varies by client — not all clients inject it into the system prompt
- Global MCP config only — no per-workspace server isolation in some clients
- Local LLM scoring is slow (~30-80s on consumer hardware) — the heuristic fallback is recommended for daily use
- Single-project state per server instance

## License

MIT