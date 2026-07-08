# Agenstral

Letting an AI agent loose in a real codebase is nerve-wracking, not because it's
malicious, but because when something goes wrong you can't always explain what
happened. *"The agent changed our deploy script"* doesn't hold up when someone
asks which lines, when, and why. And *"trust me, the logs are fine"* is not an
answer you want to give a compliance officer.

Agenstral is a small, local CLI that helps you answer three questions before and
after you hand a repository to an agent:

- **What's actually risky in here?** Hardcoded secrets, `curl | bash` scripts, unpinned actions, AI-agent workflows wired to untrusted triggers (the GitLost class), stray MCP configs.
- **What is this agent allowed to do?** A plain JSON policy you can read, evaluated the same way every time.
- **What actually happened?** An audit log where every record is hash-chained to the last one, so tampering breaks the chain and `audit verify` catches it.

Everything runs on your machine. No cloud, no telemetry, no accounts, no vendor
lock-in, and you own the logs. It's free and open source (Apache-2.0): a strict
TypeScript CLI with **zero runtime dependencies**.

## Try it in 30 seconds

The repository ships with a deliberately risky sample project in [examples/demo](examples/demo). Point the scanner at it:

```sh
npm install
npm run build
node dist/cli.js scan --workspace examples/demo
```

You'll see real findings:

```
Agenstral Scan
Workspace: .../examples/demo
MCP servers: 0
Guidance files: 1
Findings: 13

- [high]     AI agent workflow can be triggered by untrusted input   (issue_comment -> agent)
- [critical] Secret-looking value in package script                  (AWS key in a deploy script)
- [high]     Command downloads and executes remote code              (curl | bash in postinstall)
- [high]     Command can destroy repository state                    (rm -rf ./ in a script)
- [high]     GitHub Actions workflow uses pull_request_target
- [high]     GitHub Actions workflow grants write-all permissions
- [medium]   GitHub Actions workflow uses unpinned actions
- [medium]   Command uses an unpinned package runner                 (npx ...@latest)
- [medium]   Agent guidance is missing safety-critical sections
  ...
```

In CI, add `--fail-on medium` and the command exits non-zero when it finds something.

## Install

From source (works today):

```sh
git clone https://github.com/bourne44/agenstral.git
cd agenstral
npm install
npm run build
npm link          # makes `agenstral` available on your PATH
```

Once published to npm:

```sh
npm install -g agenstral
# or, without installing:
npx agenstral scan --workspace .
```

## Everyday commands

Run these from inside the repository you want an agent to work in.

```sh
# 1. See what's risky before the agent starts
agenstral scan --workspace .
agenstral scan --workspace . --fail-on medium                    # gate for CI
agenstral scan --workspace . --sarif --out .agenstral/scan.sarif # for GitHub code scanning

# 2. Decide the rules, then test a single tool call against them
agenstral policy init
agenstral check --call examples/dangerous-tool-call.json         # -> Decision: DENY

# 3. Let the agent act THROUGH Agenstral (policy + audit on every action)
agenstral run --approve-ask -- node --version                    # a shell command
agenstral proxy -- <mcp-server>                                  # an MCP server

# 4. Prove what happened
agenstral audit verify .agenstral/audit.jsonl                    # verifies the hash chain
agenstral report                                                 # local HTML report
agenstral bundle                                                 # portable evidence bundle for handoff
agenstral state                                                  # one-shot summary of everything
```

The audit log is plain append-only JSONL, nothing fancy, no blockchain. Each
record just carries the hash of the one before it. Edit or delete any past line
and `audit verify` fails with a `hash mismatch`. That's the whole trick, and it's
enough to prove the history wasn't rewritten after the fact.

## Command reference

- `scan`: discover MCP configs, agent guidance files, risky package scripts, risky GitHub Actions workflows (including AI agents wired to untrusted triggers), exposed secrets, and missing project controls.
- `doctor`: check release and handoff readiness across manifest, required files, CI, scan, audit, Git state, and ignored generated paths.
- `policy init`: create a starter `.agenstral/policy.json`.
- `check`: evaluate one tool-call JSON file against policy.
- `run`: execute a local shell command through Agenstral policy and audit logging.
- `proxy`: run a stdio MCP server behind Agenstral policy and audit logging.
- `audit view` / `audit verify`: print a compact timeline / verify the hash chain.
- `map`: print the project component map for contributors.
- `report`: write a local HTML report with scan findings, audit timeline, Git state, and system map.
- `bundle` / `bundle verify`: write / verify a portable JSON evidence bundle plus a synced HTML report.
- `state`: print the compact project state.

## Status

This is early, and I'd rather be honest about it. The parts I trust today are
**scan** and the **tamper-evident audit**. Those are solid and useful right now.
Runtime mediation through `proxy` is deliberately cautious and still growing; I'd
rather ship a small thing that does what it says than a big thing that pretends.
The [roadmap](docs/ROADMAP.md) lays out where it's headed.

If you clone it and point it at a real repo, I'd genuinely like to hear what you
expected versus what you found. Issues and rough edges welcome.

## Design principles

- **Local-first**: useful without accounts, cloud services, or telemetry.
- **Deterministic**: policy decisions are explainable and testable.
- **Small trusted core**: policy, scan, audit, and proxy code are separated.
- **Secure by default**: unknown tool calls require approval unless policy says otherwise.
- **Boring interfaces**: JSON policy, JSONL audit, CLI commands, predictable output.

## Documentation

- [Project map](docs/PROJECT_MAP.md): compact navigation for contributors.
- [Architecture](docs/ARCHITECTURE.md): layers, contracts, and extension path.
- [Threat model](docs/THREAT_MODEL.md): what Agenstral does and does not protect.
- [Workflow](docs/WORKFLOW.md): local development loop and release gate.
- [Release](docs/RELEASE.md): local release process and publication checklist.
- [Roadmap](docs/ROADMAP.md): near-term and long-term direction.
- [Positioning](docs/POSITIONING.md): what this project is and deliberately is not.
- [Changelog](CHANGELOG.md): notable changes by version.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The full local gate is `npm run release:check`.

## License

Apache-2.0. See [LICENSE](LICENSE).
