import { describe, test, expect, beforeEach } from "bun:test"
import { builtinAgents } from "./index"
import { clearConfigCache, getModelForAgent, getModelForRole } from "../config"
import type { BuiltinAgentName } from "./types"

describe("Agent Registry - builtinAgents", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  describe("Registry completeness", () => {
    test("all expected agents are registered", () => {
      const expectedAgents: BuiltinAgentName[] = [
        "Sisyphus",
        "oracle",
        "librarian",
        "explore",
        "frontend-ui-ux-engineer",
        "document-writer",
        "multimodal-looker",
        "Metis (Plan Consultant)",
        "Momus (Plan Reviewer)",
        "orchestrator-sisyphus",
        "Genius",
      ]

      for (const agentName of expectedAgents) {
        expect(builtinAgents[agentName]).toBeDefined()
        expect(builtinAgents[agentName].model).toBeDefined()
        expect(builtinAgents[agentName].mode).toBeDefined()
      }
    })

    test("Genius agent is in registry", () => {
      expect(builtinAgents["Genius"]).toBeDefined()
      expect(builtinAgents["Genius"].mode).toBe("primary")
    })

    test("total agent count matches expected", () => {
      expect(Object.keys(builtinAgents).length).toBe(11)
    })
  })

  describe("Agent modes", () => {
    test("Sisyphus is primary agent", () => {
      expect(builtinAgents["Sisyphus"].mode).toBe("primary")
    })

    test("Genius is primary agent", () => {
      expect(builtinAgents["Genius"].mode).toBe("primary")
    })

    test("oracle is subagent", () => {
      expect(builtinAgents["oracle"].mode).toBe("subagent")
    })

    test("explore is subagent", () => {
      expect(builtinAgents["explore"].mode).toBe("subagent")
    })

    test("Metis is subagent", () => {
      expect(builtinAgents["Metis (Plan Consultant)"].mode).toBe("subagent")
    })

    test("Momus is subagent", () => {
      expect(builtinAgents["Momus (Plan Reviewer)"].mode).toBe("subagent")
    })
  })

  describe("Agent model assignments", () => {
    test("all agents have non-empty models", () => {
      for (const [name, agent] of Object.entries(builtinAgents)) {
        expect(agent.model).toBeDefined()
        expect(agent.model.length).toBeGreaterThan(0)
      }
    })

    test("Sisyphus uses orchestrator model", () => {
      expect(builtinAgents["Sisyphus"].model).toBe(getModelForRole("orchestrator"))
    })

    test("Genius uses genius model", () => {
      expect(builtinAgents["Genius"].model).toBe(getModelForRole("genius"))
    })

    test("oracle uses planner model", () => {
      expect(builtinAgents["oracle"].model).toBe(getModelForRole("planner"))
    })

    test("explore uses librarian model", () => {
      expect(builtinAgents["explore"].model).toBe(getModelForRole("librarian"))
    })
  })
})

// ============================================================================
// RED-TEAM: Agent Integrity Tests
// ============================================================================

describe("RED-TEAM: All agents have required properties", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("every agent has a model", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      expect(agent.model, `${name} missing model`).toBeDefined()
      expect(typeof agent.model, `${name} model not string`).toBe("string")
    }
  })

  test("every agent has a mode", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      expect(agent.mode, `${name} missing mode`).toBeDefined()
      expect(["primary", "subagent"], `${name} invalid mode`).toContain(agent.mode)
    }
  })

  test("every agent has a description", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      expect(agent.description, `${name} missing description`).toBeDefined()
      expect(agent.description.length, `${name} empty description`).toBeGreaterThan(0)
    }
  })

  test("every agent has a prompt", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      expect(agent.prompt, `${name} missing prompt`).toBeDefined()
      expect(agent.prompt!.length, `${name} empty prompt`).toBeGreaterThan(0)
    }
  })
})

