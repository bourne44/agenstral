# Architecture

Agenstral is a local-first security tool for AI coding agents. The architecture separates decisions from transport so the same policy engine can be reused by CLI checks, MCP proxying, shell mediation, and dashboards.

## Layers

1. Interface layer
   - `src/cli.ts`
   - `src/commands/*`
   - Owns command parsing, output, exit codes, and composition.

2. Core layer
   - `src/policy/*`
   - `src/audit/*`
   - `src/secrets/*`
   - Owns deterministic decisions, audit integrity, and redaction.

3. Adapter layer
   - `src/scanner/*`
   - `src/proxy/*`
   - Owns external formats and transports.

4. Reporting layer
   - `src/reporting/*`
   - Owns stable human-readable summaries.

## Contracts

### ToolCall

A normalized action request:

```json
{
  "server": "filesystem",
  "tool": "read_file",
  "arguments": {
    "path": "README.md"
  }
}
```

Every runtime adapter should translate its native event into `ToolCall` before policy evaluation.

### PolicyDecision

A deterministic result:

```json
{
  "action": "allow",
  "reason": "Allow common read-only filesystem operations.",
  "ruleId": "allow-readonly-filesystem"
}
```

Adapters must treat `deny` as a hard block. Adapters may implement `ask` only when a safe approval channel exists.

### AuditRecord

A JSONL record with a hash chain. The hash covers all fields except `hash`.

## Extension Path

- Shell mediation is an adapter that emits `ToolCall`.
- File write mediation should evaluate path constraints before writes.
- Dashboard and report work should read audit JSONL and scan reports instead of reaching into core internals.
- Team sync should be an optional service above local logs, not a dependency of local enforcement.
