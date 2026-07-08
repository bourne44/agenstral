# Demo workspace

A deliberately risky sample project used to show what `agenstral scan` catches.
Nothing here is meant to be run. Scan it from the repository root:

```sh
agenstral scan --workspace examples/demo
```

Expected: several findings across the package manifest, the GitHub Actions
workflow, and the agent guidance file, plus a non-zero exit under
`--fail-on medium`.
