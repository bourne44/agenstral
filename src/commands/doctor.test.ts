import { strict as assert } from "node:assert";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runDoctorCommand } from "./doctor.js";

test("doctor command sets a failing exit code when fail threshold is met", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "agenstral-doctor-command-"));
  await writeFile(join(workspace, "README.md"), "# Fixture\n", "utf8");

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

    await runDoctorCommand(["--workspace", workspace, "--fail-on", "fail"]);

    assert.equal(process.exitCode, 2);
    assert.match(output.join("\n"), /required-file\.license/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
});
