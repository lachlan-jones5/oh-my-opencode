import { context7 } from "./context7"
import { grep_app } from "./grep-app"
import { websearch } from "./websearch"
import type { McpName } from "./types"

export { McpNameSchema, type McpName } from "./types"
export { websearch } from "./websearch"

type RemoteMcp = { type: "remote"; url: string; enabled: boolean }
type LocalMcp = { type: "local"; command: string[]; enabled: boolean }
type BuiltinMcpConfig = RemoteMcp | LocalMcp

const allBuiltinMcps: Record<McpName, BuiltinMcpConfig> = {
  context7,
  grep_app,
  websearch,
}

export function createBuiltinMcps(disabledMcps: string[] = []) {
  const mcps: Record<string, BuiltinMcpConfig> = {}

  for (const [name, config] of Object.entries(allBuiltinMcps)) {
    if (!disabledMcps.includes(name)) {
      mcps[name] = config
    }
  }

  return mcps
}
