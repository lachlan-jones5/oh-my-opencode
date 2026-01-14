import { describe, test, expect, beforeEach } from "bun:test"
import { 
  createGeniusAgent, 
  geniusAgent, 
  geniusPromptMetadata,
  GENIUS_SYSTEM_PROMPT 
} from "./genius"
import { clearConfigCache, getModelForAgent } from "../config"

describe("Genius Agent", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  describe("createGeniusAgent factory", () => {
    test("creates agent with default model from config", () => {
      const agent = createGeniusAgent()
      expect(agent.model).toBe(getModelForAgent("genius"))
    })

    test("creates agent with custom model override", () => {
      const agent = createGeniusAgent("custom/model")
      expect(agent.model).toBe("custom/model")
    })

    test("agent has primary mode for full capabilities", () => {
      const agent = createGeniusAgent()
      expect(agent.mode).toBe("primary")
    })

    test("agent has high maxTokens for complex reasoning", () => {
      const agent = createGeniusAgent()
      expect(agent.maxTokens).toBe(64000)
    })

    test("agent has gold color signifying premium status", () => {
      const agent = createGeniusAgent()
      expect(agent.color).toBe("#FFD700")
    })

    test("agent has meaningful description", () => {
      const agent = createGeniusAgent()
      expect(agent.description).toContain("Genius")
      expect(agent.description).toContain("escape hatch")
      expect(agent.description).toContain("Claude Opus")
    })
  })

  describe("Model-specific configurations", () => {
    test("Claude model gets extended thinking enabled", () => {
      const agent = createGeniusAgent("anthropic/claude-opus-4.5")
      expect(agent.thinking).toEqual({ type: "enabled", budgetTokens: 32000 })
      expect(agent.reasoningEffort).toBeUndefined()
    })

    test("GPT model gets reasoningEffort instead of thinking", () => {
      const agent = createGeniusAgent("openai/gpt-5.2")
      expect(agent.reasoningEffort).toBe("high")
      expect(agent.thinking).toBeUndefined()
    })

    test("GitHub Copilot GPT model gets reasoningEffort", () => {
      const agent = createGeniusAgent("github-copilot/gpt-5.2")
      expect(agent.reasoningEffort).toBe("high")
    })

    test("Non-GPT, non-Claude model gets thinking enabled", () => {
      const agent = createGeniusAgent("deepseek/deepseek-r1-0528")
      expect(agent.thinking).toEqual({ type: "enabled", budgetTokens: 32000 })
    })
  })

  describe("geniusAgent singleton", () => {
    test("is created with default config", () => {
      expect(geniusAgent).toBeDefined()
      expect(geniusAgent.mode).toBe("primary")
    })

    test("uses genius model from config", () => {
      expect(geniusAgent.model).toBe(getModelForAgent("genius"))
    })
  })

  describe("geniusPromptMetadata", () => {
    test("has advisor category", () => {
      expect(geniusPromptMetadata.category).toBe("advisor")
    })

    test("is marked as EXPENSIVE", () => {
      expect(geniusPromptMetadata.cost).toBe("EXPENSIVE")
    })

    test("has Genius as promptAlias", () => {
      expect(geniusPromptMetadata.promptAlias).toBe("Genius")
    })

    test("has meaningful triggers", () => {
      expect(geniusPromptMetadata.triggers.length).toBeGreaterThan(0)
      expect(geniusPromptMetadata.triggers.some(t => t.trigger.includes("@genius"))).toBe(true)
    })

    test("has useWhen guidelines", () => {
      expect(geniusPromptMetadata.useWhen).toBeDefined()
      expect(geniusPromptMetadata.useWhen!.length).toBeGreaterThan(0)
      expect(geniusPromptMetadata.useWhen!.some(u => u.includes("fail"))).toBe(true)
    })

    test("has avoidWhen guidelines", () => {
      expect(geniusPromptMetadata.avoidWhen).toBeDefined()
      expect(geniusPromptMetadata.avoidWhen!.length).toBeGreaterThan(0)
      expect(geniusPromptMetadata.avoidWhen!.some(a => a.includes("Cost") || a.includes("expensive"))).toBe(true)
    })
  })
})

describe("GENIUS_SYSTEM_PROMPT", () => {
  test("contains Role section", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("<Role>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("</Role>")
  })

  test("identifies as Genius escape hatch", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Genius")
    expect(GENIUS_SYSTEM_PROMPT).toContain("escape hatch")
  })

  test("mentions when to use (invoke conditions)", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("When_To_Use_You")
    expect(GENIUS_SYSTEM_PROMPT).toContain("@genius")
  })

  test("includes delegation capabilities", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Delegation")
    expect(GENIUS_SYSTEM_PROMPT).toContain("delegate")
  })

  test("includes task management section", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Task_Management")
    expect(GENIUS_SYSTEM_PROMPT).toContain("Todo")
  })

  test("includes constraints section", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Constraints")
    expect(GENIUS_SYSTEM_PROMPT).toContain("Hard Blocks")
  })

  test("forbids type suppressions", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("as any")
    expect(GENIUS_SYSTEM_PROMPT).toContain("@ts-ignore")
  })

  test("includes debugging protocol", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Debugging Protocol")
    expect(GENIUS_SYSTEM_PROMPT).toContain("hypothesis")
  })

  test("mentions verification requirements", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("lsp_diagnostics")
    expect(GENIUS_SYSTEM_PROMPT).toContain("verify")
  })
})

