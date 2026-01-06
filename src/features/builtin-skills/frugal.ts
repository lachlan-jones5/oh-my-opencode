import type { BuiltinSkill } from "./types"

const frugalSkill: BuiltinSkill = {
  name: "frugal",
  description: "Two-agent Frugal Architect workflow: Senior (Opus 4.5) plans specs, Junior (GPT-5 Mini) implements code. Automated verification and review.",
  template: `# Frugal Architect Workflow

Implement features using a cost-optimized two-agent workflow:

## How It Works

1. **Frugal Senior** (Claude Opus 4.5) - The Architect
   - Analyzes your request and gathers context
   - Delegates research to explore/librarian/oracle
   - Creates detailed XML specification
   - Reviews implementation after completion

2. **Frugal Junior** (GPT-5 Mini) - The Builder
   - Parses Senior's XML spec
   - Implements all code changes
   - Runs tests and verification
   - Retries up to 3 times if tests fail

3. **Senior Review**
   - Examines diffs and implementation
   - Either APPROVES or requests REVISIONS
   - If revisions needed, Junior iterates

## Usage

Simply invoke this skill with your feature request:

\`\`\`
/frugal Add user authentication with JWT tokens
\`\`\`

The workflow will automatically:
- Gather context from your codebase
- Create a comprehensive technical spec
- Implement all necessary files
- Run your test suite
- Review and refine the implementation

## Test Command

The workflow will prompt you for a test command (e.g., \`npm test\`, \`bun test\`).
You can also say "skip" if you don't want to run tests.

## Cost Optimization

This workflow is designed to be "frugal":
- Expensive Opus model only used for planning and review
- Cheap GPT-5 Mini model does all the implementation work
- Automated retries prevent wasted iterations`,
}

export { frugalSkill }
