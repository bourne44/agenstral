import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { isAuditRecord, readAuditRecords, verifyAuditRecords } from "../audit/auditLog.js";
import type { AuditRecord, AuditVerification, JsonObject, JsonValue, ScanReport } from "../domain/types.js";
import { DEFAULT_POLICY } from "../policy/defaultPolicy.js";
import { renderHtmlReport } from "../reporting/htmlReport.js";
import { scanWorkspace } from "../scanner/discovery.js";
import { SYSTEM_COMPONENTS, type SystemComponent } from "../systemMap.js";
import { canonicalJson } from "../utils/canonicalJson.js";
import { isJsonObject } from "../utils/jsonFile.js";

const HASH_ALGORITHM = "sha256";

const GENERATED_DIRS = new Set([".agenstral/", "dist/", "node_modules/"]);

const execFileAsync = promisify(execFile);

export interface EvidenceBundleOptions {
  workspace: string;
  auditPath?: string;
  policyPath?: string;
  generatedAt?: string;
}

export interface EvidenceBundleCore {
  version: 1;
  generatedAt: string;
  workspace: string;
  package: {
    path: string | null;
    present: boolean;
    name: string | null;
    version: string | null;
    sha256: string | null;
    manifest: JsonValue | null;
  };
  policy: {
    path: string;
    source: "file" | "default";
    present: boolean;
    sha256: string;
    body: JsonValue;
  };
  audit: {
    path: string;
    verification: AuditVerification;
    records: AuditRecord[];
    lastHash: string | null;
  };
  scan: ScanReport;
  git: {
    available: boolean;
    branch: string | null;
    head: string | null;
    status: string[];
    changedFiles: number;
    ignoredGenerated: string[];
  };
  report: {
    sha256: string;
    html: string;
  };
  systemMap: SystemComponent[];
}

export interface EvidenceBundle extends EvidenceBundleCore {
  integrity: {
    algorithm: "sha256";
    bundleHash: string;
    covers: "all fields except integrity";
  };
}

export interface EvidenceBundleVerification {
  ok: boolean;
  hash: string | null;
  audit: AuditVerification | null;
  errors: string[];
}

export async function createEvidenceBundle(options: EvidenceBundleOptions): Promise<EvidenceBundle> {
  const workspace = resolve(options.workspace);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const auditPath = resolve(options.auditPath ?? join(workspace, ".agenstral", "audit.jsonl"));
  const policyPath = resolve(options.policyPath ?? join(workspace, ".agenstral", "policy.json"));

  const [scan, auditRecords, policy, packageInfo, git] = await Promise.all([
    scanWorkspace({ workspace }),
    readAuditRecords(auditPath),
    readPolicyEvidence(policyPath),
    readPackageEvidence(workspace),
    readGitEvidence(workspace)
  ]);

  const auditVerification = verifyAuditRecords(auditRecords);
  const reportHtml = renderHtmlReport({
    generatedAt,
    scan,
    audit: {
      records: auditRecords,
      verification: auditVerification
    },
    git: {
      changedFiles: git.changedFiles,
      head: git.head
    }
  });

  return withIntegrity({
    version: 1,
    generatedAt,
    workspace,
    package: packageInfo,
    policy,
    audit: {
      path: auditPath,
      verification: auditVerification,
      records: auditRecords,
      lastHash: auditRecords.at(-1)?.hash ?? null
    },
    scan,
    git,
    report: {
      sha256: sha256Text(reportHtml),
      html: reportHtml
    },
    systemMap: SYSTEM_COMPONENTS
  });
}

export function verifyEvidenceBundle(value: unknown): EvidenceBundleVerification {
  const errors: string[] = [];

  if (!isJsonObject(value)) {
    return {
      ok: false,
      hash: null,
      audit: null,
      errors: ["bundle must be a JSON object"]
    };
  }

  if (value["version"] !== 1) {
    errors.push("unsupported or missing bundle version");
  }

  const integrity = value["integrity"];
  const suppliedHash = isJsonObject(integrity) && typeof integrity["bundleHash"] === "string" ? integrity["bundleHash"] : null;
  if (!suppliedHash) {
    errors.push("missing integrity.bundleHash");
  }

  const core = withoutIntegrity(value);
  const computedHash = hashJson(core);
  if (suppliedHash && suppliedHash !== computedHash) {
    errors.push("bundle hash mismatch");
  }

  const audit = verifyEmbeddedAudit(value);
  if (!audit.verification) {
    errors.push(...audit.errors);
  } else {
    if (!audit.verification.ok) {
      errors.push(...audit.verification.errors.map((error) => `audit ${error}`));
    }
    errors.push(...audit.errors);
  }

  return {
    ok: errors.length === 0,
    hash: computedHash,
    audit: audit.verification,
    errors
  };
}

