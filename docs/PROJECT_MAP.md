# Project Map

This file is the navigation layer for contributors. It should stay short and current so a future debugging session can start here instead of rereading the whole codebase.

## Components

- `src/cli.ts`: command parsing and process exit boundaries.
- `src/commands/*`: command handlers. They compose core modules and handle user output.
- `src/policy/*`: deterministic policy loading and evaluation.
- `src/audit/*`: tamper-evident JSONL audit records.
- `src/bundle/*`: portable evidence bundles for handoff and backtracking.
- `src/doctor/*`: release and handoff readiness checks.
- `src/scanner/*`: local discovery plus MCP, package script, workflow, and static risk checks.
- `src/proxy/*`: stdio MCP mediation.
- `src/secrets/*`: secret detection and redaction.
- `src/reporting/*`: stable console, HTML, and SARIF output.
- `src/systemMap.ts`: machine-readable component map printed by `agenstral map`.
- `docs/RELEASE.md`: release gate, publication checklist, and evidence outputs.
- `docs/ROADMAP.md`: planned direction without changing the local-first product boundary.
- `CHANGELOG.md`: versioned project changes.

## Data Flow

1. `scan` reads workspace files, package scripts, workflow files, and known config paths, then emits findings.
   Use `--fail-on <severity>` when the scan must behave as a CI gate.
2. `policy init` writes `.agenstral/policy.json`.
3. `doctor` composes manifest, file, CI, scan, audit, Git, and ignore checks into a release readiness report.
4. `check` loads one tool call and evaluates it against policy.
5. `run` evaluates a shell command against policy, writes audit events, and executes only when allowed or explicitly approved.
6. `proxy` intercepts MCP `tools/call`, evaluates policy, writes audit events, and forwards or blocks.
7. `audit verify` recalculates the hash chain and reports tampering.
8. `report` writes a local HTML summary for review and handoff.
9. `bundle` writes a JSON evidence snapshot with scan, policy, audit records, Git state, system map, HTML report, and a bundle hash.
10. `bundle verify` checks the bundle hash and embedded audit chain.
11. `state` prints package, policy, audit, scan, and Git status for quick backtracking.

## Debugging Shortcut

- Policy bug: inspect `src/policy/policyEngine.ts` and tests.
- Audit bug: inspect `src/audit/auditLog.ts` and tests.
- Bundle bug: inspect `src/bundle/evidenceBundle.ts` and tests.
- Doctor issue: inspect `src/doctor/doctor.ts`, `src/commands/doctor.ts`, and tests.
- Scan false positive: inspect `src/scanner/*`, especially `shellRisk.ts`, `packageScripts.ts`, `githubActions.ts`, and `src/secrets/detect.ts`.
- SARIF issue: inspect `src/reporting/sarif.ts` and tests.
- Proxy issue: inspect `src/proxy/stdioProxy.ts`.
- CLI wiring issue: inspect `src/cli.ts` and the matching command in `src/commands`.
- Backtracking issue: run `agenstral state` first, then `agenstral bundle verify .agenstral/bundle.json`, then `agenstral report`.
- CI issue: inspect `.github/workflows/ci.yml`, then rerun `npm run verify`, `npm pack --dry-run`, `npm run doctor`, and `npm run scan:ci`.
- Release issue: run `npm run release:check`, then inspect `docs/RELEASE.md`.
