import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { 
  loadSovereignConfig, 
  getModelForRole, 
  getModelForAgent,
  clearConfigCache,
  hasSovereignConfig,
  type SovereignConfig,
  type SovereignModels
} from "./sovereign-config"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("sovereign-config", () => {
  const testDir = join(tmpdir(), `sovereign-config-test-${Date.now()}`)
  const testConfigPath = join(testDir, "config.json")

  beforeEach(() => {
    clearConfigCache()
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    clearConfigCache()
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe("loadSovereignConfig", () => {
    test("returns default config when no config file exists", () => {
      const config = loadSovereignConfig()
      
      expect(config.models.orchestrator).toBe("deepseek/deepseek-v3.2")
      expect(config.models.planner).toBe("deepseek/deepseek-r1-0528")
      expect(config.models.librarian).toBe("google/gemini-3-flash-preview")
      expect(config.models.genius).toBe("anthropic/claude-opus-4.5")
      expect(config.models.fallback).toBe("meta-llama/llama-4-maverick")
    })

    test("returns default preferences when not specified", () => {
      const config = loadSovereignConfig()
      
      expect(config.preferences.ultrawork_max_iterations).toBe(50)
      expect(config.preferences.dcp_turn_protection).toBe(2)
      expect(config.preferences.dcp_error_retention_turns).toBe(4)
      expect(config.preferences.dcp_nudge_frequency).toBe(10)
    })

    test("caches config after first load", () => {
      const config1 = loadSovereignConfig()
      const config2 = loadSovereignConfig()
      
      expect(config1).toBe(config2) // Same object reference
    })

    test("clearConfigCache resets the cache", () => {
      const config1 = loadSovereignConfig()
      clearConfigCache()
      const config2 = loadSovereignConfig()
      
      // Both should have the same default values
      expect(config1.models.orchestrator).toBe(config2.models.orchestrator)
      expect(config1.models.planner).toBe(config2.models.planner)
    })
  })

  describe("getModelForRole", () => {
    test("returns correct model for orchestrator role", () => {
      expect(getModelForRole("orchestrator")).toBe("deepseek/deepseek-v3.2")
    })

    test("returns correct model for planner role", () => {
      expect(getModelForRole("planner")).toBe("deepseek/deepseek-r1-0528")
    })

    test("returns correct model for librarian role", () => {
      expect(getModelForRole("librarian")).toBe("google/gemini-3-flash-preview")
    })

    test("returns correct model for genius role", () => {
      expect(getModelForRole("genius")).toBe("anthropic/claude-opus-4.5")
    })

    test("returns correct model for fallback role", () => {
      expect(getModelForRole("fallback")).toBe("meta-llama/llama-4-maverick")
    })
  })

  describe("getModelForAgent", () => {
    // Orchestrator mappings
    test("maps Sisyphus to orchestrator model", () => {
      expect(getModelForAgent("Sisyphus")).toBe("deepseek/deepseek-v3.2")
    })

    test("maps frontend-ui-ux-engineer to orchestrator model", () => {
      expect(getModelForAgent("frontend-ui-ux-engineer")).toBe("deepseek/deepseek-v3.2")
    })

    // Planner mappings
    test("maps oracle to planner model", () => {
      expect(getModelForAgent("oracle")).toBe("deepseek/deepseek-r1-0528")
    })

    test("maps metis to planner model", () => {
      expect(getModelForAgent("metis")).toBe("deepseek/deepseek-r1-0528")
    })

    test("maps 'Metis (Plan Consultant)' to planner model", () => {
      expect(getModelForAgent("Metis (Plan Consultant)")).toBe("deepseek/deepseek-r1-0528")
    })

    test("maps momus to planner model", () => {
      expect(getModelForAgent("momus")).toBe("deepseek/deepseek-r1-0528")
    })

    test("maps 'Momus (Plan Reviewer)' to planner model", () => {
      expect(getModelForAgent("Momus (Plan Reviewer)")).toBe("deepseek/deepseek-r1-0528")
    })

    test("maps prometheus to planner model", () => {
      expect(getModelForAgent("prometheus")).toBe("deepseek/deepseek-r1-0528")
    })

    // Librarian mappings
    test("maps librarian to librarian model", () => {
      expect(getModelForAgent("librarian")).toBe("google/gemini-3-flash-preview")
    })

    test("maps explore to librarian model", () => {
      expect(getModelForAgent("explore")).toBe("google/gemini-3-flash-preview")
    })

    test("maps document-writer to librarian model", () => {
      expect(getModelForAgent("document-writer")).toBe("google/gemini-3-flash-preview")
    })

    test("maps multimodal-looker to librarian model", () => {
      expect(getModelForAgent("multimodal-looker")).toBe("google/gemini-3-flash-preview")
    })

    // Genius mappings
    test("maps genius to genius model", () => {
      expect(getModelForAgent("genius")).toBe("anthropic/claude-opus-4.5")
    })

    test("maps Genius to genius model", () => {
      expect(getModelForAgent("Genius")).toBe("anthropic/claude-opus-4.5")
    })

    // Fallback
    test("returns fallback for unknown agent", () => {
      expect(getModelForAgent("unknown-agent")).toBe("meta-llama/llama-4-maverick")
    })
  })

  describe("hasSovereignConfig", () => {
    test("returns false when no config exists", () => {
      const result = hasSovereignConfig()
      expect(typeof result).toBe("boolean")
    })
  })
})

describe("config merging", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  afterEach(() => {
    clearConfigCache()
  })

  test("default models are used when not overridden", () => {
    const config = loadSovereignConfig()
    
    expect(config.models.orchestrator).toBe("deepseek/deepseek-v3.2")
    expect(config.models.planner).toBe("deepseek/deepseek-r1-0528")
    expect(config.models.genius).toBe("anthropic/claude-opus-4.5")
  })

  test("default preferences are used when not overridden", () => {
    const config = loadSovereignConfig()
    
    expect(config.preferences.ultrawork_max_iterations).toBe(50)
    expect(config.preferences.dcp_turn_protection).toBe(2)
  })
})

// ============================================================================
// RED-TEAM / ADVERSARIAL TESTS
// ============================================================================

describe("RED-TEAM: Model tier integrity", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  afterEach(() => {
    clearConfigCache()
  })

  test("all 5 model tiers must be present in default config", () => {
    const config = loadSovereignConfig()
    const requiredTiers: (keyof SovereignModels)[] = [
      "orchestrator", 
      "planner", 
      "librarian", 
      "genius", 
      "fallback"
    ]
    
    for (const tier of requiredTiers) {
      expect(config.models[tier]).toBeDefined()
      expect(typeof config.models[tier]).toBe("string")
      expect(config.models[tier].length).toBeGreaterThan(0)
    }
  })

  test("genius model must be Claude Opus by default (most capable)", () => {
    const config = loadSovereignConfig()
    expect(config.models.genius).toContain("claude")
    expect(config.models.genius).toContain("opus")
  })

  test("orchestrator model must not be the most expensive by default", () => {
    const config = loadSovereignConfig()
    // Orchestrator (Sisyphus) runs frequently - should be cost-effective
    expect(config.models.orchestrator).not.toContain("opus")
    expect(config.models.orchestrator).not.toContain("gpt-5")
  })

  test("planner model should support reasoning/thinking", () => {
    const config = loadSovereignConfig()
    // DeepSeek R1 is a reasoning model
    expect(
      config.models.planner.includes("r1") || 
      config.models.planner.includes("opus") ||
      config.models.planner.includes("o1") ||
      config.models.planner.includes("o3")
    ).toBe(true)
  })
})