// ============================================================================
// RED-TEAM / ADVERSARIAL TESTS
// ============================================================================

describe("RED-TEAM: Genius Agent Security", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("system prompt does not leak internal implementation details", () => {
    // Should not mention specific file paths or internal APIs
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("/home/")
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("src/agents/")
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("node_modules")
  })

  test("system prompt does not contain secrets or API keys", () => {
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("sk-")
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("api_key")
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("password")
    expect(GENIUS_SYSTEM_PROMPT).not.toContain("secret")
  })

  test("agent cannot be tricked into revealing system prompt via model override", () => {
    // Even with a suspicious model name, agent creation should succeed
    const agent = createGeniusAgent("evil/model-that-leaks-prompts")
    expect(agent.model).toBe("evil/model-that-leaks-prompts")
    expect(agent.prompt).toContain("<Role>") // Prompt still set correctly
  })
})

describe("RED-TEAM: Genius Agent Constraints", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("agent explicitly forbids dangerous patterns", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("NEVER")
    expect(GENIUS_SYSTEM_PROMPT).toContain("as any")
    expect(GENIUS_SYSTEM_PROMPT).toContain("@ts-ignore")
    expect(GENIUS_SYSTEM_PROMPT).toContain("@ts-expect-error")
  })

  test("agent requires verification before completion", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("lsp_diagnostics")
    expect(GENIUS_SYSTEM_PROMPT).toContain("verify")
  })

  test("agent has delegation guidance to prevent infinite loops", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("Delegation")
    expect(GENIUS_SYSTEM_PROMPT).toContain("Use delegation when it makes sense")
  })

  test("agent emphasizes cost awareness", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("expensive")
    expect(GENIUS_SYSTEM_PROMPT).toContain("worth it")
  })
})

describe("RED-TEAM: Genius Agent Identity", () => {
  test("prompt establishes clear identity", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("You are")
    expect(GENIUS_SYSTEM_PROMPT).toContain("Genius")
  })

  test("prompt differentiates from other agents", () => {
    // Genius has unique characteristics
    expect(GENIUS_SYSTEM_PROMPT).toContain("escape hatch")
    expect(GENIUS_SYSTEM_PROMPT).toContain("last resort")
  })

  test("prompt mentions when NOT to use Genius", () => {
    expect(geniusPromptMetadata.avoidWhen).toBeDefined()
    expect(geniusPromptMetadata.avoidWhen!.length).toBeGreaterThan(0)
  })

  test("metadata correctly identifies as advisor category", () => {
    // Genius is an advisor, not an orchestrator (that's Sisyphus)
    expect(geniusPromptMetadata.category).toBe("advisor")
  })
})

describe("RED-TEAM: Factory robustness", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("factory handles empty string model", () => {
    const agent = createGeniusAgent("")
    expect(agent.model).toBe("")
    expect(agent.mode).toBe("primary")
  })

  test("factory handles very long model name", () => {
    const longModel = "provider/" + "a".repeat(10000)
    const agent = createGeniusAgent(longModel)
    expect(agent.model).toBe(longModel)
  })

  test("factory handles model with special characters", () => {
    const specialModel = "provider/model-v3.2-beta_test"
    const agent = createGeniusAgent(specialModel)
    expect(agent.model).toBe(specialModel)
  })

  test("factory handles undefined model (uses default)", () => {
    const agent = createGeniusAgent(undefined)
    expect(agent.model).toBe(getModelForAgent("genius"))
  })

  test("multiple factory calls create independent agents", () => {
    const agent1 = createGeniusAgent("model/one")
    const agent2 = createGeniusAgent("model/two")
    
    expect(agent1.model).toBe("model/one")
    expect(agent2.model).toBe("model/two")
    expect(agent1).not.toBe(agent2)
  })
})

describe("RED-TEAM: Prompt injection resistance", () => {
  test("system prompt is well-structured with clear sections", () => {
    // Proper structure helps prevent prompt injection
    expect(GENIUS_SYSTEM_PROMPT).toContain("<Role>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("</Role>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("<When_To_Use_You>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("</When_To_Use_You>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("<Constraints>")
    expect(GENIUS_SYSTEM_PROMPT).toContain("</Constraints>")
  })

  test("system prompt uses clear instruction markers", () => {
    expect(GENIUS_SYSTEM_PROMPT).toContain("NEVER")
    expect(GENIUS_SYSTEM_PROMPT).toContain("##")
  })

  test("agent description does not contain executable instructions", () => {
    const agent = createGeniusAgent()
    expect(agent.description).not.toContain("```")
    expect(agent.description).not.toContain("execute")
    expect(agent.description).not.toContain("run")
  })
})
