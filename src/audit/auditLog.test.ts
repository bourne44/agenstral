import { strict as assert } from "node:assert";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { appendAuditEvent, readAuditRecords, verifyAuditLog } from "./auditLog.js";

test("writes and verifies a hash-chained audit log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agenstral-audit-"));
  const path = join(dir, "audit.jsonl");

  await appendAuditEvent(path, { kind: "one", payload: { value: 1 } });
  await appendAuditEvent(path, { kind: "two", payload: { value: 2 } });

  const records = await readAuditRecords(path);
  assert.equal(records.length, 2);
  assert.equal(records[1]?.previousHash, records[0]?.hash);

  const verification = await verifyAuditLog(path);
  assert.equal(verification.ok, true);
  assert.equal(verification.records, 2);
});

test("detects audit tampering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agenstral-audit-"));
  const path = join(dir, "audit.jsonl");

  await appendAuditEvent(path, { kind: "one", payload: { value: 1 } });
  const tampered = (await readFile(path, "utf8")).replace("\"value\":1", "\"value\":9");
  await writeFile(path, tampered, "utf8");

  const verification = await verifyAuditLog(path);
  assert.equal(verification.ok, false);
  assert.match(verification.errors.join("\n"), /hash mismatch/);
});