function withIntegrity(core: EvidenceBundleCore): EvidenceBundle {
  return {
    ...core,
    integrity: {
      algorithm: HASH_ALGORITHM,
      bundleHash: hashJson(core as unknown as JsonObject),
      covers: "all fields except integrity"
    }
  };
}

function withoutIntegrity(value: JsonObject): JsonObject {
  const core: JsonObject = {};
  for (const [key, field] of Object.entries(value)) {
    if (key !== "integrity") {
      core[key] = field;
    }
  }
  return core;
}

function verifyEmbeddedAudit(bundle: JsonObject): { verification: AuditVerification | null; errors: string[] } {
  const errors: string[] = [];
  const audit = bundle["audit"];
  if (!isJsonObject(audit)) {
    return {
      verification: null,
      errors: ["missing audit object"]
    };
  }

  const recordsValue = audit["records"];
  if (!Array.isArray(recordsValue)) {
    return {
      verification: null,
      errors: ["missing audit.records array"]
    };
  }

  const records: AuditRecord[] = [];
  for (const record of recordsValue) {
    if (!isAuditRecord(record)) {
      return {
        verification: null,
        errors: ["audit.records contains invalid records"]
      };
    }
    records.push(record);
  }

  const verification = verifyAuditRecords(records);
  const embedded = audit["verification"];
  if (!isJsonObject(embedded)) {
    errors.push("missing audit.verification object");
  } else {
    if (typeof embedded["ok"] === "boolean" && embedded["ok"] !== verification.ok) {
      errors.push("audit.verification.ok does not match embedded records");
    }
    if (typeof embedded["records"] === "number" && embedded["records"] !== verification.records) {
      errors.push("audit.verification.records does not match embedded records");
    }
  }

  return {
    verification,
    errors
  };
}

async function readPolicyEvidence(path: string): Promise<EvidenceBundleCore["policy"]> {
  const contents = await readOptionalText(path);
  if (contents === null) {
    const body = DEFAULT_POLICY as unknown as JsonValue;
    return {
      path,
      source: "default",
      present: false,
      sha256: hashJson(body),
      body
    };
  }

  const body = JSON.parse(contents) as JsonValue;
  return {
    path,
    source: "file",
    present: true,
    sha256: sha256Text(contents),
    body
  };
}

async function readPackageEvidence(workspace: string): Promise<EvidenceBundleCore["package"]> {
  const path = join(workspace, "package.json");
  const contents = await readOptionalText(path);
  if (contents === null) {
    return {
      path: null,
      present: false,
      name: null,
      version: null,
      sha256: null,
      manifest: null
    };
  }

  const manifest = parseJsonOrNull(contents);
  const manifestObject = isJsonObject(manifest) ? manifest : null;
  return {
    path,
    present: true,
    name: typeof manifestObject?.["name"] === "string" ? manifestObject["name"] : null,
    version: typeof manifestObject?.["version"] === "string" ? manifestObject["version"] : null,
    sha256: sha256Text(contents),
    manifest
  };
}

async function readGitEvidence(workspace: string): Promise<EvidenceBundleCore["git"]> {
  try {
    const [{ stdout: status }, { stdout: head }, { stdout: branch }] = await Promise.all([
      execFileAsync("git", ["status", "--short", "--ignored"], { cwd: workspace }),
      execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: workspace }),
      execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workspace })
    ]);
    const lines = status.split(/\r?\n/).filter(Boolean);
    const trackedStatus = lines.filter((line) => !line.startsWith("!! "));

    return {
      available: true,
      branch: branch.trim() === "HEAD" ? null : branch.trim() || null,
      head: head.trim() || null,
      status: trackedStatus,
      changedFiles: trackedStatus.length,
      ignoredGenerated: lines
        .filter((line) => line.startsWith("!! "))
        .map((line) => line.slice(3))
        .filter((path) => GENERATED_DIRS.has(path))
    };
  } catch {
    return {
      available: false,
      branch: null,
      head: null,
      status: [],
      changedFiles: 0,
      ignoredGenerated: []
    };
  }
}

function parseJsonOrNull(contents: string): JsonValue | null {
  try {
    return JSON.parse(contents) as JsonValue;
  } catch {
    return null;
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function hashJson(value: JsonValue): string {
  return sha256Text(canonicalJson(value));
}

function sha256Text(value: string): string {
  return createHash(HASH_ALGORITHM).update(value).digest("hex");
}
