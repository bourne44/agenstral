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
- `agentrail scan --workspace .` has no critical findings created by the project itself.
- `agentrail audit verify <log>` succeeds for generated demo logs.
- README commands still work.

## Backtracking Model

The source of truth is split into compact layers:

- Intent and structure: `docs/PROJECT_MAP.md`
- Rationale: `docs/DECISIONS.md`
- Behavior: tests
- Runtime evidence: `.agentrail/audit.jsonl`
- User-facing commands: README

When debugging, start with the layer that failed instead of scanning unrelated code.
