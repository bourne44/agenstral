import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { verifyAuditLog } from "../audit/auditLog.js";
import type { ScanReport, Severity } from "../domain/types.js";
import { scanWorkspace } from "../scanner/discovery.js";
import { getFlag, hasFlag } from "../utils/args.js";
import { isJsonObject, readJsonFile } from "../utils/jsonFile.js";

const execFileAsync = promisify(execFile);

interface ProjectState {
  workspace: string;
  packageName: string | null;
  packageVersion: string | null;
  policyPresent: boolean;
  audit: {
    present: boolean;
    ok: boolean;
    records: number;
    errors: string[];
  };
  scan: {
    mcpServers: number;
    guidanceFiles: number;
    findings: Record<Severity, number>;
  };
  git: {
    available: boolean;
    changedFiles: number;
    ignoredGenerated: string[];
  };
}

export async function runStateCommand(args: string[]): Promise<void> {
  const workspace = resolve(getFlag(args, "--workspace") ?? process.cwd());
  const state = await collectProjectState(workspace);

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  console.log(formatProjectState(state));
}

async function collectProjectState(workspace: string): Promise<ProjectState> {
  const policyPath = join(workspace, ".agenstral", "policy.json");
  const auditPath = join(workspace, ".agenstral", "audit.jsonl");
  const scan = await scanWorkspace({ workspace });
  const auditPresent = await exists(auditPath);
  const audit = auditPresent ? await verifyAuditLog(auditPath) : { ok: true, records: 0, errors: [] };
  const packageInfo = await readPackageInfo(workspace);
  const git = await readGitState(workspace);

  return {
    workspace,
    packageName: packageInfo.name,
    packageVersion: packageInfo.version,
    policyPresent: await exists(policyPath),
    audit: {
      present: auditPresent,
      ok: audit.ok,
      records: audit.records,
      errors: audit.errors
    },
    scan: summarizeScan(scan),
    git
  };
}

function summarizeScan(scan: ScanReport): ProjectState["scan"] {
  const findings: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  for (const finding of scan.findings) {
    findings[finding.severity] += 1;
  }

  return {
    mcpServers: scan.configs.length,
    guidanceFiles: scan.guidance.length,
    findings
  };
}

async function readPackageInfo(workspace: string): Promise<{ name: string | null; version: string | null }> {
  try {
    const parsed = await readJsonFile(join(workspace, "package.json"));
    if (!isJsonObject(parsed)) {
      return { name: null, version: null };
    }

    return {
      name: typeof parsed["name"] === "string" ? parsed["name"] : null,
      version: typeof parsed["version"] === "string" ? parsed["version"] : null
    };
  } catch {
    return { name: null, version: null };
  }
}

async function readGitState(workspace: string): Promise<ProjectState["git"]> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--ignored", "--short"], { cwd: workspace });
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    return {
      available: true,
      changedFiles: lines.filter((line) => !line.startsWith("!! ")).length,
      ignoredGenerated: lines
        .filter((line) => line.startsWith("!! "))
        .map((line) => line.slice(3))
        .filter((path) => path === ".agenstral/" || path === "dist/" || path === "node_modules/")
    };
  } catch {
    return {
      available: false,
      changedFiles: 0,
      ignoredGenerated: []
    };
  }
}

function formatProjectState(state: ProjectState): string {
  const name = state.packageName ? `${state.packageName}@${state.packageVersion ?? "unknown"}` : "unknown package";
  const lines = [
    "Agenstral State",
    `Workspace: ${state.workspace}`,
    `Package: ${name}`,
    `Policy: ${state.policyPresent ? "present" : "missing"}`,
    `Audit: ${state.audit.present ? `${state.audit.records} record(s), ${state.audit.ok ? "verified" : "failed"}` : "missing"}`,
    `MCP servers: ${state.scan.mcpServers}`,
    `Guidance files: ${state.scan.guidanceFiles}`,
    `Findings: critical=${state.scan.findings.critical}, high=${state.scan.findings.high}, medium=${state.scan.findings.medium}, low=${state.scan.findings.low}, info=${state.scan.findings.info}`,
    `Git: ${state.git.available ? `${state.git.changedFiles} changed file(s)` : "not available"}`,
    `Ignored generated dirs: ${state.git.ignoredGenerated.length > 0 ? state.git.ignoredGenerated.join(", ") : "none"}`
  ];

  if (!state.audit.ok) {
    lines.push("Audit errors:");
    for (const error of state.audit.errors) {
      lines.push(`- ${error}`);
    }
  }

  return lines.join("\n");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