describe("RED-TEAM: Model assignment consistency", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("orchestrator agents use orchestrator model", () => {
    const orchestratorModel = getModelForRole("orchestrator")
    
    expect(builtinAgents["Sisyphus"].model).toBe(orchestratorModel)
    expect(builtinAgents["frontend-ui-ux-engineer"].model).toBe(orchestratorModel)
  })

  test("planner agents use planner model", () => {
    const plannerModel = getModelForRole("planner")
    
    expect(builtinAgents["oracle"].model).toBe(plannerModel)
    expect(builtinAgents["Metis (Plan Consultant)"].model).toBe(plannerModel)
    expect(builtinAgents["Momus (Plan Reviewer)"].model).toBe(plannerModel)
  })

  test("librarian agents use librarian model", () => {
    const librarianModel = getModelForRole("librarian")
    
    expect(builtinAgents["librarian"].model).toBe(librarianModel)
    expect(builtinAgents["explore"].model).toBe(librarianModel)
    expect(builtinAgents["document-writer"].model).toBe(librarianModel)
    expect(builtinAgents["multimodal-looker"].model).toBe(librarianModel)
  })

  test("genius agent uses genius model", () => {
    const geniusModel = getModelForRole("genius")
    
    expect(builtinAgents["Genius"].model).toBe(geniusModel)
  })
})

describe("RED-TEAM: No hardcoded expensive models", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("Metis is not hardcoded to opus", () => {
    const model = builtinAgents["Metis (Plan Consultant)"].model
    expect(model).not.toBe("anthropic/claude-opus-4-5")
    expect(model).not.toBe("anthropic/claude-opus-4.5")
  })

  test("Momus is not hardcoded to gpt-5.2", () => {
    const model = builtinAgents["Momus (Plan Reviewer)"].model
    expect(model).not.toBe("openai/gpt-5.2")
  })

  test("oracle is not hardcoded to expensive model", () => {
    const model = builtinAgents["oracle"].model
    // Should use planner (deepseek-r1) not opus
    expect(model).not.toContain("opus")
    expect(model).not.toContain("gpt-5")
  })

  test("only Genius uses the most expensive model", () => {
    const geniusModel = builtinAgents["Genius"].model
    
    for (const [name, agent] of Object.entries(builtinAgents)) {
      if (name === "Genius") continue
      expect(agent.model, `${name} should not use genius model`).not.toBe(geniusModel)
    }
  })
})

describe("RED-TEAM: Agent descriptions are meaningful", () => {
  test("descriptions mention agent purpose", () => {
    expect(builtinAgents["Sisyphus"].description).toMatch(/orchestrat|primary/i)
    expect(builtinAgents["Genius"].description).toMatch(/escape|expert|hard/i)
    expect(builtinAgents["explore"].description).toMatch(/search|codebase|find/i)
    expect(builtinAgents["librarian"].description).toMatch(/research|docs|library/i)
  })

  test("descriptions do not contain TODO or placeholders", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      expect(agent.description).not.toContain("TODO")
      expect(agent.description).not.toContain("FIXME")
      expect(agent.description).not.toContain("placeholder")
    }
  })
})

describe("RED-TEAM: Agent prompts are well-formed", () => {
  test("prompts are non-empty and substantial", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      const prompt = agent.prompt || ""
      // Each prompt should be substantial (at least 100 chars)
      expect(prompt.length, `${name} prompt too short`).toBeGreaterThan(100)
    }
  })

  test("prompts do not leak internal paths", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      const prompt = agent.prompt || ""
      expect(prompt).not.toContain("/home/lachlan")
      expect(prompt).not.toContain("node_modules")
      expect(prompt).not.toContain(".git/")
    }
  })

  test("prompts do not contain actual API keys", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      const prompt = agent.prompt || ""
      // Check for actual API key patterns (real keys have specific formats)
      // sk-or-v1- is OpenRouter, sk-ant- is Anthropic, sk-proj- is OpenAI
      expect(prompt).not.toMatch(/sk-or-v1-[a-zA-Z0-9]{20,}/)
      expect(prompt).not.toMatch(/sk-ant-[a-zA-Z0-9]{20,}/)
      expect(prompt).not.toMatch(/sk-proj-[a-zA-Z0-9]{20,}/)
      expect(prompt).not.toContain("api_key=sk-")
    }
  })
})