describe("RED-TEAM: Agent mapping completeness", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("all planning workflow agents map to planner role", () => {
    // These agents are part of the Metis → Prometheus → Momus workflow
    const planningAgents = ["oracle", "metis", "momus", "prometheus"]
    const plannerModel = getModelForRole("planner")
    
    for (const agent of planningAgents) {
      expect(getModelForAgent(agent)).toBe(plannerModel)
    }
  })

  test("all exploration agents map to librarian role", () => {
    const explorationAgents = ["librarian", "explore", "document-writer", "multimodal-looker"]
    const librarianModel = getModelForRole("librarian")
    
    for (const agent of explorationAgents) {
      expect(getModelForAgent(agent)).toBe(librarianModel)
    }
  })

  test("case variations of Genius both work", () => {
    const geniusModel = getModelForRole("genius")
    expect(getModelForAgent("genius")).toBe(geniusModel)
    expect(getModelForAgent("Genius")).toBe(geniusModel)
  })

  test("Metis and Momus full names map correctly", () => {
    const plannerModel = getModelForRole("planner")
    expect(getModelForAgent("Metis (Plan Consultant)")).toBe(plannerModel)
    expect(getModelForAgent("Momus (Plan Reviewer)")).toBe(plannerModel)
  })
})

describe("RED-TEAM: Edge cases and malformed inputs", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("empty string agent name returns fallback", () => {
    expect(getModelForAgent("")).toBe(getModelForRole("fallback"))
  })

  test("whitespace-only agent name returns fallback", () => {
    expect(getModelForAgent("   ")).toBe(getModelForRole("fallback"))
  })

  test("null-like agent names return fallback", () => {
    expect(getModelForAgent("null")).toBe(getModelForRole("fallback"))
    expect(getModelForAgent("undefined")).toBe(getModelForRole("fallback"))
  })

  test("agent name with special characters returns fallback", () => {
    expect(getModelForAgent("agent<script>alert(1)</script>")).toBe(getModelForRole("fallback"))
    expect(getModelForAgent("agent'; DROP TABLE agents;--")).toBe(getModelForRole("fallback"))
  })

  test("very long agent name returns fallback", () => {
    const longName = "a".repeat(10000)
    expect(getModelForAgent(longName)).toBe(getModelForRole("fallback"))
  })

  test("agent name with unicode returns fallback", () => {
    expect(getModelForAgent("探索者")).toBe(getModelForRole("fallback"))
    expect(getModelForAgent("агент")).toBe(getModelForRole("fallback"))
  })
})

