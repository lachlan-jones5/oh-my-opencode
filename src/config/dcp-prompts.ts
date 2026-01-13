/**
 * dcp-prompts.ts
 * 
 * Dynamic Context Pruning (DCP) awareness prompts to inject into agents.
 * These instructions help agents work effectively with context pruning.
 */

/**
 * DCP awareness prompt for the main orchestrator (Sisyphus)
 */
export const DCP_ORCHESTRATOR_PROMPT = `
## Context Management

You are operating in a context-constrained environment with Dynamic Context Pruning (DCP) enabled.
The system automatically manages context by pruning old tool outputs, but you should be aware of:

1. **Tool outputs may be pruned**: Old read/grep/glob results may be removed from context.
   If you need to reference file contents, re-read them rather than assuming they're still available.

2. **Preserve important information**: When you discover critical information (API signatures, 
   constraints, important values), explicitly note them in your response text so they persist.

3. **Work incrementally**: Complete tasks in smaller chunks. Don't plan operations that depend 
   on tool outputs from many turns ago.

4. **Recent context is safe**: The last 2-3 turns of tool outputs are protected from pruning.
`;

/**
 * DCP awareness prompt for research-focused agents (librarian, explore)
 */
export const DCP_RESEARCHER_PROMPT = `
## Context Management

You are operating with Dynamic Context Pruning (DCP) enabled. As a research-focused agent:

1. **Summarize findings**: When you find important information, include a concise summary in your
   response. Don't rely solely on tool output being available later.

2. **Be specific**: Include relevant code snippets, function signatures, or key values directly
   in your response text when they're important.

3. **Work efficiently**: Gather related information in batches when possible, as older tool
   outputs may be pruned.
`;

/**
 * DCP awareness prompt for planning agents (oracle)
 */
export const DCP_PLANNER_PROMPT = `
## Context Management

You are operating with Dynamic Context Pruning (DCP) enabled. As a planning/advisory agent:

1. **Self-contained advice**: Your recommendations should be complete and not depend on the
   user being able to reference old tool outputs.

2. **Include key details**: When referencing specific code or configurations, include the
   relevant details in your response rather than just pointing to tool outputs.

3. **Structured output**: Use clear formatting so your advice remains useful even if the
   original context that prompted it is no longer visible.
`;

/**
 * Get the appropriate DCP prompt for an agent role
 */
export function getDCPPromptForRole(role: 'orchestrator' | 'researcher' | 'planner'): string {
  switch (role) {
    case 'orchestrator':
      return DCP_ORCHESTRATOR_PROMPT;
    case 'researcher':
      return DCP_RESEARCHER_PROMPT;
    case 'planner':
      return DCP_PLANNER_PROMPT;
    default:
      return DCP_ORCHESTRATOR_PROMPT;
  }
}

/**
 * Map agent names to DCP roles
 */
const AGENT_DCP_ROLE_MAP: Record<string, 'orchestrator' | 'researcher' | 'planner'> = {
  'Sisyphus': 'orchestrator',
  'oracle': 'planner',
  'librarian': 'researcher',
  'explore': 'researcher',
  'frontend-ui-ux-engineer': 'orchestrator',
  'document-writer': 'researcher',
  'multimodal-looker': 'researcher',
};

/**
 * Get the appropriate DCP prompt for a specific agent
 */
export function getDCPPromptForAgent(agentName: string): string {
  const role = AGENT_DCP_ROLE_MAP[agentName] ?? 'orchestrator';
  return getDCPPromptForRole(role);
}