describe("RED-TEAM: Primary vs Subagent capabilities", () => {
  test("primary agents can delegate (no task tool restriction)", () => {
    const sisyphus = builtinAgents["Sisyphus"]
    const genius = builtinAgents["Genius"]
    
    // Primary agents should NOT have task tool blocked in either format
    const sisyphusTaskBlocked = sisyphus.tools?.task === false || sisyphus.permission?.task === "deny"
    const geniusTaskBlocked = genius.tools?.task === false || genius.permission?.task === "deny"
    
    expect(sisyphusTaskBlocked).toBe(false)
    expect(geniusTaskBlocked).toBe(false)
  })

  test("planning subagents have write/edit restricted", () => {
    const metis = builtinAgents["Metis (Plan Consultant)"]
    const momus = builtinAgents["Momus (Plan Reviewer)"]
    const oracle = builtinAgents["oracle"]
    
    // Check either legacy tools or new permission format
    const metisWriteBlocked = metis.tools?.write === false || metis.permission?.write === "deny"
    const metisEditBlocked = metis.tools?.edit === false || metis.permission?.edit === "deny"
    const momusWriteBlocked = momus.tools?.write === false || momus.permission?.write === "deny"
    const momusEditBlocked = momus.tools?.edit === false || momus.permission?.edit === "deny"
    const oracleWriteBlocked = oracle.tools?.write === false || oracle.permission?.write === "deny"
    const oracleEditBlocked = oracle.tools?.edit === false || oracle.permission?.edit === "deny"
    
    expect(metisWriteBlocked).toBe(true)
    expect(metisEditBlocked).toBe(true)
    expect(momusWriteBlocked).toBe(true)
    expect(momusEditBlocked).toBe(true)
    expect(oracleWriteBlocked).toBe(true)
    expect(oracleEditBlocked).toBe(true)
  })

  test("exploration subagents can read but not write", () => {
    const explore = builtinAgents["explore"]
    const multimodal = builtinAgents["multimodal-looker"]
    
    const exploreWriteBlocked = explore.tools?.write === false || explore.permission?.write === "deny"
    const exploreEditBlocked = explore.tools?.edit === false || explore.permission?.edit === "deny"
    const multimodalWriteBlocked = multimodal.tools?.write === false || multimodal.permission?.write === "deny"
    const multimodalEditBlocked = multimodal.tools?.edit === false || multimodal.permission?.edit === "deny"
    
    expect(exploreWriteBlocked).toBe(true)
    expect(exploreEditBlocked).toBe(true)
    expect(multimodalWriteBlocked).toBe(true)
    expect(multimodalEditBlocked).toBe(true)
  })
})

describe("RED-TEAM: Agent color assignments", () => {
  test("Genius has distinctive gold color", () => {
    expect(builtinAgents["Genius"].color).toBe("#FFD700")
  })

  test("all agents with colors have valid hex format", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    
    for (const [name, agent] of Object.entries(builtinAgents)) {
      if (agent.color) {
        expect(agent.color, `${name} invalid color`).toMatch(hexPattern)
      }
    }
  })
})

describe("RED-TEAM: MaxTokens and thinking budgets", () => {
  test("Sisyphus has high maxTokens for complex orchestration", () => {
    expect(builtinAgents["Sisyphus"].maxTokens).toBeGreaterThanOrEqual(32000)
  })

  test("Genius has high maxTokens for deep reasoning", () => {
    expect(builtinAgents["Genius"].maxTokens).toBeGreaterThanOrEqual(32000)
  })

  test("agents with thinking have reasonable budgets", () => {
    for (const [name, agent] of Object.entries(builtinAgents)) {
      if (agent.thinking?.budgetTokens) {
        expect(agent.thinking.budgetTokens, `${name} thinking budget too low`)
          .toBeGreaterThanOrEqual(8000)
        expect(agent.thinking.budgetTokens, `${name} thinking budget too high`)
          .toBeLessThanOrEqual(100000)
      }
    }
  })
})
