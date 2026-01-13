import { describe, test, expect } from "bun:test"
import {
  getDCPPromptForRole,
  getDCPPromptForAgent,
  DCP_ORCHESTRATOR_PROMPT,
  DCP_RESEARCHER_PROMPT,
  DCP_PLANNER_PROMPT,
} from "./dcp-prompts"

describe("dcp-prompts", () => {
  describe("DCP prompt constants", () => {
    test("DCP_ORCHESTRATOR_PROMPT contains context management guidance", () => {
      expect(DCP_ORCHESTRATOR_PROMPT).toContain("Context Management")
      expect(DCP_ORCHESTRATOR_PROMPT).toContain("Tool outputs may be pruned")
      expect(DCP_ORCHESTRATOR_PROMPT).toContain("Preserve important information")
      expect(DCP_ORCHESTRATOR_PROMPT).toContain("Work incrementally")
      expect(DCP_ORCHESTRATOR_PROMPT).toContain("Recent context is safe")
    })

    test("DCP_RESEARCHER_PROMPT contains research-specific guidance", () => {
      expect(DCP_RESEARCHER_PROMPT).toContain("Context Management")
      expect(DCP_RESEARCHER_PROMPT).toContain("Summarize findings")
      expect(DCP_RESEARCHER_PROMPT).toContain("Be specific")
      expect(DCP_RESEARCHER_PROMPT).toContain("Work efficiently")
    })

    test("DCP_PLANNER_PROMPT contains planning-specific guidance", () => {
      expect(DCP_PLANNER_PROMPT).toContain("Context Management")
      expect(DCP_PLANNER_PROMPT).toContain("Self-contained advice")
      expect(DCP_PLANNER_PROMPT).toContain("Include key details")
      expect(DCP_PLANNER_PROMPT).toContain("Structured output")
    })
  })

  describe("getDCPPromptForRole", () => {
    test("returns orchestrator prompt for orchestrator role", () => {
      const prompt = getDCPPromptForRole("orchestrator")
      expect(prompt).toBe(DCP_ORCHESTRATOR_PROMPT)
    })

    test("returns researcher prompt for researcher role", () => {
      const prompt = getDCPPromptForRole("researcher")
      expect(prompt).toBe(DCP_RESEARCHER_PROMPT)
    })

    test("returns planner prompt for planner role", () => {
      const prompt = getDCPPromptForRole("planner")
      expect(prompt).toBe(DCP_PLANNER_PROMPT)
    })
  })

  describe("getDCPPromptForAgent", () => {
    test("maps Sisyphus to orchestrator prompt", () => {
      const prompt = getDCPPromptForAgent("Sisyphus")
      expect(prompt).toBe(DCP_ORCHESTRATOR_PROMPT)
    })

    test("maps oracle to planner prompt", () => {
      const prompt = getDCPPromptForAgent("oracle")
      expect(prompt).toBe(DCP_PLANNER_PROMPT)
    })

    test("maps librarian to researcher prompt", () => {
      const prompt = getDCPPromptForAgent("librarian")
      expect(prompt).toBe(DCP_RESEARCHER_PROMPT)
    })

    test("maps explore to researcher prompt", () => {
      const prompt = getDCPPromptForAgent("explore")
      expect(prompt).toBe(DCP_RESEARCHER_PROMPT)
    })

    test("maps frontend-ui-ux-engineer to orchestrator prompt", () => {
      const prompt = getDCPPromptForAgent("frontend-ui-ux-engineer")
      expect(prompt).toBe(DCP_ORCHESTRATOR_PROMPT)
    })

    test("maps document-writer to researcher prompt", () => {
      const prompt = getDCPPromptForAgent("document-writer")
      expect(prompt).toBe(DCP_RESEARCHER_PROMPT)
    })

    test("maps multimodal-looker to researcher prompt", () => {
      const prompt = getDCPPromptForAgent("multimodal-looker")
      expect(prompt).toBe(DCP_RESEARCHER_PROMPT)
    })

    test("returns orchestrator prompt for unknown agent", () => {
      const prompt = getDCPPromptForAgent("unknown-agent")
      expect(prompt).toBe(DCP_ORCHESTRATOR_PROMPT)
    })
  })

  describe("prompt content quality", () => {
    test("all prompts are non-empty strings", () => {
      expect(typeof DCP_ORCHESTRATOR_PROMPT).toBe("string")
      expect(typeof DCP_RESEARCHER_PROMPT).toBe("string")
      expect(typeof DCP_PLANNER_PROMPT).toBe("string")
      
      expect(DCP_ORCHESTRATOR_PROMPT.length).toBeGreaterThan(100)
      expect(DCP_RESEARCHER_PROMPT.length).toBeGreaterThan(100)
      expect(DCP_PLANNER_PROMPT.length).toBeGreaterThan(100)
    })

    test("prompts do not contain placeholder text", () => {
      const placeholders = ["{{", "}}", "TODO", "FIXME", "XXX"]
      
      for (const placeholder of placeholders) {
        expect(DCP_ORCHESTRATOR_PROMPT).not.toContain(placeholder)
        expect(DCP_RESEARCHER_PROMPT).not.toContain(placeholder)
        expect(DCP_PLANNER_PROMPT).not.toContain(placeholder)
      }
    })
  })
})
