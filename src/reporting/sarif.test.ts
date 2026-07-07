import { strict as assert } from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import type { JsonObject, ScanReport } from "../domain/types.js";
import { renderSarifReport } from "./sarif.js";

test("renders SARIF with deduplicated rules and severity levels", () => {
  const workspace = join(process.cwd(), "fixture-repo");
  const report: ScanReport = {
    scannedAt: "2026-07-07T00:00:00.000Z",
    workspace,
    configs: [],
    guidance: [],
    findings: [
      {
        id: "package.script.remote-exec",
        title: "Command downloads and executes remote code",
        severity: "high",
        location: join(workspace, "package.json") + "#scripts.install",
        detail: "The command pipes downloaded content into a shell.",
        recommendation: "Pin and review the script."
      },
      {
        id: "package.script.remote-exec",
        title: "Command downloads and executes remote code",
        severity: "medium",
        location: join(workspace, ".github", "workflows", "ci.yml") + ":12",
        detail: "The command pipes downloaded content into a shell.",
        recommendation: "Pin and review the script."
      }
    ]
  };

  const sarif = renderSarifReport(report);
  const run = firstRun(sarif);
  const driver = objectAt(objectAt(run, "tool"), "driver");
  const rules = arrayAt(driver, "rules");
  const results = arrayAt(run, "results");

  assert.equal(sarif["version"], "2.1.0");
  assert.equal(rules.length, 1);
  assert.equal(objectAt(results[0], "message")["text"]?.toString().includes("Recommendation"), true);
  assert.equal(objectAt(results[0])["level"], "error");
  assert.equal(objectAt(results[1])["level"], "warning");
  assert.equal(artifactUri(results[0]), "package.json");
  assert.equal(artifactUri(results[1]), ".github/workflows/ci.yml");
  assert.equal(region(results[1])["startLine"], 12);
});

function firstRun(sarif: JsonObject): JsonObject {
  return arrayAt(sarif, "runs")[0] as JsonObject;
}

function artifactUri(result: unknown): string {
  const physical = objectAt(arrayAt(result, "locations")[0], "physicalLocation");
  return String(objectAt(physical, "artifactLocation")["uri"]);
}

function region(result: unknown): JsonObject {
  const physical = objectAt(arrayAt(result, "locations")[0], "physicalLocation");
  return objectAt(physical, "region");
}

function arrayAt(value: unknown, key: string): unknown[] {
  const object = objectAt(value);
  const field = object[key];
  assert.ok(Array.isArray(field), `${key} should be an array`);
  return field;
}

function objectAt(value: unknown, key?: string): JsonObject {
  const target = key ? objectAt(value)[key] : value;
  assert.ok(target !== null && typeof target === "object" && !Array.isArray(target), `${key ?? "value"} should be an object`);
  return target as JsonObject;
}
