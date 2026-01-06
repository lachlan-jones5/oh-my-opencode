import { log } from "../shared"

interface FrugalWorkflowState {
  sessionID: string
  stage: "idle" | "awaiting-test-command" | "planning" | "executing" | "verifying" | "reviewing" | "completed" | "failed"
  userRequest?: string
  testCommand?: string
  spec?: string
  attempt: number
  maxAttempts: number
  files?: Array<{ path: string; action: string; content: string }>
  lastError?: string
}

const sessionStates = new Map<string, FrugalWorkflowState>()

function getState(sessionID: string): FrugalWorkflowState {
  if (!sessionStates.has(sessionID)) {
    sessionStates.set(sessionID, {
      sessionID,
      stage: "idle",
      attempt: 0,
      maxAttempts: 3,
    })
  }
  return sessionStates.get(sessionID)!
}

function setState(sessionID: string, updates: Partial<FrugalWorkflowState>): void {
  const current = getState(sessionID)
  sessionStates.set(sessionID, { ...current, ...updates })
}

function parseXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function parseXmlFiles(xml: string): Array<{ path: string; action: string; content: string }> {
  const files: Array<{ path: string; action: string; content: string }> = []
  const fileRegex = /<file\s+path="([^"]+)"\s+action="([^"]+)">[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/file>/gi
  
  let match
  while ((match = fileRegex.exec(xml)) !== null) {
    files.push({
      path: match[1],
      action: match[2],
      content: match[3],
    })
  }
  
  return files
}

async function writeFiles(
  files: Array<{ path: string; action: string; content: string }>,
  workingDirectory: string,
  writeFile: (path: string, content: string) => Promise<void>
): Promise<void> {
  for (const file of files) {
    if (file.action === "delete") {
      log(`[frugal-workflow] Skipping delete action for: ${file.path}`)
      continue
    }
    
    const fullPath = file.path.startsWith("/") 
      ? file.path 
      : `${workingDirectory}/${file.path}`
    
    log(`[frugal-workflow] Writing file: ${fullPath}`)
    await writeFile(fullPath, file.content)
  }
}

export function createFrugalWorkflowHook() {
  return {
    "chat.message": async (input: any, output: any): Promise<void> => {
      const state = getState(input.sessionID)
      const textPart = output.parts?.find((p: any) => p.type === "text")
      if (!textPart?.text) return
      
      const messageText = textPart.text
      
      if (messageText.includes("/frugal") && state.stage === "idle") {
        const match = messageText.match(/\/frugal\s+(.+)/)
        const userRequest = match ? match[1].trim() : ""
        
        log(`[frugal-workflow] Detected /frugal invocation`, {
          sessionID: input.sessionID,
          request: userRequest,
        })
        
        setState(input.sessionID, {
          stage: "awaiting-test-command",
          userRequest,
          attempt: 0,
        })
        
        const promptText = `[FRUGAL WORKFLOW INITIATED]

I'll implement this feature using the Frugal Architect workflow:
- Senior (Opus 4.5) will create the spec
- Junior (GPT-5 Mini) will implement it
- Automated verification and review

First, I need to know: What command should I run to test the implementation?
Examples: "npm test", "bun test", "cargo test", "skip" (to skip testing)

Please provide the test command:`
        
        textPart.text = promptText
      }
    },
    
    "tool.call": async (input: any, output: any): Promise<void> => {
    },
  }
}
