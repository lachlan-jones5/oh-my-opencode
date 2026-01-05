import { context7 } from "./context7"
import { grep_app } from "./grep-app"
import type { McpName } from "./types"

export { McpNameSchema, type McpName } from "./types"

type RemoteMcp = { type: "remote"; url: string; enabled: boolean }
type BuiltinMcpConfig = RemoteMcp

const allBuiltinMcps: Record<McpName, BuiltinMcpConfig> = {
  context7,
  grep_app,
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
