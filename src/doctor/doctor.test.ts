import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runDoctor } from "./doctor.js";

test("passes required release checks for a prepared workspace", async () => {
  const workspace = await createWorkspace();

  const report = await runDoctor({ workspace });

  assert.equal(report.summary.fail, 0);
  assert.ok(report.checks.some((check) => check.id === "package.release-scripts" && check.status === "pass"));
  assert.ok(report.checks.some((check) => check.id === "scan.risk-findings" && check.status === "pass"));
});

test("fails when a required open-source file is missing", async () => {
  const workspace = await createWorkspace({ omitLicense: true });

  const report = await runDoctor({ workspace });

  assert.ok(report.summary.fail > 0);
  assert.ok(report.checks.some((check) => check.id === "required-file.license" && check.status === "fail"));
});

async function createWorkspace(options: { omitLicense?: boolean } = {}): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "agenstral-doctor-"));
  await mkdir(join(workspace, ".github", "workflows"), { recursive: true });
  await writeFile(join(workspace, "README.md"), "# Fixture\n", "utf8");
  if (!options.omitLicense) {
    await writeFile(join(workspace, "LICENSE"), "Apache-2.0\n", "utf8");
  }
  await writeFile(join(workspace, "SECURITY.md"), "# Security\n", "utf8");
  await writeFile(join(workspace, "CONTRIBUTING.md"), "# Contributing\n", "utf8");
  await writeFile(join(workspace, "CHANGELOG.md"), "# Changelog\n", "utf8");
  await writeFile(join(workspace, "AGENTS.md"), "Setup: npm install\nTesting: npm test\nSecurity: no secrets.\n", "utf8");
  await writeFile(join(workspace, ".gitignore"), ".agenstral/\ndist/\nnode_modules/\n", "utf8");
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify(
      {
        name: "doctor-fixture",
        version: "1.0.0",
        license: "Apache-2.0",
        type: "module",
        bin: {
          fixture: "./dist/cli.js"
        },
        scripts: {
          build: "tsc",
          test: "node --test",
          verify: "npm run build && npm test",
          "release:check": "npm run verify && npm pack --dry-run",
          "scan:ci": "node dist/cli.js scan --workspace . --fail-on medium",
          "scan:sarif": "node dist/cli.js scan --workspace . --sarif --out .agenstral/scan.sarif"
        },
        engines: {
          node: ">=22.0.0"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    join(workspace, ".github", "workflows", "ci.yml"),
    "name: ci\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "utf8"
  );
  return workspace;
}
