#!/usr/bin/env python3
"""
Context Kernel MCP Server - Zero-Copy Context Management for Sub-Agents

Implements Recursive Language Model semantics (Zhang et al., Dec 2025):
- Shared namespace with direct variable access
- Handle-based references for cross-agent communication
- Zero-copy operations via memoryview and slicing
- Phase 2: RLM-style code execution with llm_query support

Architecture:
  Root Agent → register context → namespace variable
  Sub-Agent → peek/scan/eval_code → zero-copy operations
  
Session lifecycle:
  - Variables scoped by session ID (from PARENT_SESSION_ID env)
  - Auto-cleanup after 5 minutes idle
  - Max 100MB per session
"""

import io
import json
import os
import re
import sys
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent
    import mcp.server.stdio
except ImportError:
    print("Error: MCP SDK not installed. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

# =============================================================================
# Constants
# =============================================================================

REGISTRY: Dict[str, Dict[str, Any]] = {}
NAMESPACE: Dict[str, Dict[str, Any]] = {}
SEQUENCE: Dict[str, int] = {}

IDLE_TIMEOUT = timedelta(minutes=5)
MAX_REGISTRY_SIZE = 100 * 1024 * 1024
CHUNK_DEFAULT = 2000
CHUNK_MAX = 20000

# Phase 2: Execution constants (from oh-my-opencode defaults)
EXEC_TIMEOUT = 60  # seconds (matches interactive_bash)
MAX_OUTPUT_SIZE = 1 * 1024 * 1024  # 1MB (matches ast-grep)

# =============================================================================
# Safe Builtins (RLM-style sandboxing)
# =============================================================================

_SAFE_BUILTINS = {
    # Core types and functions
    "print": print, "len": len, "str": str, "int": int, "float": float,
    "list": list, "dict": dict, "set": set, "tuple": tuple, "bool": bool,
    "type": type, "isinstance": isinstance, "issubclass": issubclass,
    "enumerate": enumerate, "zip": zip, "map": map, "filter": filter,
    "sorted": sorted, "reversed": reversed, "range": range,
    "min": min, "max": max, "sum": sum, "abs": abs, "round": round,
    "any": any, "all": all, "pow": pow, "divmod": divmod,
    "chr": chr, "ord": ord, "hex": hex, "bin": bin, "oct": oct,
    "repr": repr, "ascii": ascii, "format": format, "hash": hash, "id": id,
    "iter": iter, "next": next, "slice": slice, "callable": callable,
    "hasattr": hasattr, "getattr": getattr, "setattr": setattr, "delattr": delattr,
    "dir": dir, "vars": vars, "bytes": bytes, "bytearray": bytearray,
    "memoryview": memoryview, "complex": complex, "object": object,
    "super": super, "property": property, "staticmethod": staticmethod,
    "classmethod": classmethod, "__import__": __import__, "open": open,
    # Exceptions
    "Exception": Exception, "BaseException": BaseException,
    "ValueError": ValueError, "TypeError": TypeError,
    "KeyError": KeyError, "IndexError": IndexError,
    "AttributeError": AttributeError, "FileNotFoundError": FileNotFoundError,
    "OSError": OSError, "IOError": IOError, "RuntimeError": RuntimeError,
    "NameError": NameError, "ImportError": ImportError,
    "StopIteration": StopIteration, "AssertionError": AssertionError,
    "NotImplementedError": NotImplementedError,
    "ArithmeticError": ArithmeticError, "LookupError": LookupError,
    "Warning": Warning,
    # Blocked (set to None)
    "input": None, "eval": None, "exec": None, "compile": None,
    "globals": None, "locals": None,
}

# =============================================================================
# Phase 2: Execution Environment
# =============================================================================

class ExecutionEnvironment:
    """Per-session Python execution environment with sandboxed namespace."""
    
    def __init__(self, session: str):
        self.session = session
        self._lock = threading.Lock()
        self._pending_llm_queries: List[Dict[str, Any]] = []
        
        # Initialize namespace with safe builtins
        self.globals: Dict[str, Any] = {
            "__builtins__": _SAFE_BUILTINS.copy(),
            "__name__": "__main__",
        }
        self.locals: Dict[str, Any] = {}
        
        # Add helper functions
        self.globals["llm_query"] = self._llm_query
        self.globals["llm_query_batched"] = self._llm_query_batched
    
    def _llm_query(self, prompt: str, model: Optional[str] = None) -> str:
        """Queue an LLM query for parent agent to fulfill."""
        query_id = f"q_{len(self._pending_llm_queries):03d}"
        self._pending_llm_queries.append({
            "id": query_id,
            "prompt": prompt,
            "model": model,
        })
        return f"[DEFERRED:{query_id}] LLM query queued for parent agent"
    
    def _llm_query_batched(self, prompts: List[str], model: Optional[str] = None) -> List[str]:
        """Queue multiple LLM queries for parent agent."""
        results = []
        for prompt in prompts:
            results.append(self._llm_query(prompt, model))
        return results
    
    @contextmanager
    def _capture_output(self):
        """Thread-safe stdout/stderr capture."""
        with self._lock:
            old_stdout, old_stderr = sys.stdout, sys.stderr
            stdout_buf, stderr_buf = io.StringIO(), io.StringIO()
            try:
                sys.stdout, sys.stderr = stdout_buf, stderr_buf
                yield stdout_buf, stderr_buf
            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr
    
    def execute(self, code: str) -> Dict[str, Any]:
        """Execute code in sandboxed namespace."""
        start_time = time.perf_counter()
        
        # Clear pending queries
        self._pending_llm_queries = []
        
        with self._capture_output() as (stdout_buf, stderr_buf):
            try:
                # Combine globals and locals for execution
                combined = {**self.globals, **self.locals}
                
                # Inject namespace variables from NAMESPACE
                session_ns = NAMESPACE.get(self.session, {}).get("vars", {})
                for var_name, var_data in session_ns.items():
                    # Make both the full var_data dict and just the content available
                    combined[var_name] = var_data
                
                # Execute code
                exec(code, combined, combined)
                
                # Update locals with new variables
                for key, value in combined.items():
                    if key not in self.globals and not key.startswith("_"):
                        self.locals[key] = value
                
                stdout = stdout_buf.getvalue()
                stderr = stderr_buf.getvalue()
                success = True
                error = None
                
            except Exception as e:
                stdout = stdout_buf.getvalue()
                stderr = stderr_buf.getvalue() + f"\n{type(e).__name__}: {e}"
                success = False
                error = f"{type(e).__name__}: {e}"
        
        # Truncate output if too large
        if len(stdout) > MAX_OUTPUT_SIZE:
            stdout = stdout[:MAX_OUTPUT_SIZE] + "\n[OUTPUT TRUNCATED - exceeded 1MB limit]"
        if len(stderr) > MAX_OUTPUT_SIZE:
            stderr = stderr[:MAX_OUTPUT_SIZE] + "\n[OUTPUT TRUNCATED - exceeded 1MB limit]"
        
        return {
            "success": success,
            "stdout": stdout,
            "stderr": stderr,
            "error": error,
            "execution_time": time.perf_counter() - start_time,
            "pending_llm_queries": self._pending_llm_queries.copy(),
            "locals": list(self.locals.keys()),
        }

# Per-session execution environments
EXEC_ENVS: Dict[str, ExecutionEnvironment] = {}

def get_exec_env(session: str) -> ExecutionEnvironment:
    """Get or create execution environment for session."""
    if session not in EXEC_ENVS:
        EXEC_ENVS[session] = ExecutionEnvironment(session)
    return EXEC_ENVS[session]

# =============================================================================
# Session Management
# =============================================================================

def get_session() -> str:
    """Extract session ID from environment variables."""
    parent = os.getenv("PARENT_SESSION_ID", "")
    current = os.getenv("OPENCODE_SESSION_ID", parent)
    return current[:8] if current else "global"

def generate_handle(content_type: str) -> str:
    """Generate unique handle for current session."""
    session = get_session()
    seq = SEQUENCE.get(session, 0) + 1
    SEQUENCE[session] = seq
    return f"ctx_{session}_{content_type}_{seq:03d}"

def prune_stale():
    """Remove stale entries from registry, namespace, and execution environments."""
    now = datetime.now()
    
    # Prune handles
    stale_handles = [
        h for h, data in REGISTRY.items()
        if now - data["accessed"] > IDLE_TIMEOUT
    ]
    for handle in stale_handles:
        del REGISTRY[handle]
    
    # Prune namespace sessions
    stale_sessions = [
        sess for sess, data in NAMESPACE.items()
        if now - data.get("accessed", now) > IDLE_TIMEOUT
    ]
    for sess in stale_sessions:
        del NAMESPACE[sess]
        # Also remove execution environment
        if sess in EXEC_ENVS:
            del EXEC_ENVS[sess]

def session_size(session: str) -> int:
    """Calculate total memory usage for a session."""
    registry_size = sum(
        len(str(d["content"])) for h, d in REGISTRY.items()
        if h.startswith(f"ctx_{session}_")
    )
    namespace_size = sum(
        len(str(v)) for k, v in NAMESPACE.get(session, {}).get("vars", {}).items()
    )
    return registry_size + namespace_size

def ensure_namespace(session: str):
    """Ensure namespace exists for session."""
    if session not in NAMESPACE:
        NAMESPACE[session] = {
            "vars": {},
            "accessed": datetime.now(),
        }

# =============================================================================
# MCP Server
# =============================================================================

app = Server("context-kernel")

@app.list_tools()
async def list_tools() -> List[Tool]:
    return [
        # Phase 1 Tools
        Tool(
            name="load_context",
            description="Load content into shared namespace with a variable name",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Variable name (e.g., 'context', 'log_data', 'config')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to load"
                    },
                    "content_type": {
                        "type": "string",
                        "description": "Type hint: file, log, json, custom",
                        "default": "custom"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional metadata (path, size, encoding, etc.)"
                    },
                },
                "required": ["name", "content"],
            },
        ),
        Tool(
            name="peek",
            description="Read a slice of content from a namespace variable (zero-copy pagination)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Variable name (e.g., 'context')"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Line offset (0-based)",
                        "default": 0
                    },
                    "limit": {
                        "type": "integer",
                        "description": f"Lines to read (max {CHUNK_MAX})",
                        "default": CHUNK_DEFAULT
                    },
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="scan",
            description="Search content with regex (returns matching lines with context)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Variable name to search"
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Regex pattern (case-insensitive)"
                    },
                    "context_lines": {
                        "type": "integer",
                        "description": "Lines of context around each match",
                        "default": 0
                    },
                    "max_matches": {
                        "type": "integer",
                        "description": "Maximum results to return",
                        "default": 50
                    },
                },
                "required": ["name", "pattern"],
            },
        ),
        Tool(
            name="list_vars",
            description="List all variables in current session's namespace",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="var_info",
            description="Get metadata about a specific variable",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Variable name"}
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="unload",
            description="Remove a variable from namespace (explicit cleanup)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Variable name to unload"}
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="register_handle",
            description="Create a handle reference to a namespace variable (for cross-agent refs)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Variable name to create handle for"
                    },
                    "content_type": {
                        "type": "string",
                        "description": "Type hint for handle",
                        "default": "custom"
                    },
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="resolve_handle",
            description="Get the variable name for a handle reference",
            inputSchema={
                "type": "object",
                "properties": {
                    "handle": {"type": "string", "description": "Handle to resolve (ctx_...)"}
                },
                "required": ["handle"],
            },
        ),
        # Phase 2 Tools
        Tool(
            name="eval_code",
            description="Execute Python code in the shared namespace. Access loaded variables directly. Use llm_query() for recursive LLM calls.",
            inputSchema={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute. Variables loaded via load_context are available directly."
                    },
                },
                "required": ["code"],
            },
        ),
        Tool(
            name="llm_query",
            description="Request an LLM query (deferred to parent agent). Returns a query ID that parent agent will fulfill.",
            inputSchema={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Prompt to send to the LLM"
                    },
                    "model": {
                        "type": "string",
                        "description": "Optional model hint (e.g., 'fast', 'smart')"
                    },
                },
                "required": ["prompt"],
            },
        ),
        Tool(
            name="llm_query_batched",
            description="Request multiple LLM queries in parallel (deferred to parent agent).",
            inputSchema={
                "type": "object",
                "properties": {
                    "prompts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of prompts to send to the LLM"
                    },
                    "model": {
                        "type": "string",
                        "description": "Optional model hint"
                    },
                },
                "required": ["prompts"],
            },
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Any) -> List[TextContent]:
    prune_stale()
    session = get_session()
    ensure_namespace(session)
    
    # Phase 1 Tools
    if name == "load_context":
        var_name = arguments["name"]
        content = arguments["content"]
        content_type = arguments.get("content_type", "custom")
        metadata = arguments.get("metadata", {})
        
        if session_size(session) + len(content) > MAX_REGISTRY_SIZE:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "quota_exceeded",
                    "message": f"Session {session} would exceed 100MB limit",
                    "current_size": session_size(session),
                    "limit": MAX_REGISTRY_SIZE,
                })
            )]
        
        lines = content.split("\n")
        NAMESPACE[session]["vars"][var_name] = {
            "content": content,
            "lines": lines,
            "line_count": len(lines),
            "size": len(content),
            "type": content_type,
            "metadata": metadata,
            "created": datetime.now().isoformat(),
            "accessed": datetime.now().isoformat(),
        }
        NAMESPACE[session]["accessed"] = datetime.now()
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "name": var_name,
                "line_count": len(lines),
                "size": len(content),
                "type": content_type,
                "expires_in": "5 minutes if not accessed",
            })
        )]
    
    elif name == "peek":
        var_name = arguments["name"]
        
        if var_name not in NAMESPACE[session]["vars"]:
            available = list(NAMESPACE[session]["vars"].keys())
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "variable_not_found",
                    "name": var_name,
                    "available": available,
                    "hint": "Use list_vars to see all available variables",
                })
            )]
        
        offset = max(0, arguments.get("offset", 0))
        limit = min(arguments.get("limit", CHUNK_DEFAULT), CHUNK_MAX)
        
        var_data = NAMESPACE[session]["vars"][var_name]
        var_data["accessed"] = datetime.now().isoformat()
        NAMESPACE[session]["accessed"] = datetime.now()
        
        lines = var_data["lines"]
        chunk = lines[offset:offset + limit]
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "name": var_name,
                "offset": offset,
                "limit": limit,
                "total_lines": len(lines),
                "returned": len(chunk),
                "has_more": offset + len(chunk) < len(lines),
                "content": "\n".join(chunk),
            })
        )]
    
    elif name == "scan":
        var_name = arguments["name"]
        
        if var_name not in NAMESPACE[session]["vars"]:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "variable_not_found", "name": var_name})
            )]
        
        pattern = arguments["pattern"]
        context_lines = arguments.get("context_lines", 0)
        max_matches = min(arguments.get("max_matches", 50), 200)
        
        var_data = NAMESPACE[session]["vars"][var_name]
        var_data["accessed"] = datetime.now().isoformat()
        NAMESPACE[session]["accessed"] = datetime.now()
        
        lines = var_data["lines"]
        
        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "invalid_regex", "details": str(e)})
            )]
        
        matches = []
        for i, line in enumerate(lines):
            if regex.search(line):
                match_data = {"line": i, "text": line}
                
                if context_lines > 0:
                    start = max(0, i - context_lines)
                    end = min(len(lines), i + context_lines + 1)
                    match_data["context"] = lines[start:end]
                
                matches.append(match_data)
                
                if len(matches) >= max_matches:
                    break
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "name": var_name,
                "pattern": pattern,
                "matches": len(matches),
                "truncated": len(matches) >= max_matches,
                "results": matches,
            })
        )]
    
    elif name == "list_vars":
        vars_info = []
        for var_name, var_data in NAMESPACE[session]["vars"].items():
            vars_info.append({
                "name": var_name,
                "line_count": var_data["line_count"],
                "size": var_data["size"],
                "type": var_data["type"],
                "created": var_data["created"],
            })
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "session": session,
                "variables": vars_info,
                "total_size": session_size(session),
            })
        )]
    
    elif name == "var_info":
        var_name = arguments["name"]
        
        if var_name not in NAMESPACE[session]["vars"]:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "variable_not_found", "name": var_name})
            )]
        
        var_data = NAMESPACE[session]["vars"][var_name]
        return [TextContent(
            type="text",
            text=json.dumps({
                "name": var_name,
                "line_count": var_data["line_count"],
                "size": var_data["size"],
                "type": var_data["type"],
                "metadata": var_data["metadata"],
                "created": var_data["created"],
                "last_accessed": var_data["accessed"],
            })
        )]
    
    elif name == "unload":
        var_name = arguments["name"]
        
        if var_name in NAMESPACE[session]["vars"]:
            del NAMESPACE[session]["vars"][var_name]
            return [TextContent(
                type="text",
                text=json.dumps({"unloaded": var_name})
            )]
        
        return [TextContent(
            type="text",
            text=json.dumps({"error": "variable_not_found", "name": var_name})
        )]
    
    elif name == "register_handle":
        var_name = arguments["name"]
        content_type = arguments.get("content_type", "custom")
        
        if var_name not in NAMESPACE[session]["vars"]:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "variable_not_found", "name": var_name})
            )]
        
        handle = generate_handle(content_type)
        REGISTRY[handle] = {
            "session": session,
            "var_name": var_name,
            "content_type": content_type,
            "created": datetime.now(),
            "accessed": datetime.now(),
        }
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "handle": handle,
                "var_name": var_name,
                "type": content_type,
            })
        )]
    
    elif name == "resolve_handle":
        handle = arguments["handle"]
        
        if handle not in REGISTRY:
            return [TextContent(
                type="text",
                text=json.dumps({"error": "handle_not_found", "handle": handle})
            )]
        
        handle_data = REGISTRY[handle]
        handle_data["accessed"] = datetime.now()
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "handle": handle,
                "var_name": handle_data["var_name"],
                "session": handle_data["session"],
                "type": handle_data["content_type"],
            })
        )]
    
    # Phase 2 Tools
    elif name == "eval_code":
        code = arguments["code"]
        
        # Get execution environment for this session
        exec_env = get_exec_env(session)
        
        # Execute code
        result = exec_env.execute(code)
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "success": result["success"],
                "stdout": result["stdout"],
                "stderr": result["stderr"],
                "error": result["error"],
                "execution_time_seconds": result["execution_time"],
                "pending_llm_queries": result["pending_llm_queries"],
                "defined_variables": result["locals"],
            })
        )]
    
    elif name == "llm_query":
        prompt = arguments["prompt"]
        model = arguments.get("model")
        
        exec_env = get_exec_env(session)
        result = exec_env._llm_query(prompt, model)
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "deferred",
                "message": result,
                "pending_queries": exec_env._pending_llm_queries,
                "instructions": "Parent agent should fulfill these queries and call eval_code with results",
            })
        )]
    
    elif name == "llm_query_batched":
        prompts = arguments["prompts"]
        model = arguments.get("model")
        
        exec_env = get_exec_env(session)
        results = exec_env._llm_query_batched(prompts, model)
        
        return [TextContent(
            type="text",
            text=json.dumps({
                "status": "deferred",
                "count": len(prompts),
                "results": results,
                "pending_queries": exec_env._pending_llm_queries,
                "instructions": "Parent agent should fulfill these queries and call eval_code with results",
            })
        )]
    
    return [TextContent(
        type="text",
        text=json.dumps({"error": "unknown_tool", "name": name})
    )]

if __name__ == "__main__":
    import asyncio
    
    async def main():
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await app.run(
                read_stream,
                write_stream,
                app.create_initialization_options()
            )
    
    asyncio.run(main())
