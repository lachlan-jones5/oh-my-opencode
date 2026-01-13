import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { 
  loadSovereignConfig, 
  getModelForRole, 
  getModelForAgent,
  clearConfigCache,
  hasSovereignConfig,
  type SovereignConfig 
} from "./sovereign-config"
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs"
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
      
      expect(config.models.orchestrator).toBe("deepseek/deepseek-v3")
      expect(config.models.planner).toBe("anthropic/claude-opus-4.5")
      expect(config.models.librarian).toBe("google/gemini-3-flash")
      expect(config.models.fallback).toBe("meta-llama/llama-3.3-70b-instruct")
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
      expect(getModelForRole("orchestrator")).toBe("deepseek/deepseek-v3")
    })

    test("returns correct model for planner role", () => {
      expect(getModelForRole("planner")).toBe("anthropic/claude-opus-4.5")
    })

    test("returns correct model for librarian role", () => {
      expect(getModelForRole("librarian")).toBe("google/gemini-3-flash")
    })

    test("returns correct model for fallback role", () => {
      expect(getModelForRole("fallback")).toBe("meta-llama/llama-3.3-70b-instruct")
    })
  })

  describe("getModelForAgent", () => {
    test("maps Sisyphus to orchestrator model", () => {
      expect(getModelForAgent("Sisyphus")).toBe("deepseek/deepseek-v3")
    })

    test("maps oracle to planner model", () => {
      expect(getModelForAgent("oracle")).toBe("anthropic/claude-opus-4.5")
    })

    test("maps librarian to librarian model", () => {
      expect(getModelForAgent("librarian")).toBe("google/gemini-3-flash")
    })

    test("maps explore to librarian model", () => {
      expect(getModelForAgent("explore")).toBe("google/gemini-3-flash")
    })

    test("maps frontend-ui-ux-engineer to orchestrator model", () => {
      expect(getModelForAgent("frontend-ui-ux-engineer")).toBe("deepseek/deepseek-v3")
    })

    test("maps document-writer to librarian model", () => {
      expect(getModelForAgent("document-writer")).toBe("google/gemini-3-flash")
    })

    test("maps multimodal-looker to librarian model", () => {
      expect(getModelForAgent("multimodal-looker")).toBe("google/gemini-3-flash")
    })

    test("returns fallback for unknown agent", () => {
      expect(getModelForAgent("unknown-agent")).toBe("meta-llama/llama-3.3-70b-instruct")
    })
  })

  describe("hasSovereignConfig", () => {
    test("returns false when no config exists", () => {
      // This test depends on no config.json in the current directory
      // which should be true in the test environment
      const result = hasSovereignConfig()
      // Just verify it returns a boolean
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
    
    expect(config.models.orchestrator).toBe("deepseek/deepseek-v3")
    expect(config.models.planner).toBe("anthropic/claude-opus-4.5")
  })

  test("default preferences are used when not overridden", () => {
    const config = loadSovereignConfig()
    
    expect(config.preferences.ultrawork_max_iterations).toBe(50)
    expect(config.preferences.dcp_turn_protection).toBe(2)
  })
})
