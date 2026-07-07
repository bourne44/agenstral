# Roadmap

Agenstral should stay useful as a local CLI while growing toward stronger enforcement and better evidence review.

## Now

- Keep the trusted core small and dependency-light.
- Improve scanner coverage for repository and agent-tooling risks.
- Keep evidence artifacts deterministic, local, and easy to verify.
- Maintain CI gates that run without accounts or hosted services beyond GitHub Actions.

## Next

- Add richer path policy for file write mediation.
- Support stronger MCP transport framing and compatibility tests.
- Add markdown and SARIF summaries to evidence bundles.
- Add policy presets for common repository risk profiles.
- Add signed bundle support when local signing material is available.

## Later

- Optional append-only evidence sinks.
- Optional team dashboard built on local bundle and audit formats.
- Policy diffing and baseline management for large repositories.
- IDE integrations that display doctor, scan, and audit state without changing the core CLI.
