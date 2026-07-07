# Project Map

This file is the navigation layer for contributors. It should stay short and current so a future debugging session can start here instead of rereading the whole codebase.

## Components

- `src/cli.ts`: command parsing and process exit boundaries.
- `src/commands/*`: command handlers. They compose core modules and handle user output.
- `src/policy/*`: deterministic policy loading and evaluation.
- `src/audit/*`: tamper-evident JSONL audit records.
- `src/scanner/*`: local discovery and static risk checks.
- `src/proxy/*`: stdio MCP mediation.
- `src/secrets/*`: secret detection and redaction.
- `src/reporting/*`: stable console output and summaries.
- `src/systemMap.ts`: machine-readable component map printed by `agentrail map`.

## Data Flow

1. `scan` reads workspace and known config paths, then emits findings.
2. `policy init` writes `.agentrail/policy.json`.
3. `check` loads one tool call and evaluates it against policy.
4. `proxy` intercepts MCP `tools/call`, evaluates policy, writes audit events, and forwards or blocks.
5. `audit verify` recalculates the hash chain and reports tampering.
6. `state` prints package, policy, audit, scan, and Git status for quick backtracking.

## Debugging Shortcut

- Policy bug: inspect `src/policy/policyEngine.ts` and tests.
- Audit bug: inspect `src/audit/auditLog.ts` and tests.
- Scan false positive: inspect `src/scanner/*` and `src/secrets/detect.ts`.
- Proxy issue: inspect `src/proxy/stdioProxy.ts`.
- CLI wiring issue: inspect `src/cli.ts` and the matching command in `src/commands`.
- Backtracking issue: run `agentrail state` first, then `agentrail map`.
