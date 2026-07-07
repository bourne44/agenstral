# Workflow

Use this workflow to reduce mistakes and avoid expensive backtracking.

## Daily Loop

1. Read `docs/PROJECT_MAP.md`.
2. Change the smallest component that owns the behavior.
3. Add or update a focused test.
4. Run `npm run verify`.
5. Update `docs/PROJECT_MAP.md` or `docs/DECISIONS.md` only if structure changed.

## Release Gate

- `npm run verify` passes.
- `agenstral scan --workspace .` has no critical findings created by the project itself.
- `agenstral audit verify <log>` succeeds for generated demo logs.
- `agenstral report` writes `.agenstral/report.html`.
- `agenstral bundle` writes `.agenstral/bundle.json` and a synced report.
- `agenstral bundle verify .agenstral/bundle.json` succeeds.
- README commands still work.

## Backtracking Model

The source of truth is split into compact layers:

- Intent and structure: `docs/PROJECT_MAP.md`
- Rationale: `docs/DECISIONS.md`
- Behavior: tests
- Runtime evidence: `.agenstral/audit.jsonl`
- Portable evidence: `.agenstral/bundle.json`
- Review surface: `.agenstral/report.html`
- User-facing commands: README

When debugging, run `agenstral state`, verify the bundle, then open the HTML report only if the compact state is not enough.
