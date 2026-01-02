import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { getConfigLoadErrors } from "../../shared/config-errors"

export function createConfigParseErrorNotifierHook(ctx: PluginInput) {
  const startupErrors = [...getConfigLoadErrors()]
  const hasErrors = startupErrors.length > 0

  if (hasErrors) {
    log("[config-parse-error-notifier] Config errors detected at startup:", startupErrors)
  }

  return {
    "chat.message": async (
      _input: { sessionID?: string },
      output: { parts?: Array<{ type: string; text?: string }> }
    ) => {
      if (!hasErrors) return

      const parts = output.parts
      const hasTextPart = parts?.some((p) => p.type === "text" && p.text?.trim())
      if (!hasTextPart) return

      const errorMessages = startupErrors
        .map((e) => `• ${e.path}: ${e.error}`)
        .join("\n")

      await ctx.client.tui
        .showToast({
          body: {
            title: "Config Parse Error",
            message: `Your config file has errors:\n${errorMessages}\n\nPlease fix the config to dismiss this warning.`,
            variant: "error" as const,
            duration: 8000,
          },
        })
        .catch(() => {})

      log("[config-parse-error-notifier] Showed config error toast on user message")
    },
  }
}

export { HOOK_NAME } from "./constants"
