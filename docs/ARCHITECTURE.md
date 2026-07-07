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
   - `src/doctor/*`
   - Owns deterministic decisions, audit integrity, redaction, and readiness checks.

3. Adapter layer
   - `src/scanner/*`
   - `src/proxy/*`
   - Owns external formats, transports, and deterministic workspace risk checks.

4. Reporting layer
   - `src/reporting/*`
   - `src/bundle/*`
   - Owns stable human-readable summaries.
   - Owns portable evidence snapshots for handoff and later dashboard ingestion.

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
