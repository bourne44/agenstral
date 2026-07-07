import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEventInput, AuditRecord, AuditVerification, JsonObject } from "../domain/types.js";
import { redactSecrets } from "../secrets/detect.js";
import { canonicalJson } from "../utils/canonicalJson.js";

export async function appendAuditEvent(path: string, input: AuditEventInput): Promise<AuditRecord> {
  await mkdir(dirname(path), { recursive: true });
  const previousHash = await readLastHash(path);
  const recordWithoutHash: Omit<AuditRecord, "hash"> = {
    version: 1,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    kind: input.kind,
    payload: redactSecrets(input.payload),
    previousHash
  };
  const hash = hashRecord(recordWithoutHash);
  const record: AuditRecord = { ...recordWithoutHash, hash };
  await writeFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "a" });
  return record;
}

export async function readAuditRecords(path: string): Promise<AuditRecord[]> {
  try {
    await access(path);
  } catch {
    return [];
  }

  const contents = await readFile(path, "utf8");
  return contents
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => parseAuditRecord(line, index + 1));
}

export async function verifyAuditLog(path: string): Promise<AuditVerification> {
  const records = await readAuditRecords(path);
  const errors: string[] = [];
  let previousHash: string | null = null;

  records.forEach((record, index) => {
    if (record.previousHash !== previousHash) {
      errors.push(`line ${index + 1}: previousHash mismatch`);
    }

    const { hash: _hash, ...withoutHash } = record;
    const expectedHash = hashRecord(withoutHash);
    if (record.hash !== expectedHash) {
      errors.push(`line ${index + 1}: hash mismatch`);
    }

    previousHash = record.hash;
  });

  return {
    ok: errors.length === 0,
    records: records.length,
    errors
  };
}

function hashRecord(record: Omit<AuditRecord, "hash">): string {
  return createHash("sha256").update(canonicalJson(record as JsonObject)).digest("hex");
}

async function readLastHash(path: string): Promise<string | null> {
  const records = await readAuditRecords(path);
  return records.at(-1)?.hash ?? null;
}

function parseAuditRecord(line: string, lineNumber: number): AuditRecord {
  const parsed = JSON.parse(line) as unknown;
  if (!isAuditRecord(parsed)) {
    throw new Error(`Invalid audit record at line ${lineNumber}`);
  }
  return parsed;
}

function isAuditRecord(value: unknown): value is AuditRecord {
  const candidate = value as Partial<AuditRecord>;
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.kind === "string" &&
    "payload" in value &&
    (typeof candidate.previousHash === "string" || candidate.previousHash === null) &&
    typeof candidate.hash === "string"
  );
}
