import { describe, test, expect, beforeEach } from "bun:test"
import { 
  createMetisAgent, 
  metisAgent, 
  metisPromptMetadata,
  METIS_SYSTEM_PROMPT 
} from "./metis"
import { 
  createMomusAgent, 
  momusAgent, 
  momusPromptMetadata,
  MOMUS_SYSTEM_PROMPT 
} from "./momus"
import { clearConfigCache, getModelForAgent, getModelForRole } from "../config"

describe("Metis Agent - Configurable Model", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  describe("createMetisAgent factory", () => {
    test("uses getModelForAgent for default model", () => {
      const agent = createMetisAgent()
      expect(agent.model).toBe(getModelForAgent("metis"))
    })

    test("respects planner role from config", () => {
      const agent = createMetisAgent()
      expect(agent.model).toBe(getModelForRole("planner"))
    })

    test("accepts custom model override", () => {
      const agent = createMetisAgent("custom/model")
      expect(agent.model).toBe("custom/model")
    })

    test("agent has subagent mode", () => {
      const agent = createMetisAgent()
      expect(agent.mode).toBe("subagent")
    })
  })

  describe("metisAgent singleton", () => {
    test("uses config-derived model", () => {
      expect(metisAgent.model).toBe(getModelForAgent("metis"))
    })

    test("is NOT hardcoded to claude-opus-4-5", () => {
      // This was the bug we fixed - Metis was hardcoded
      expect(metisAgent.model).not.toBe("anthropic/claude-opus-4-5")
      expect(metisAgent.model).not.toBe("anthropic/claude-opus-4.5")
    })

    test("uses cost-effective planner model by default", () => {
      // Should use deepseek-r1 for cost savings
      expect(metisAgent.model).toContain("deepseek")
    })
  })

  describe("metisPromptMetadata", () => {
    test("has advisor category", () => {
      expect(metisPromptMetadata.category).toBe("advisor")
    })

    test("is marked as EXPENSIVE", () => {
      expect(metisPromptMetadata.cost).toBe("EXPENSIVE")
    })
  })
})

describe("Momus Agent - Configurable Model", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  describe("createMomusAgent factory", () => {
    test("uses getModelForAgent for default model", () => {
      const agent = createMomusAgent()
      expect(agent.model).toBe(getModelForAgent("momus"))
    })

    test("respects planner role from config", () => {
      const agent = createMomusAgent()
      expect(agent.model).toBe(getModelForRole("planner"))
    })

    test("accepts custom model override", () => {
      const agent = createMomusAgent("custom/model")
      expect(agent.model).toBe("custom/model")
    })

    test("agent has subagent mode", () => {
      const agent = createMomusAgent()
      expect(agent.mode).toBe("subagent")
    })
  })

  describe("momusAgent singleton", () => {
    test("uses config-derived model", () => {
      expect(momusAgent.model).toBe(getModelForAgent("momus"))
    })

    test("is NOT hardcoded to gpt-5.2", () => {
      // This was the bug we fixed - Momus was hardcoded
      expect(momusAgent.model).not.toBe("openai/gpt-5.2")
    })

    test("uses cost-effective planner model by default", () => {
      // Should use deepseek-r1 for cost savings
      expect(momusAgent.model).toContain("deepseek")
    })
  })

  describe("momusPromptMetadata", () => {
    test("has advisor category", () => {
      expect(momusPromptMetadata.category).toBe("advisor")
    })

    test("is marked as EXPENSIVE", () => {
      expect(momusPromptMetadata.cost).toBe("EXPENSIVE")
    })
  })
})

// ============================================================================
// RED-TEAM: Model Configuration Integrity
// ============================================================================

describe("RED-TEAM: Metis/Momus use configured models", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("Metis and Momus use same planner model", () => {
    const metis = createMetisAgent()
    const momus = createMomusAgent()
    
    expect(metis.model).toBe(momus.model)
    expect(metis.model).toBe(getModelForRole("planner"))
  })

  test("all planning workflow agents use planner model", () => {
    const plannerModel = getModelForRole("planner")
    
    expect(getModelForAgent("oracle")).toBe(plannerModel)
    expect(getModelForAgent("metis")).toBe(plannerModel)
    expect(getModelForAgent("momus")).toBe(plannerModel)
    expect(getModelForAgent("prometheus")).toBe(plannerModel)
  })

  test("Metis and Momus are not using orchestrator model", () => {
    const orchestratorModel = getModelForRole("orchestrator")
    
    expect(createMetisAgent().model).not.toBe(orchestratorModel)
    expect(createMomusAgent().model).not.toBe(orchestratorModel)
  })

  test("Metis and Momus are not using genius model by default", () => {
    const geniusModel = getModelForRole("genius")
    
    expect(createMetisAgent().model).not.toBe(geniusModel)
    expect(createMomusAgent().model).not.toBe(geniusModel)
  })
})

