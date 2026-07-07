import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { verifyAuditLog } from "../audit/auditLog.js";
import type { JsonObject, JsonValue, ScanReport } from "../domain/types.js";
import { scanWorkspace } from "../scanner/discovery.js";
import { isJsonObject } from "../utils/jsonFile.js";

const execFileAsync = promisify(execFile);

const REQUIRED_FILES = ["README.md", "LICENSE", "SECURITY.md", "AGENTS.md"];
const REQUIRED_SCRIPTS = ["build", "test", "verify", "scan:ci", "scan:sarif"];
const GENERATED_IGNORES = [".agenstral/", "dist/", "node_modules/"];

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  title: string;
  detail: string;
  recommendation?: string;
}

export interface DoctorReport {
  checkedAt: string;
  workspace: string;
  checks: DoctorCheck[];
  summary: Record<DoctorStatus, number>;
}

export interface DoctorOptions {
  workspace: string;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const workspace = resolve(options.workspace);
  const scan = await scanWorkspace({ workspace });
  const checks: DoctorCheck[] = [];

  checks.push(...(await checkRequiredFiles(workspace)));
  checks.push(...(await checkPackageManifest(workspace)));
  checks.push(...(await checkGeneratedIgnores(workspace)));
  checks.push(...(await checkWorkflow(workspace)));
  checks.push(...checkScan(scan));
  checks.push(await checkAudit(workspace));
  checks.push(await checkGit(workspace));

  return {
    checkedAt: new Date().toISOString(),
    workspace,
    checks,
    summary: summarizeChecks(checks)
  };
}

export function summarizeChecks(checks: DoctorCheck[]): Record<DoctorStatus, number> {
  const summary: Record<DoctorStatus, number> = {
    pass: 0,
    warn: 0,
    fail: 0
  };

  for (const check of checks) {
    summary[check.status] += 1;
  }

  return summary;
}

async function checkRequiredFiles(workspace: string): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  for (const file of REQUIRED_FILES) {
    const path = join(workspace, file);
    const present = await exists(path);
    checks.push({
      id: `required-file.${file.toLowerCase()}`,
      status: present ? "pass" : "fail",
      title: `Required file ${file}`,
      detail: present ? `${file} is present.` : `${file} is missing.`,
      ...(present ? {} : { recommendation: `Add ${file} before publishing or handing off the project.` })
    });
  }

  return checks;
}

async function checkPackageManifest(workspace: string): Promise<DoctorCheck[]> {
  const packagePath = join(workspace, "package.json");
  const contents = await readOptionalText(packagePath);
  if (contents === null) {
    return [
      {
        id: "package.manifest",
        status: "fail",
        title: "Package manifest",
        detail: "package.json is missing.",
        recommendation: "Add package.json with name, version, license, bin, engines, and release scripts."
      }
    ];
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(contents) as JsonValue;
  } catch (error) {
    return [
      {
        id: "package.manifest",
        status: "fail",
        title: "Package manifest",
        detail: error instanceof Error ? error.message : "package.json could not be parsed.",
        recommendation: "Fix package.json syntax before running release gates."
      }
    ];
  }

  if (!isJsonObject(parsed)) {
    return [
      {
        id: "package.manifest",
        status: "fail",
        title: "Package manifest",
        detail: "package.json is not a JSON object.",
        recommendation: "Use a standard package manifest object."
      }
    ];
  }

  return [
    requiredPackageField(parsed, "name"),
    requiredPackageField(parsed, "version"),
    requiredPackageField(parsed, "license"),
    packageBinCheck(parsed),
    packageEngineCheck(parsed),
    packageScriptsCheck(parsed),
    runtimeDependencyCheck(parsed)
  ];
}

function requiredPackageField(manifest: JsonObject, field: string): DoctorCheck {
  const value = manifest[field];
  const present = typeof value === "string" && value.trim().length > 0;
  return {
    id: `package.${field}`,
    status: present ? "pass" : "fail",
    title: `Package ${field}`,
    detail: present ? `package.json has ${field}=${value}.` : `package.json is missing ${field}.`,
    ...(present ? {} : { recommendation: `Set package.json ${field}.` })
  };
}

function packageBinCheck(manifest: JsonObject): DoctorCheck {
  const present = isJsonObject(manifest["bin"]) && Object.keys(manifest["bin"]).length > 0;
  return {
    id: "package.bin",
    status: present ? "pass" : "fail",
    title: "Package CLI bin",
    detail: present ? "package.json exposes a CLI bin." : "package.json does not expose a CLI bin.",
    ...(present ? {} : { recommendation: "Expose the CLI through package.json bin before packaging." })
  };
}

function packageEngineCheck(manifest: JsonObject): DoctorCheck {
  const engines = manifest["engines"];
  const node = isJsonObject(engines) ? engines["node"] : undefined;
  const present = typeof node === "string" && node.trim().length > 0;
  return {
    id: "package.engines.node",
    status: present ? "pass" : "warn",
    title: "Package Node engine",
    detail: present ? `package.json declares node engine ${node}.` : "package.json does not declare a Node engine.",
    ...(present ? {} : { recommendation: "Declare the supported Node version range in package.json engines.node." })
  };
}

