# Contributing

Agenstral values small, reviewed changes that improve local trust in AI agent workflows.

## Development

```sh
npm install
npm run verify
```

## Rules

- Keep runtime dependencies minimal.
- Keep policy behavior deterministic.
- Add tests for every policy or audit behavior change.
- Update `docs/PROJECT_MAP.md` when adding a module.
- Update `docs/DECISIONS.md` when introducing a new architectural decision.

## Commit Shape

Prefer focused commits:

- `feat: add policy constraint for shell commands`
- `fix: preserve audit hash chain on empty files`
- `docs: clarify proxy limitations`
