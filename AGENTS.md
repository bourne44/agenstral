# AGENTS.md

## Setup

- Install dependencies with `npm install`.
- Build with `npm run build`.
- Run the full local gate with `npm run verify`.
- Run the release gate with `npm run release:check` before handoff.

## Code Style

- TypeScript strict mode is required.
- Keep runtime dependencies near zero unless a dependency removes real risk.
- Keep security-sensitive behavior deterministic and tested.
- Prefer small modules with explicit types over broad abstractions.

## Testing

- Add tests under `src/**/*.test.ts`.
- Build before running tests because the test runner executes compiled files.
- Use fixtures when a policy or audit behavior needs clear examples.

## Security

- Do not log raw secrets. Use the redaction helpers.
- Treat unknown tool calls as requiring approval unless policy explicitly allows them.
- Do not add telemetry or network calls to the core CLI.
