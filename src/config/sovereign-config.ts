/**
 * sovereign-config.ts
 * 
 * Loads configuration from the sovereign-agent config.json file
 * and provides typed access to model assignments and preferences.
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface SovereignModels {
  orchestrator: string;
  planner: string;
  librarian: string;
  fallback: string;
}

export interface SovereignPreferences {
  ultrawork_max_iterations: number;
  dcp_turn_protection: number;
  dcp_error_retention_turns: number;
  dcp_nudge_frequency: number;
}

export interface SovereignConfig {
  openrouter_api_key: string;
  site_url: string;
  site_name: string;
  models: SovereignModels;
  preferences: SovereignPreferences;
}

const DEFAULT_CONFIG: SovereignConfig = {
  openrouter_api_key: '',
  site_url: 'https://localhost',
  site_name: 'SovereignAgent',
  models: {
    orchestrator: 'deepseek/deepseek-v3',
    planner: 'anthropic/claude-opus-4.5',
    librarian: 'google/gemini-3-flash',
    fallback: 'meta-llama/llama-3.3-70b-instruct',
  },
  preferences: {
    ultrawork_max_iterations: 50,
    dcp_turn_protection: 2,
    dcp_error_retention_turns: 4,
    dcp_nudge_frequency: 10,
  },
};

/**
 * Possible locations for sovereign-agent config.json
 */
const CONFIG_PATHS = [
  // Project-level config
  join(process.cwd(), 'config.json'),
  join(process.cwd(), '.sovereign-agent', 'config.json'),
  // User-level config
  join(homedir(), '.config', 'sovereign-agent', 'config.json'),
  join(homedir(), '.sovereign-agent', 'config.json'),
];

let cachedConfig: SovereignConfig | null = null;

/**
 * Find and load the sovereign-agent config.json file
 */
export function loadSovereignConfig(): SovereignConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  for (const configPath of CONFIG_PATHS) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        cachedConfig = mergeWithDefaults(parsed);
        return cachedConfig;
      } catch (error) {
        console.warn(`Failed to parse config at ${configPath}:`, error);
      }
    }
  }

  // Return defaults if no config found
  cachedConfig = DEFAULT_CONFIG;
  return cachedConfig;
}

/**
 * Merge user config with defaults
 */
function mergeWithDefaults(userConfig: Partial<SovereignConfig>): SovereignConfig {
  return {
    openrouter_api_key: userConfig.openrouter_api_key ?? DEFAULT_CONFIG.openrouter_api_key,
    site_url: userConfig.site_url ?? DEFAULT_CONFIG.site_url,
    site_name: userConfig.site_name ?? DEFAULT_CONFIG.site_name,
    models: {
      ...DEFAULT_CONFIG.models,
      ...userConfig.models,
    },
    preferences: {
      ...DEFAULT_CONFIG.preferences,
      ...userConfig.preferences,
    },
  };
}

/**
 * Get the model for a specific agent role
 */
export function getModelForRole(role: keyof SovereignModels): string {
  const config = loadSovereignConfig();
  return config.models[role];
}

/**
 * Map agent names to sovereign-agent roles
 */
const AGENT_ROLE_MAP: Record<string, keyof SovereignModels> = {
  'Sisyphus': 'orchestrator',
  'oracle': 'planner',
  'librarian': 'librarian',
  'explore': 'librarian',  // Uses same model as librarian
  'frontend-ui-ux-engineer': 'orchestrator',
  'document-writer': 'librarian',
  'multimodal-looker': 'librarian',
};

/**
 * Get the model for a specific agent by name
 */
export function getModelForAgent(agentName: string): string {
  const role = AGENT_ROLE_MAP[agentName] ?? 'fallback';
  return getModelForRole(role);
}

/**
 * Clear the cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Check if sovereign-agent config exists
 */
export function hasSovereignConfig(): boolean {
  return CONFIG_PATHS.some(p => existsSync(p));
}
