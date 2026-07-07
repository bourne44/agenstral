import type { ScanReport, Severity } from "../domain/types.js";
import { scanWorkspace } from "../scanner/discovery.js";
import { formatScanReport } from "../reporting/console.js";
import { getFlag, hasFlag } from "../utils/args.js";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export async function runScanCommand(args: string[]): Promise<void> {
  const workspace = getFlag(args, "--workspace") ?? process.cwd();
  const failOn = parseSeverityFlag(getFlag(args, "--fail-on"));
  const report = await scanWorkspace({ workspace });

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatScanReport(report));
  }

  if (failOn && hasFindingAtOrAbove(report, failOn)) {
    const matching = report.findings.filter((finding) => severityAtLeast(finding.severity, failOn));
    console.error(`agenstral: scan failed because ${matching.length} finding(s) are ${failOn} or higher`);
    process.exitCode = 2;
  }
}

export function hasFindingAtOrAbove(report: ScanReport, threshold: Severity): boolean {
  return report.findings.some((finding) => severityAtLeast(finding.severity, threshold));
}

function severityAtLeast(actual: Severity, threshold: Severity): boolean {
  return SEVERITY_RANK[actual] >= SEVERITY_RANK[threshold];
}

function parseSeverityFlag(value: string | undefined): Severity | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (isSeverity(normalized)) {
    return normalized;
  }

  throw new Error(`Invalid --fail-on severity: ${value}. Expected one of: info, low, medium, high, critical`);
}

function isSeverity(value: string): value is Severity {
  return value === "info" || value === "low" || value === "medium" || value === "high" || value === "critical";
}
