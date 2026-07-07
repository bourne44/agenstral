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
- `agenstral scan --workspace . --fail-on medium` passes.
- `agenstral scan --workspace . --sarif --out .agenstral/scan.sarif` writes SARIF.
- `agenstral audit verify <log>` succeeds for generated demo logs.
- `agenstral report` writes `.agenstral/report.html`.
- `agenstral bundle` writes `.agenstral/bundle.json` and a synced report.
- `agenstral bundle verify .agenstral/bundle.json` succeeds.
- README commands still work.

## CI Gate

The repository workflow in `.github/workflows/ci.yml` runs install, build, tests, package dry-run, repository scan, SARIF export, evidence bundle creation, bundle verification, and evidence artifact upload. GitHub Actions are pinned to full commit SHAs so the workflow passes Agenstral's own supply-chain checks.

## Backtracking Model

The source of truth is split into compact layers:

- Intent and structure: `docs/PROJECT_MAP.md`
- Rationale: `docs/DECISIONS.md`
- Behavior: tests
- Runtime evidence: `.agenstral/audit.jsonl`
- CI evidence: `.agenstral/scan.sarif`
- Portable evidence: `.agenstral/bundle.json`
- Review surface: `.agenstral/report.html`
- User-facing commands: README

When debugging, run `agenstral state`, verify the bundle, then open the HTML report only if the compact state is not enough.
