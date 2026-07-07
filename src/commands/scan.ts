import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ScanReport, Severity } from "../domain/types.js";
import { formatScanReport } from "../reporting/console.js";
import { renderSarifReport } from "../reporting/sarif.js";
import { scanWorkspace } from "../scanner/discovery.js";
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
  const outputPath = getFlag(args, "--out");
  const outputMode = parseOutputMode(args);
  const report = await scanWorkspace({ workspace });
  const output = renderScanOutput(report, outputMode);

  if (outputPath) {
    const resolved = resolve(outputPath);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, output, "utf8");
    console.log(`Wrote ${resolved}`);
  } else {
    console.log(output);
  }

  if (failOn && hasFindingAtOrAbove(report, failOn)) {
    const matching = report.findings.filter((finding) => severityAtLeast(finding.severity, failOn));
    console.error(`agenstral: scan failed because ${matching.length} finding(s) are ${failOn} or higher`);
    process.exitCode = 2;
  }
}

type ScanOutputMode = "text" | "json" | "sarif";

function parseOutputMode(args: string[]): ScanOutputMode {
  const json = hasFlag(args, "--json");
  const sarif = hasFlag(args, "--sarif");
  if (json && sarif) {
    throw new Error("Use only one scan output format: --json or --sarif");
  }

  if (json) {
    return "json";
  }

  if (sarif) {
    return "sarif";
  }

  return "text";
}

function renderScanOutput(report: ScanReport, mode: ScanOutputMode): string {
  if (mode === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (mode === "sarif") {
    return `${JSON.stringify(renderSarifReport(report), null, 2)}\n`;
  }

  return formatScanReport(report);
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
