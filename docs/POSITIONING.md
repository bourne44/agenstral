# Positioning

Agenstral is a repository-level safety and evidence tool for AI coding-agent work.

It is not:

- An AI coding agent.
- An agent orchestration framework.
- A general MCP gateway.
- A task lifecycle control plane for GitHub, Linear, and CI.
- A cloud governance platform.

It is:

- A local preflight scanner before an agent touches a repository.
- A deterministic policy gate for normalized tool calls.
- A shell command approval layer for local workflows.
- A tamper-evident audit recorder.
- A compact report surface for handoff and backtracking.

## Core User

The primary user is a developer or security-minded maintainer who wants to run an AI coding agent in a repository without guessing:

- Which agent or MCP configuration exists.
- Which tool calls are allowed, denied, or approval-gated.
- Whether risky shell commands were attempted.
- What happened during the session.
- Whether the local evidence log was modified.

## Product Boundary

Agenstral should stay useful as a small local CLI. Hosted dashboards, registries, or team features can exist later, but they must build on top of the local evidence model rather than replace it.
