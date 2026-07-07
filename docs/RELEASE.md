# Release

This is the local release process for Agenstral.

## Local Gate

Run:

```sh
npm run release:check
```

The gate builds, tests, performs a package dry-run, runs doctor, scans the repository, writes SARIF, creates an evidence bundle, and verifies the bundle.

Expected generated outputs:

- `.agenstral/scan.sarif`
- `.agenstral/bundle.json`
- `.agenstral/report.html`
- `dist/`

These paths are ignored by Git.

## Publish Checklist

1. Confirm `npm run release:check` passes.
2. Confirm `git status --short` has no tracked changes.
3. Confirm `git log --all --format="%H %s"` has no legacy or collision-prone project names.
4. Create a signed tag if signing is configured: `git tag -s v0.1.0 -m "v0.1.0"`.
5. Publish to npm only from a clean tree: `npm publish --access public`.
6. Push commits and tags after publication: `git push --follow-tags`.

If the repository was already pushed before a history rewrite, use `git push --force-with-lease` deliberately and only after confirming collaborators are aligned.

## Evidence

Attach the generated evidence bundle and SARIF artifact to releases when possible. The bundle is the portable backtracking artifact; SARIF is the standard CI/security interchange artifact.
