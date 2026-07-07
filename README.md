# Agenstral

Agenstral is a local preflight and audit tool for letting AI coding agents work inside a repository without guessing what they can touch.

It gives developers a clear answer to three questions before an agent is trusted with a repository:

- What agent tooling is configured here?
- What tool calls are allowed, denied, or require approval?
- What actually happened during a session?

The project starts small on purpose: a strict TypeScript CLI, deterministic policy evaluation, local scan reports, supply-chain risk checks, and tamper-evident audit logs. The architecture is shaped so MCP proxying, shell/file mediation, dashboards, and team governance can be added without rewriting the core.

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
agenstral scan --workspace .
agenstral scan --workspace . --fail-on medium
agenstral scan --workspace . --sarif --out .agenstral/scan.sarif
agenstral policy init
agenstral check --call examples/tool-call.json
agenstral run --approve-ask -- node --version
agenstral audit verify .agenstral/audit.jsonl
agenstral map
agenstral report
agenstral bundle
agenstral bundle verify .agenstral/bundle.json
agenstral state
```

## Core Commands

- `scan`: discover MCP configs, agent guidance files, risky package scripts, risky GitHub Actions workflows, exposed secrets, and missing project controls. Use `--fail-on <severity>` in CI and `--sarif --out <path>` for standard security artifacts.
- `policy init`: create a starter `.agenstral/policy.json`.
- `check`: evaluate one tool call JSON file against policy.
- `run`: execute a local shell command through Agenstral policy and audit logging.
- `proxy`: run a stdio MCP server behind Agenstral policy and audit logging.
- `audit view`: print a compact audit timeline.
- `audit verify`: verify the audit hash chain.
- `map`: print the project component map so contributors can navigate without rereading the entire codebase.
- `report`: write a local HTML report with scan findings, audit timeline, Git state, and system map.
- `bundle`: write a portable JSON evidence bundle plus a synced HTML report for handoff and backtracking.
- `bundle verify`: verify bundle integrity and the embedded audit hash chain.
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
- [Threat model](docs/THREAT_MODEL.md): what Agenstral does and does not protect.
- [Workflow](docs/WORKFLOW.md): local development loop and release gate.
- [Decisions](docs/DECISIONS.md): short architectural decision record.
- [Positioning](docs/POSITIONING.md): what this project is and deliberately is not.

## License

Apache-2.0. See [LICENSE](LICENSE).