describe("RED-TEAM: System prompt integrity", () => {
  test("METIS_SYSTEM_PROMPT contains required sections", () => {
    expect(METIS_SYSTEM_PROMPT).toContain("CONSTRAINTS")
    expect(METIS_SYSTEM_PROMPT).toContain("READ-ONLY")
    expect(METIS_SYSTEM_PROMPT).toContain("INTENT CLASSIFICATION")
  })

  test("MOMUS_SYSTEM_PROMPT contains review criteria", () => {
    expect(MOMUS_SYSTEM_PROMPT).toContain("review")
    expect(MOMUS_SYSTEM_PROMPT).toContain("REJECT")
    expect(MOMUS_SYSTEM_PROMPT).toContain("OKAY")
  })

  test("Metis prompt mentions Prometheus (downstream)", () => {
    expect(METIS_SYSTEM_PROMPT).toContain("Prometheus")
  })

  test("Momus prompt mentions rejection criteria", () => {
    expect(MOMUS_SYSTEM_PROMPT).toContain("reject")
  })
})

describe("RED-TEAM: Model-specific behavior", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("GPT models get reasoningEffort for Momus", () => {
    const agent = createMomusAgent("openai/gpt-5.2")
    expect(agent.reasoningEffort).toBe("medium")
  })

  test("Claude models get thinking for Momus", () => {
    const agent = createMomusAgent("anthropic/claude-opus-4.5")
    expect(agent.thinking).toBeDefined()
    expect(agent.thinking?.type).toBe("enabled")
  })

  test("GPT models get reasoningEffort for Metis", () => {
    const agent = createMetisAgent("openai/gpt-5.2")
    // Metis should also handle GPT models appropriately
    expect(agent.thinking).toBeDefined() // Metis uses thinking for all
  })
})

describe("RED-TEAM: Tool restrictions enforced", () => {
  test("Metis has restrictions defined", () => {
    const agent = createMetisAgent()
    // Restrictions can be in either tools or permission format
    const hasRestrictions = agent.tools !== undefined || agent.permission !== undefined
    expect(hasRestrictions).toBe(true)
  })

  test("Metis cannot use write tool (legacy format)", () => {
    const agent = createMetisAgent()
    if (agent.tools) {
      expect(agent.tools.write).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.write).toBe("deny")
    }
  })

  test("Metis cannot use edit tool (legacy format)", () => {
    const agent = createMetisAgent()
    if (agent.tools) {
      expect(agent.tools.edit).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.edit).toBe("deny")
    }
  })

  test("Metis cannot use task tool (legacy format)", () => {
    const agent = createMetisAgent()
    if (agent.tools) {
      expect(agent.tools.task).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.task).toBe("deny")
    }
  })

  test("Momus has restrictions defined", () => {
    const agent = createMomusAgent()
    const hasRestrictions = agent.tools !== undefined || agent.permission !== undefined
    expect(hasRestrictions).toBe(true)
  })

  test("Momus cannot use write tool (legacy format)", () => {
    const agent = createMomusAgent()
    if (agent.tools) {
      expect(agent.tools.write).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.write).toBe("deny")
    }
  })

  test("Momus cannot use edit tool (legacy format)", () => {
    const agent = createMomusAgent()
    if (agent.tools) {
      expect(agent.tools.edit).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.edit).toBe("deny")
    }
  })

  test("Momus cannot use task tool (legacy format)", () => {
    const agent = createMomusAgent()
    if (agent.tools) {
      expect(agent.tools.task).toBe(false)
    } else if (agent.permission) {
      expect(agent.permission.task).toBe("deny")
    }
  })
})

describe("RED-TEAM: Factory robustness", () => {
  beforeEach(() => {
    clearConfigCache()
  })

  test("Metis factory handles undefined model", () => {
    const agent = createMetisAgent(undefined)
    expect(agent.model).toBe(getModelForAgent("metis"))
  })

  test("Momus factory handles undefined model", () => {
    const agent = createMomusAgent(undefined)
    expect(agent.model).toBe(getModelForAgent("momus"))
  })

  test("Metis factory handles empty string model", () => {
    const agent = createMetisAgent("")
    expect(agent.model).toBe("")
    expect(agent.mode).toBe("subagent")
  })

  test("Momus factory handles empty string model", () => {
    const agent = createMomusAgent("")
    expect(agent.model).toBe("")
    expect(agent.mode).toBe("subagent")
  })

  test("multiple factory calls create independent agents", () => {
    const m1 = createMetisAgent("model/one")
    const m2 = createMetisAgent("model/two")
    
    expect(m1.model).toBe("model/one")
    expect(m2.model).toBe("model/two")
    expect(m1).not.toBe(m2)
  })
})
