export {
  OhMyOpenCodeConfigSchema,
  AgentOverrideConfigSchema,
  AgentOverridesSchema,
  McpNameSchema,
  AgentNameSchema,
  HookNameSchema,
  BuiltinCommandNameSchema,
  SisyphusAgentConfigSchema,
  ExperimentalConfigSchema,
  RalphLoopConfigSchema,
} from "./schema"

export type {
  OhMyOpenCodeConfig,
  AgentOverrideConfig,
  AgentOverrides,
  McpName,
  AgentName,
  HookName,
  BuiltinCommandName,
  SisyphusAgentConfig,
  ExperimentalConfig,
  DynamicContextPruningConfig,
  RalphLoopConfig,
} from "./schema"

// Sovereign Agent config integration
export {
  loadSovereignConfig,
  getModelForRole,
  getModelForAgent,
  clearConfigCache,
  hasSovereignConfig,
} from "./sovereign-config"

export type {
  SovereignConfig,
  SovereignModels,
  SovereignPreferences,
} from "./sovereign-config"

// DCP awareness prompts
export {
  getDCPPromptForRole,
  getDCPPromptForAgent,
  DCP_ORCHESTRATOR_PROMPT,
  DCP_RESEARCHER_PROMPT,
  DCP_PLANNER_PROMPT,
} from "./dcp-prompts"
