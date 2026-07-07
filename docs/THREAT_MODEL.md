# Threat Model

AgentRail protects the boundary between AI coding agents and the tools they can call.

## Assets

- Source code and uncommitted local changes.
- Secrets in files, environment variables, prompts, and tool outputs.
- Developer identity tokens such as GitHub, cloud, package registry, and chat credentials.
- Local machine integrity.
- Audit evidence about what an agent did.

## Adversaries

- Malicious MCP servers.
- Compromised package versions used by MCP server launch commands.
- Prompt injection from issues, docs, webpages, tickets, chat, and tool output.
- Over-permissive agents acting without malicious input.
- Local users or processes that tamper with audit files after a session.

## In Scope

- Discovering risky local MCP and agent configuration.
- Blocking or requiring approval for risky tool calls routed through AgentRail.
- Redacting secret-looking values from audit output.
- Detecting audit log modification through hash-chain verification.

## Out of Scope

- Full process sandboxing.
- Kernel-level egress control.
- Guaranteeing coverage for actions not routed through AgentRail.
- Preventing deletion of the whole audit log without an external append-only sink.

## Required Controls For High-Risk Use

- Run untrusted agents in containers or VMs.
- Use short-lived credentials with least privilege.
- Route MCP servers through AgentRail or an equivalent gateway.
- Store audit logs in append-only storage for regulated workflows.
- Pin MCP server package versions.