function packageScriptsCheck(manifest: JsonObject): DoctorCheck {
  const scripts = manifest["scripts"];
  const missing = isJsonObject(scripts) ? REQUIRED_SCRIPTS.filter((script) => typeof scripts[script] !== "string") : REQUIRED_SCRIPTS;
  const ok = missing.length === 0;
  return {
    id: "package.release-scripts",
    status: ok ? "pass" : "fail",
    title: "Release scripts",
    detail: ok ? "Required release scripts are present." : `Missing scripts: ${missing.join(", ")}.`,
    ...(ok ? {} : { recommendation: `Add scripts: ${missing.join(", ")}.` })
  };
}

function runtimeDependencyCheck(manifest: JsonObject): DoctorCheck {
  const dependencies = manifest["dependencies"];
  const count = isJsonObject(dependencies) ? Object.keys(dependencies).length : 0;
  return {
    id: "package.runtime-dependencies",
    status: count === 0 ? "pass" : "warn",
    title: "Runtime dependency surface",
    detail: count === 0 ? "No runtime dependencies declared." : `${count} runtime package dependenc${count === 1 ? "y" : "ies"} declared.`,
    ...(count === 0 ? {} : { recommendation: "Keep runtime dependencies justified, pinned by lockfile, and reviewed." })
  };
}

async function checkGeneratedIgnores(workspace: string): Promise<DoctorCheck[]> {
  const text = (await readOptionalText(join(workspace, ".gitignore"))) ?? "";

  return GENERATED_IGNORES.map((entry) => {
    const ignored = text.split(/\r?\n/).some((line) => normalizeIgnore(line) === normalizeIgnore(entry));
    return {
      id: `gitignore.${entry.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`,
      status: ignored ? "pass" : "warn",
      title: `Ignore generated ${entry}`,
      detail: ignored ? `${entry} is ignored.` : `${entry} is not listed in .gitignore.`,
      ...(ignored ? {} : { recommendation: `Add ${entry} to .gitignore to keep generated evidence and build output out of commits.` })
    };
  });
}

async function checkWorkflow(workspace: string): Promise<DoctorCheck[]> {
  const path = join(workspace, ".github", "workflows", "ci.yml");
  const present = await exists(path);
  return [
    {
      id: "ci.workflow",
      status: present ? "pass" : "warn",
      title: "CI workflow",
      detail: present ? "CI workflow is present." : "No .github/workflows/ci.yml file found.",
      ...(present ? {} : { recommendation: "Add a CI workflow that runs verify, scan, package dry-run, and evidence checks." })
    }
  ];
}

function checkScan(scan: ScanReport): DoctorCheck[] {
  const critical = scan.findings.filter((finding) => finding.severity === "critical").length;
  const high = scan.findings.filter((finding) => finding.severity === "high").length;
  const medium = scan.findings.filter((finding) => finding.severity === "medium").length;
  const low = scan.findings.filter((finding) => finding.severity === "low").length;

  if (critical > 0 || high > 0) {
    return [
      {
        id: "scan.high-risk-findings",
        status: "fail",
        title: "High-risk scan findings",
        detail: `Scan found critical=${critical}, high=${high}.`,
        recommendation: "Resolve critical and high findings before release or agent handoff."
      }
    ];
  }

  if (medium > 0 || low > 0) {
    return [
      {
        id: "scan.medium-low-findings",
        status: "warn",
        title: "Medium or low scan findings",
        detail: `Scan found medium=${medium}, low=${low}.`,
        recommendation: "Review medium and low findings before release."
      }
    ];
  }

  return [
    {
      id: "scan.risk-findings",
      status: "pass",
      title: "Risk scan",
      detail: "No low, medium, high, or critical scan findings."
    }
  ];
}

async function checkAudit(workspace: string): Promise<DoctorCheck> {
  const path = join(workspace, ".agenstral", "audit.jsonl");
  if (!(await exists(path))) {
    return {
      id: "audit.log",
      status: "warn",
      title: "Audit log",
      detail: "No local audit log found.",
      recommendation: "Generate an audit log during mediated runs or checks before relying on session evidence."
    };
  }

  const verification = await verifyAuditLog(path);
  return {
    id: "audit.log",
    status: verification.ok ? "pass" : "fail",
    title: "Audit log",
    detail: verification.ok ? `Audit log verified with ${verification.records} record(s).` : verification.errors.join("; "),
    ...(verification.ok ? {} : { recommendation: "Inspect or regenerate the audit log before trusting local evidence." })
  };
}

async function checkGit(workspace: string): Promise<DoctorCheck> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: workspace });
    const changed = stdout.split(/\r?\n/).filter(Boolean);
    return {
      id: "git.clean",
      status: changed.length === 0 ? "pass" : "fail",
      title: "Git working tree",
      detail: changed.length === 0 ? "No tracked changes." : `${changed.length} tracked change(s) present.`,
      ...(changed.length === 0 ? {} : { recommendation: "Commit, stash, or intentionally review tracked changes before release." })
    };
  } catch {
    return {
      id: "git.clean",
      status: "warn",
      title: "Git working tree",
      detail: "Git status is unavailable.",
      recommendation: "Run doctor inside a Git repository for release checks."
    };
  }
}

function normalizeIgnore(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/?$/, "/");
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
