import { alignmentLogger } from '../logging/logger.js';
import type { MasterPlan, Phase, Constraint } from '../types.js';
import type { ProjectContext } from '../tools/init-plan-tool.js';

const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'http://127.0.0.1:52625/v1/chat/completions';

export class LLMClient {
  /**
   * Helper to make API calls to the local LLM
   */
  private async generateCompletion(prompt: string): Promise<string> {
    alignmentLogger.info({ endpoint: LLM_ENDPOINT }, 'Calling LLM API');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout (NPU is ~10 tok/s)

    try {
      const response = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 800,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LLM API returned ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as any;
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      alignmentLogger.error({ error }, 'Failed to call LLM API');
      throw error;
    }
  }

  /**
   * Helper to clean up LLM output containing markdown or think blocks before parsing JSON.
   */
  private parseJsonFromLlm(content: string): any {
    let cleanContent = content;
    // Remove <think>...</think> blocks entirely
    cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove markdown json wrappers
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = cleanContent.match(jsonBlockRegex);
    if (match) {
      cleanContent = match[1];
    }

    return JSON.parse(cleanContent.trim());
  }

  /**
   * Check semantic alignment using the LLM
   */
  async checkAlignment(
    task: string,
    plan: MasterPlan,
    rules: import('../types.js').Rule[] = [],
    proposedApproach?: string
  ): Promise<{
    isAligned: boolean;
    score: number;
    warnings: string[];
    recommendations: string[];
    violates_constraints: boolean;
  }> {
    const activePhase = plan.phases.find((p) => p.status === 'active') || plan.phases[0];

    const rulesSection =
      rules.length > 0
        ? `\nCodebase Rules:\n${rules.map((r) => `- [${r.severity.toUpperCase()}] ${r.description} (Rationale: ${r.rationale})`).join('\n')}`
        : '';

    const prompt = `
You are a project alignment checker for the project "${plan.name}".

Master Vision: ${plan.vision}
Success Criteria:
${plan.successCriteria.map((c) => '- ' + c).join('\n')}

Active Phase: ${activePhase ? activePhase.name : 'None'}
Phase Objective: ${activePhase ? activePhase.objective : 'None'}

Active Constraints:
${plan.constraints.map((c) => `- ${c.description} (Rationale: ${c.rationale})`).join('\n')}
${rulesSection}

Evaluate this Task: "${task}"
${proposedApproach ? `Proposed Approach: "${proposedApproach}"` : ''}

Respond ONLY with a JSON object in this exact format. Do NOT explain your reasoning. Output the JSON directly.
{
  "isAligned": boolean,
  "score": integer 0-100,
  "warnings": ["string warning 1"],
  "recommendations": ["string recommendation 1"],
  "violates_constraints": boolean
}
`;

    try {
      const content = await this.generateCompletion(prompt.trim());
      const result = this.parseJsonFromLlm(content);
      return {
        isAligned: Boolean(result.isAligned),
        score: typeof result.score === 'number' ? result.score : 50,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
        violates_constraints: Boolean(result.violates_constraints),
      };
    } catch (e) {
      alignmentLogger.error({ error: e }, 'Failed to parse LLM alignment response');
      throw new Error('LLM did not return valid JSON for alignment check.');
    }
  }

  /**
   * Validate scope using the LLM
   */
  async validateScope(
    featureDescription: string,
    justification: string,
    plan: MasterPlan
  ): Promise<{
    inScope: boolean;
    reasoning: string;
    alternativeSuggestions: string[];
  }> {
    const prompt = `
You are a project scope validator for "${plan.name}".
Vision: ${plan.vision}
Constraints:
${plan.constraints.map((c) => `- ${c.description}`).join('\n')}

Evaluate this proposed feature:
Feature: "${featureDescription}"
Justification: "${justification}"

Is this feature strictly necessary for the project vision, and does it respect all constraints?

Respond ONLY with a JSON object in this exact format. Do NOT explain your reasoning. Output the JSON directly.
{
  "inScope": boolean,
  "reasoning": "one sentence why",
  "alternativeSuggestions": ["string alternative 1"]
}
`;
    try {
      const content = await this.generateCompletion(prompt.trim());
      const result = this.parseJsonFromLlm(content);
      return {
        inScope: Boolean(result.inScope),
        reasoning: String(result.reasoning || ''),
        alternativeSuggestions: Array.isArray(result.alternativeSuggestions)
          ? result.alternativeSuggestions
          : [],
      };
    } catch (e) {
      alignmentLogger.error({ error: e }, 'Failed to parse LLM scope validation response');
      throw new Error('LLM did not return valid JSON for scope validation.');
    }
  }