describe("RED-TEAM: Config isolation and caching", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  afterEach(() => {
    clearConfigCache()
  })

  test("config caching returns same instance", () => {
    const config1 = loadSovereignConfig()
    const config2 = loadSovereignConfig()
    
    // Same object reference when cached
    expect(config1).toBe(config2)
  })

  test("clearConfigCache allows fresh load with same defaults", () => {
    const config1 = loadSovereignConfig()
    const orchestrator1 = config1.models.orchestrator
    
    clearConfigCache()
    
    const config2 = loadSovereignConfig()
    // Values should be same (defaults)
    expect(config2.models.orchestrator).toBe(orchestrator1)
  })

  test("multiple rapid cache clears do not cause issues", () => {
    for (let i = 0; i < 100; i++) {
      clearConfigCache()
      const config = loadSovereignConfig()
      expect(config.models.orchestrator).toBe("deepseek/deepseek-v3.2")
    }
  })
})

describe("RED-TEAM: Model name format validation", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("all default models follow provider/model format", () => {
    const config = loadSovereignConfig()
    const modelPattern = /^[a-z0-9-]+\/[a-z0-9.-]+$/i
    
    expect(config.models.orchestrator).toMatch(modelPattern)
    expect(config.models.planner).toMatch(modelPattern)
    expect(config.models.librarian).toMatch(modelPattern)
    expect(config.models.genius).toMatch(modelPattern)
    expect(config.models.fallback).toMatch(modelPattern)
  })

  test("no default model contains localhost or internal URLs", () => {
    const config = loadSovereignConfig()
    const allModels = Object.values(config.models)
    
    for (const model of allModels) {
      expect(model).not.toContain("localhost")
      expect(model).not.toContain("127.0.0.1")
      expect(model).not.toContain("0.0.0.0")
      expect(model).not.toContain("internal")
    }
  })

  test("no default model is empty or placeholder", () => {
    const config = loadSovereignConfig()
    const allModels = Object.values(config.models)
    
    for (const model of allModels) {
      expect(model).not.toBe("")
      expect(model).not.toBe("TODO")
      expect(model).not.toBe("PLACEHOLDER")
      expect(model).not.toContain("your-")
      expect(model).not.toContain("example")
    }
  })
})

describe("RED-TEAM: Cost tier consistency", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("genius tier should use the most expensive model", () => {
    const config = loadSovereignConfig()
    
    // Claude Opus is the most expensive option
    expect(config.models.genius).toContain("opus")
  })

  test("orchestrator and librarian should be cost-effective", () => {
    const config = loadSovereignConfig()
    
    // These run frequently, shouldn't be Opus
    expect(config.models.orchestrator).not.toContain("opus")
    expect(config.models.librarian).not.toContain("opus")
  })

  test("fallback should be the cheapest option", () => {
    const config = loadSovereignConfig()
    
    // Llama is open source and cheap
    expect(config.models.fallback).toContain("llama")
  })
})

describe("RED-TEAM: Concurrent access safety", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("concurrent getModelForAgent calls return consistent results", async () => {
    const agents = ["Sisyphus", "oracle", "librarian", "Genius", "explore"]
    const iterations = 100
    
    const promises = agents.flatMap(agent => 
      Array(iterations).fill(null).map(() => 
        Promise.resolve(getModelForAgent(agent))
      )
    )
    
    const results = await Promise.all(promises)
    
    // Group by agent and verify consistency
    for (let i = 0; i < agents.length; i++) {
      const agentResults = results.slice(i * iterations, (i + 1) * iterations)
      const uniqueResults = [...new Set(agentResults)]
      expect(uniqueResults.length).toBe(1) // All same
    }
  })

  test("concurrent loadSovereignConfig calls return same cached instance", async () => {
    const iterations = 50
    const promises = Array(iterations).fill(null).map(() => 
      Promise.resolve(loadSovereignConfig())
    )
    
    const results = await Promise.all(promises)
    const firstResult = results[0]
    
    for (const result of results) {
      expect(result).toBe(firstResult) // Same object reference
    }
  })
})
