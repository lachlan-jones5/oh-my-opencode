import type { BuiltinSkill } from "./types"

const contextKernelSkill: BuiltinSkill = {
  name: "context-kernel",
  description: "Zero-copy context sharing + RLM-style code execution for sub-agents. Load data once, execute Python directly in namespace.",
  template: `# Context Kernel - Zero-Copy Sub-Agent Communication + Code Execution

Implements Recursive Language Model semantics for efficient context sharing and direct code execution.

## Problem

Traditional sub-agent dispatch suffers from O(N) cost/latency:
- 50KB file → 50KB embedded in every sub-agent prompt
- 5+ second spawn latency
- 15K+ token costs per sub-agent
- Memory waste (same data copied N times)

## Solution

Context Kernel provides **pointer semantics** + **direct code execution**:
1. **Root agent** loads data into shared namespace → gets variable name
2. **Sub-agents** receive only variable name, use tools to access
3. **Phase 1**: Zero-copy operations via peek/scan
4. **Phase 2**: Direct Python execution with eval_code

## Phase 1: Zero-Copy Access

### Root Agent Workflow

\`\`\`typescript
// 1. Load large content into namespace
const fileContent = await read("large-log.txt");
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "load_context",
  arguments: JSON.stringify({
    name: "log_data",
    content: fileContent,
    content_type: "log",
    metadata: { path: "large-log.txt", size: 50000 }
  })
});

// 2. Spawn sub-agent with variable reference (NOT full content)
await call_omo_agent({
  prompt: \`Analyze errors in variable 'log_data'.
  
  Use these tools to access the data:
  - peek('log_data', offset, limit) - Read specific lines
  - scan('log_data', pattern) - Search with regex
  - eval_code(code) - Execute Python directly with log_data variable
  
  Return insights, not raw data.\`,
  subagent_type: "explore"
});
\`\`\`

### Sub-Agent Workflow (Peek/Scan)

\`\`\`typescript
// 1. List available variables
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "list_vars"
});
// → { variables: [{ name: "log_data", line_count: 1000, size: 50000, ... }] }

// 2. Peek at first 100 lines
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "peek",
  arguments: JSON.stringify({
    name: "log_data",
    offset: 0,
    limit: 100
  })
});
// → { content: "line 1\\nline 2\\n...", has_more: true, total_lines: 1000 }

// 3. Search for errors
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "scan",
  arguments: JSON.stringify({
    name: "log_data",
    pattern: "ERROR|FATAL",
    context_lines: 2
  })
});
// → { matches: [{ line: 42, text: "ERROR: ...", context: [...] }] }

// 4. Return analysis (not raw data!)
return "Found 5 critical errors at lines 42, 105, 237..."
\`\`\`

## Phase 2: RLM-Style Code Execution

### Sub-Agent Workflow (eval_code)

\`\`\`typescript
// Execute Python directly in the namespace
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "eval_code",
  arguments: JSON.stringify({
    code: \`
# Access log_data variable directly
errors = [line for line in log_data['lines'] if 'ERROR' in line]
error_count = len(errors)
print(f"Found {error_count} errors")

# Show first 5 errors
for i, err in enumerate(errors[:5]):
    print(f"{i+1}. {err}")
\`
  })
});
// → { success: true, stdout: "Found 42 errors\\n1. ERROR: ...", ... }
\`\`\`

### Recursive LLM Queries (Deferred)

\`\`\`typescript
// Request LLM analysis from within code
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "eval_code",
  arguments: JSON.stringify({
    code: \`
# Collect errors and request LLM summary
errors = [line for line in log_data['lines'] if 'ERROR' in line][:10]
error_text = '\\\\n'.join(errors)

# This queues a deferred LLM query
summary = llm_query(f"Summarize these errors:\\\\n{error_text}")
print(summary)  # Prints "[DEFERRED:q_000] LLM query queued"
\`
  })
});
// → { pending_llm_queries: [{ id: "q_000", prompt: "Summarize..." }] }

// Parent agent fulfills the queries
const queries = result.pending_llm_queries;
const answers = await Promise.all(queries.map(q => someL LMCall(q.prompt)));

// Inject answers back into namespace
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "eval_code",
  arguments: JSON.stringify({
    code: \`llm_answers = \${JSON.stringify(answers)}\`
  })
});
\`\`\`

## Available Tools

### Phase 1 Tools

#### 1. load_context(name, content, content_type?, metadata?)
Load content into shared namespace with variable name.

**Arguments:**
- \`name\`: Variable name (e.g., "context", "log_data")
- \`content\`: Content to load (string)
- \`content_type\`: Type hint (file, log, json, custom)
- \`metadata\`: Optional metadata (path, size, encoding)

**Returns:**
\`\`\`json
{
  "name": "log_data",
  "line_count": 1000,
  "size": 50000,
  "type": "log",
  "expires_in": "5 minutes if not accessed"
}
\`\`\`

#### 2. peek(name, offset?, limit?)
Read a slice of content (zero-copy pagination).

**Arguments:**
- \`name\`: Variable name
- \`offset\`: Line offset (0-based, default: 0)
- \`limit\`: Lines to read (default: 2000, max: 20000)

**Returns:**
\`\`\`json
{
  "name": "log_data",
  "offset": 0,
  "limit": 100,
  "total_lines": 1000,
  "returned": 100,
  "has_more": true,
  "content": "line 1\\nline 2\\n..."
}
\`\`\`

#### 3. scan(name, pattern, context_lines?, max_matches?)
Search content with regex.

**Arguments:**
- \`name\`: Variable name
- \`pattern\`: Regex pattern (case-insensitive)
- \`context_lines\`: Lines of context around match (default: 0)
- \`max_matches\`: Maximum results (default: 50, max: 200)

**Returns:**
\`\`\`json
{
  "name": "log_data",
  "pattern": "ERROR|FATAL",
  "matches": 5,
  "truncated": false,
  "results": [
    { "line": 42, "text": "ERROR: Connection failed", "context": [...] }
  ]
}
\`\`\`

#### 4. list_vars()
List all variables in current session's namespace.

**Returns:**
\`\`\`json
{
  "session": "abc123",
  "variables": [
    { "name": "log_data", "line_count": 1000, "size": 50000, "type": "log", "created": "2026-01-07T..." }
  ],
  "total_size": 50000
}
\`\`\`

#### 5. var_info(name)
Get metadata about a specific variable.

**Returns:**
\`\`\`json
{
  "name": "log_data",
  "line_count": 1000,
  "size": 50000,
  "type": "log",
  "metadata": { "path": "production.log" },
  "created": "2026-01-07T10:30:00",
  "last_accessed": "2026-01-07T10:35:00"
}
\`\`\`

#### 6. unload(name)
Remove a variable from namespace (explicit cleanup).

**Returns:**
\`\`\`json
{ "unloaded": "log_data" }
\`\`\`

#### 7. register_handle(name, content_type?)
Create a handle reference for cross-agent communication.

**Returns:**
\`\`\`json
{
  "handle": "ctx_abc123_log_001",
  "var_name": "log_data",
  "type": "log"
}
\`\`\`

#### 8. resolve_handle(handle)
Get the variable name for a handle reference.

**Returns:**
\`\`\`json
{
  "handle": "ctx_abc123_log_001",
  "var_name": "log_data",
  "session": "abc123",
  "type": "log"
}
\`\`\`

### Phase 2 Tools

#### 9. eval_code(code)
Execute Python code in the shared namespace. Variables loaded via \`load_context\` are directly accessible.

**Arguments:**
- \`code\`: Python code to execute

**Returns:**
\`\`\`json
{
  "success": true,
  "stdout": "Found 42 errors\\n1. ERROR: ...",
  "stderr": "",
  "error": null,
  "execution_time_seconds": 0.023,
  "pending_llm_queries": [],
  "defined_variables": ["errors", "error_count"]
}
\`\`\`

**Sandboxing:**
- Safe builtins (no \`eval\`, \`exec\`, \`input\`, \`compile\`)
- Allows \`open()\`, \`__import__\` (RLM-style)
- 60 second timeout
- 1MB output limit

**Helper functions available:**
- \`llm_query(prompt, model?)\` - Queue LLM query for parent
- \`llm_query_batched(prompts, model?)\` - Queue multiple queries

#### 10. llm_query(prompt, model?)
Request an LLM query (deferred to parent agent).

**Arguments:**
- \`prompt\`: Prompt to send to the LLM
- \`model\`: Optional model hint (e.g., "fast", "smart")

**Returns:**
\`\`\`json
{
  "status": "deferred",
  "message": "[DEFERRED:q_000] LLM query queued for parent agent",
  "pending_queries": [{ "id": "q_000", "prompt": "...", "model": null }],
  "instructions": "Parent agent should fulfill these queries and call eval_code with results"
}
\`\`\`

#### 11. llm_query_batched(prompts, model?)
Request multiple LLM queries in parallel (deferred).

**Arguments:**
- \`prompts\`: List of prompts
- \`model\`: Optional model hint

**Returns:**
\`\`\`json
{
  "status": "deferred",
  "count": 3,
  "results": ["[DEFERRED:q_000]", "[DEFERRED:q_001]", "[DEFERRED:q_002]"],
  "pending_queries": [...],
  "instructions": "Parent agent should fulfill these queries"
}
\`\`\`

## Session Lifecycle

- **Scope**: Variables isolated by session ID
- **Cleanup**: Auto-pruned after 5 minutes idle
- **Quota**: Max 100MB per session
- **Session ID**: Extracted from \`PARENT_SESSION_ID\` or \`OPENCODE_SESSION_ID\` environment variables

## Best Practices

1. **Load once, reference many**: Load data in root agent, spawn multiple sub-agents
2. **Sub-agents return insights, not data**: Never echo full content back in responses
3. **Use scan() before peek()**: Search to find relevant sections, then peek specific ranges
4. **Use eval_code for complex analysis**: Python is more powerful than multiple tool calls
5. **Explicit cleanup**: Call \`unload()\` when done with large variables
6. **Check list_vars()**: Always start sub-agent work by listing available variables

## Example: Log Analysis with Code Execution

\`\`\`typescript
// Root agent: Load 100KB log file
const log = await read("production.log");
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "load_context",
  arguments: JSON.stringify({ name: "prod_log", content: log, content_type: "log" })
});

// Spawn sub-agent with eval_code capability
await call_omo_agent({
  prompt: \`Analyze errors in 'prod_log' using eval_code.
  
  Execute Python to:
  1. Filter all ERROR/FATAL lines
  2. Group by error type
  3. Count occurrences
  4. Show top 5 most common errors\`,
  subagent_type: "explore"
});

// Sub-agent executes:
await skill_mcp({
  mcp_name: "context_kernel",
  tool_name: "eval_code",
  arguments: JSON.stringify({
    code: \`
from collections import Counter
import re

# Access prod_log variable directly
errors = [line for line in prod_log['lines'] if 'ERROR' in line or 'FATAL' in line]

# Extract error types using regex
error_types = []
for err in errors:
    match = re.search(r'(ERROR|FATAL):\\s*([^:]+)', err)
    if match:
        error_types.append(match.group(2).strip())

# Count and report
counter = Counter(error_types)
print(f"Total errors: {len(errors)}")
print(f"Unique types: {len(counter)}\\n")
print("Top 5 errors:")
for i, (error, count) in enumerate(counter.most_common(5), 1):
    print(f"{i}. {error}: {count} occurrences")
\`
  })
});
// Returns comprehensive analysis without multiple tool calls!
\`\`\`

## Performance Expectations

| Metric | Before | Phase 1 | Phase 2 |
|--------|--------|---------|---------|
| Prompt size (50KB file) | 50KB | <1KB | <1KB |
| Sub-agent spawn latency | 5s+ | <500ms | <500ms |
| Token cost per sub-agent | 15K | <3K | <2K |
| Analysis complexity | Limited | Search/slice | Full Python |

## Technical Details

- **Architecture**: Per-session Python MCP server
- **Storage**: In-memory namespace with session isolation
- **Zero-copy**: Python slicing and memoryview for efficient access
- **Execution**: Sandboxed Python with safe builtins (60s timeout, 1MB output limit)
- **Based on**: Recursive Language Model (Zhang et al., Dec 2025)`,
  mcpConfig: {
    context_kernel: {
      command: "python3",
      args: ["-u", "src/mcp/context-kernel/server.py"],
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  },
}

export { contextKernelSkill }
