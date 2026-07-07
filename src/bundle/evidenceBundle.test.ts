import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { appendAuditEvent } from "../audit/auditLog.js";
import { createEvidenceBundle, verifyEvidenceBundle } from "./evidenceBundle.js";

test("creates and verifies an evidence bundle", async () => {
  const workspace = await createWorkspace();
  await appendAuditEvent(join(workspace, ".agenstral", "audit.jsonl"), {
    kind: "policy.decision",
    payload: {
      action: "allow",
      tool: "read_file"
    }
  });

  const bundle = await createEvidenceBundle({
    workspace,
    generatedAt: "2026-07-07T00:00:00.000Z"
  });

  assert.equal(bundle.version, 1);
  assert.equal(bundle.package.name, "bundle-fixture");
  assert.equal(bundle.audit.records.length, 1);
  assert.equal(bundle.audit.verification.ok, true);
  assert.equal(bundle.integrity.algorithm, "sha256");
  assert.equal(bundle.integrity.bundleHash.length, 64);
  assert.match(bundle.report.html, /Agenstral Report/);

  const verification = verifyEvidenceBundle(bundle);
  assert.equal(verification.ok, true, verification.errors.join("\n"));
  assert.equal(verification.audit?.records, 1);
});

test("detects bundle tampering", async () => {
  const workspace = await createWorkspace();
  const bundle = await createEvidenceBundle({
    workspace,
    generatedAt: "2026-07-07T00:00:00.000Z"
  });

  const tampered = structuredClone(bundle);
  tampered.scan.workspace = "C:/different-workspace";

  const verification = verifyEvidenceBundle(tampered);
  assert.equal(verification.ok, false);
  assert.ok(verification.errors.includes("bundle hash mismatch"));
});

test("detects embedded audit tampering", async () => {
  const workspace = await createWorkspace();
  await appendAuditEvent(join(workspace, ".agenstral", "audit.jsonl"), {
    kind: "policy.decision",
    payload: {
      action: "ask",
      tool: "shell"
    }
  });

  const bundle = await createEvidenceBundle({
    workspace,
    generatedAt: "2026-07-07T00:00:00.000Z"
  });
  const tampered = structuredClone(bundle);
  const firstRecord = tampered.audit.records[0];
  assert.ok(firstRecord);
  tampered.audit.records[0] = {
    ...firstRecord,
    previousHash: "not-the-original-link"
  };

  const verification = verifyEvidenceBundle(tampered);
  assert.equal(verification.ok, false);
  assert.ok(verification.errors.some((error) => error.includes("audit line 1: previousHash mismatch")));
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "agenstral-bundle-"));
  await mkdir(join(workspace, ".agenstral"), { recursive: true });
  await writeFile(
    join(workspace, "package.json"),
    `${JSON.stringify({ name: "bundle-fixture", version: "1.0.0" }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(workspace, "AGENTS.md"), "Setup: npm install\nTesting: npm test\nSecurity: no secrets.\n", "utf8");
  return workspace;
}
