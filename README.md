# AgentRail

AgentRail is a local-first flight recorder and policy layer for AI coding agents.

It gives developers a clear answer to three questions before an agent is trusted with a repository:

- What agent tooling is configured here?
- What tool calls are allowed, denied, or require approval?
- What actually happened during a session?

The project starts small on purpose: a strict TypeScript CLI, deterministic policy evaluation, local scan reports, and tamper-evident audit logs. The architecture is shaped so MCP proxying, shell/file mediation, dashboards, and team governance can be added without rewriting the core.

## Status

Early open-source MVP. Useful now for local scanning, policy checks, and audit logs. Runtime proxy support is intentionally conservative.

## Install

```sh
npm install
npm run build
npm link
```

Then:

```sh
agentrail scan --workspace .
agentrail policy init
agentrail check --call examples/tool-call.json
agentrail audit verify .agentrail/audit.jsonl
agentrail map
agentrail state
```

## Core Commands

- `scan`: discover MCP configs, agent guidance files, risky commands, exposed secrets, and missing project controls.
- `policy init`: create a starter `.agentrail/policy.json`.
- `check`: evaluate one tool call JSON file against policy.
- `proxy`: run a stdio MCP server behind AgentRail policy and audit logging.
- `audit view`: print a compact audit timeline.
- `audit verify`: verify the audit hash chain.
- `map`: print the project component map so contributors can navigate without rereading the entire codebase.
- `state`: print the compact project state: package, policy, audit integrity, scan summary, and Git change count.

## Design Principles

- Local-first: useful without accounts, cloud services, or telemetry.
- Deterministic: policy decisions are explainable and testable.
- Small trusted core: policy, scan, audit, and proxy code are separated.
- Secure by default: unknown tool calls require approval unless policy says otherwise.
- Boring interfaces: JSON policy, JSONL audit, CLI commands, predictable output.

## Architecture Notes

- [Project map](docs/PROJECT_MAP.md): compact navigation for contributors.
- [Architecture](docs/ARCHITECTURE.md): layers, contracts, and extension path.
- [Threat model](docs/THREAT_MODEL.md): what AgentRail does and does not protect.
- [Workflow](docs/WORKFLOW.md): local development loop and release gate.
- [Decisions](docs/DECISIONS.md): short architectural decision record.

## License

Apache-2.0. See [LICENSE](LICENSE).