  /**
   * Generate phases and constraints using the LLM for plan initialization
   */
  async generatePlanDetails(context: ProjectContext): Promise<{
    phases: Phase[];
    constraints: Constraint[];
  }> {
    const prompt = `
You are an expert project manager. Given the following context, generate a detailed project plan with phases and constraints.
Project Name: ${context.projectName}
Type: ${context.projectType}
Goal: ${context.mainGoal}
Key Features: ${(context.keyFeatures || []).join(', ')}
Technical Constraints: ${context.technicalConstraints?.join(', ') || 'None'}

Respond ONLY with a JSON object in this format:
{
  "phases": [
    {
      "name": "string",
      "objective": "string",
      "deliverables": ["string"],
      "milestones": [
        {
          "description": "string",
          "acceptanceCriteria": ["string"]
        }
      ]
    }
  ],
  "constraints": [
    {
      "type": "scope|technical|time|complexity",
      "description": "string",
      "rationale": "string"
    }
  ]
}

Note: The type in constraint MUST be exactly one of: "scope", "technical", "time", "complexity".
`;
    try {
      const content = await this.generateCompletion(prompt.trim());
      const result = this.parseJsonFromLlm(content);

      return {
        phases: result.phases || [],
        constraints: result.constraints || [],
      };
    } catch (e) {
      alignmentLogger.error({ error: e }, 'Failed to parse LLM plan generation response');
      throw new Error('LLM did not return valid JSON for plan generation.');
    }
  }

  /**
   * Check if a decision conflicts with constraints
   */
  async checkDecisionConflicts(decision: string, plan: MasterPlan): Promise<string[]> {
    if (plan.constraints.length === 0) return [];

    const prompt = `
You are evaluating a decision against project constraints. Be incredibly strict: ONLY flag direct, undeniable violations. DO NOT flag things that "might" conflict or are vaguely related. If the decision does not explicitly violate a constraint, return an empty array.

Decision: "${decision}"

Constraints:
${plan.constraints.map((c) => `- ${c.description}`).join('\n')}

EXAMPLES:
Constraint: "Must use React" | Decision: "Switch to Vue" -> Conflict!
Constraint: "No heavy frameworks" | Decision: "Use 3s HTTP polling" -> No conflict!
Constraint: "Must communicate over stdio" | Decision: "Use WebSockets for UI" -> No conflict! (UI is not MCP communication)

Does the decision conflict with any of these constraints?
Respond ONLY with a JSON object. Do NOT explain your reasoning. Output the JSON directly.
{
  "conflicts": ["string describing the exact conflict"]
}
If there are no conflicts, return:
{
  "conflicts": []
}
`;
    try {
      const content = await this.generateCompletion(prompt.trim());
      const result = this.parseJsonFromLlm(content);
      return Array.isArray(result.conflicts) ? result.conflicts : [];
    } catch (e) {
      alignmentLogger.error({ error: e }, 'Failed to parse LLM decision conflict response');
      return []; // Fallback to no conflicts on parse error
    }
  }

  /**
   * Synthesize a session handoff from scratchpad entries
   */
  async generateHandoff(scratchpadEntries: import('../types.js').ScratchpadEntry[]): Promise<{
    summary: string;
    brokenFeatures: string[];
    nextSteps: string[];
  }> {
    if (scratchpadEntries.length === 0) {
      return {
        summary: 'No activity recorded in this session.',
        brokenFeatures: [],
        nextSteps: [],
      };
    }

    const prompt = `
You are an expert technical lead summarizing a developer's session for handoff to the next developer.
Analyze the following chronological scratchpad notes from the session:

${scratchpadEntries.map((e) => `[${e.tag}] ${e.content}`).join('\n')}

Synthesize this into a structured handoff.
Respond ONLY with a JSON object in this exact format:
{
  "summary": "1-2 paragraph summary of what was accomplished",
  "brokenFeatures": ["list of things explicitly noted as broken or unfinished"],
  "nextSteps": ["list of logical next steps based on the final state"]
}
`;
    try {
      // Allow up to 60 seconds for a handoff generation since it can be heavy
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt.trim() }],
          temperature: 0.2,
          stream: false,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('API Error');
      const data = (await response.json()) as any;
      const content = data.choices[0].message.content;
      const result = this.parseJsonFromLlm(content);

      return {
        summary: String(result.summary || 'Session completed.'),
        brokenFeatures: Array.isArray(result.brokenFeatures) ? result.brokenFeatures : [],
        nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps : [],
      };
    } catch (e) {
      alignmentLogger.error({ error: e }, 'Failed to generate autonomous handoff');
      return { summary: 'Failed to generate summary.', brokenFeatures: [], nextSteps: [] };
    }
  }
}
