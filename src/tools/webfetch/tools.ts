import { tool } from "@opencode-ai/plugin/tool"
import { MAX_OUTPUT_SIZE, TIMEOUT_MS } from "./constants"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpenCode/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

export const webfetch = tool({
  description: "Fetch content from a URL and return the raw response.",
  args: {
    url: tool.schema.string().describe("The URL to fetch"),
  },
  execute: async (args) => {
    const url = args.url.startsWith("http") ? args.url : `https://${args.url}`

    try {
      let content = await fetchWithTimeout(url, TIMEOUT_MS)
      const originalSize = content.length

      let truncated = false
      if (content.length > MAX_OUTPUT_SIZE) {
        content = content.slice(0, MAX_OUTPUT_SIZE)
        truncated = true
      }

      const header = [
        `URL: ${url}`,
        `Size: ${formatBytes(originalSize)}`,
        truncated ? `[Output truncated to ${formatBytes(MAX_OUTPUT_SIZE)}]` : "",
        "---",
      ]
        .filter(Boolean)
        .join("\n")

      return `${header}\n\n${content}`
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return `Error: Request timed out after ${TIMEOUT_MS / 1000}s`
        }
        return `Error: ${error.message}`
      }
      return `Error: ${String(error)}`
    }
  },
})
