# Changelog

All notable changes to Agenstral are tracked here.

## Unreleased

- Added scan detection for AI-agent workflows triggered by untrusted input (issue, comment, and pull-request events), the precondition behind GitLost-style prompt-injection exfiltration.

## 0.1.0 - 2026-07-07

- Added local workspace scanning for MCP configuration, agent guidance, package scripts, GitHub Actions workflows, exposed secrets, and supply-chain risk patterns.
- Added deterministic policy evaluation for normalized tool calls.
- Added shell command mediation through `agenstral run`.
- Added conservative stdio MCP proxy support.
- Added tamper-evident JSONL audit logs with hash-chain verification.
- Added HTML reports, SARIF export, project state output, component map output, and portable evidence bundles.
- Added release readiness checks through `agenstral doctor`.
- Added pinned GitHub Actions CI with build, test, package dry-run, doctor, scan, SARIF, bundle, and artifact upload.
