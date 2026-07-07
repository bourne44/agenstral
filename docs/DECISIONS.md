# Decisions

## D-001: TypeScript CLI First

Agenstral starts as a TypeScript CLI because agent tooling, MCP SDKs, and modern developer workflows are converging around typed JavaScript ecosystems. The CLI keeps the first product useful without needing a service.

## D-002: Local-First Core

The core does not require accounts, telemetry, or cloud APIs. Enterprise sync and hosted dashboards can be added later without weakening the local trust model.

## D-003: JSON Policy Before DSL

Policy begins as JSON to keep parsing safe and dependency-free. A richer policy language can be layered on after the core behavior is proven.

## D-004: Tamper-Evident JSONL Audit

Audit events are JSONL with a hash chain. This does not prevent deletion, but it makes local mutation detectable and keeps logs easy to inspect, stream, and archive.

## D-005: Proxy Is One Layer

The stdio proxy blocks calls before forwarding. It is not a sandbox and does not claim to contain tools after execution. Defense in depth remains mandatory for high-risk agents.

## D-006: Agenstral Name And Positioning

The original working name collided with existing projects in the AI coding-agent control-plane space. The project is now named Agenstral and is intentionally positioned as a repository-level preflight and audit recorder, not an agent framework, MCP gateway, or enterprise task lifecycle control plane.

## D-007: Evidence Bundle As Backtracking Contract

Agenstral writes a portable JSON evidence bundle that includes scan output, effective policy, audit records, audit verification, Git state, system map, and a rendered HTML report. The bundle has its own deterministic hash so handoff, CI artifacts, and future dashboards can verify the same local evidence without rereading the whole repository.

## D-008: Heuristic Supply-Chain Checks Without Runtime Dependencies

The scanner performs deterministic checks for risky package scripts and GitHub Actions workflow patterns without adding runtime parser dependencies. JSON manifests are parsed structurally; workflow checks are line-based and conservative. A full YAML parser can be introduced later if it materially reduces false positives or enables safer policy decisions.

## D-009: SARIF As CI Interchange Format

Agenstral exports scan findings as SARIF 2.1.0 so CI systems and future dashboards can consume the same local findings without a proprietary service. SARIF generation stays in the reporting layer; scanners emit neutral findings and do not know about CI-specific output.
