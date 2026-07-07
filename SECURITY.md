# Security Policy

AgentRail is security tooling, but it is not a sandbox. A denied call is blocked before execution when routed through an AgentRail proxy. A call that bypasses AgentRail is outside its control.

## Supported Versions

This project is pre-1.0. Security fixes target the default branch until formal releases begin.

## Reporting a Vulnerability

Please open a private security advisory if the repository host supports it. If not, open a minimal public issue that avoids exploit details and request a private contact path.

## Threat Model

AgentRail is designed to:

- Discover risky agent and MCP configuration.
- Enforce local policy before proxied tool calls execute.
- Detect secret-looking values before logging or reporting.
- Produce tamper-evident audit records for local verification.

AgentRail is not designed to:

- Contain malicious processes after execution.
- Replace OS sandboxing, container isolation, or network egress controls.
- Prove that no unobserved agent action happened outside the proxy path.
