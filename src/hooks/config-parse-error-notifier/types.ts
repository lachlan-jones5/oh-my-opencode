import type { PluginInput } from "@opencode-ai/plugin"

export interface ConfigParseErrorNotifierOptions {
  errors: Array<{ path: string; error: string }>
}

export interface ConfigParseErrorNotifierDeps {
  ctx: PluginInput
  options: ConfigParseErrorNotifierOptions
}
