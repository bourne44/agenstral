import type { AuditRecord, PolicyDecision, ScanReport, ToolCall } from "../domain/types.js";
import type { DoctorReport } from "../doctor/doctor.js";
import { SYSTEM_COMPONENTS } from "../systemMap.js";

export function formatDecision(call: ToolCall, decision: PolicyDecision): string {
  const lines = [
    `Decision: ${decision.action.toUpperCase()}`,
    `Tool: ${call.server}.${call.tool}`,
    `Reason: ${decision.reason}`
  ];

  if (decision.ruleId) {
    lines.push(`Rule: ${decision.ruleId}`);
  }

  return lines.join("\n");
}

export function formatScanReport(report: ScanReport): string {
  const lines = [
    "Agenstral Scan",
    `Workspace: ${report.workspace}`,
    `MCP servers: ${report.configs.length}`,
    `Guidance files: ${report.guidance.length}`,
    `Findings: ${report.findings.length}`,
    ""
  ];

  if (report.configs.length > 0) {
    lines.push("Servers:");
    for (const server of report.configs) {
      const launch = server.command ? `${server.command} ${server.args.join(" ")}`.trim() : server.url ?? "unknown";
      lines.push(`- ${server.name} [${server.transport}] ${launch}`);
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("Findings:");
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.title}`);
      lines.push(`  id: ${finding.id}`);
      if (finding.location) {
        lines.push(`  location: ${finding.location}`);
      }
      lines.push(`  detail: ${finding.detail}`);
      lines.push(`  recommendation: ${finding.recommendation}`);
    }
  }

  return lines.join("\n");
}

export function formatAuditRecords(records: AuditRecord[]): string {
  if (records.length === 0) {
    return "No audit records found.";
  }

  return records
    .map((record) => `${record.timestamp} ${record.kind} ${record.id} prev=${record.previousHash ?? "none"} hash=${record.hash.slice(0, 12)}`)
    .join("\n");
}

export function formatSystemMap(): string {
  const lines = ["Agenstral Component Map", ""];

  for (const component of SYSTEM_COMPONENTS) {
    lines.push(`- ${component.name}: ${component.purpose}`);
    lines.push(`  owns: ${component.owns.join(", ")}`);
  }

  return lines.join("\n");
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    "Agenstral Doctor",
    `Workspace: ${report.workspace}`,
    `Checks: pass=${report.summary.pass}, warn=${report.summary.warn}, fail=${report.summary.fail}`,
    ""
  ];

  for (const check of report.checks) {
    lines.push(`- [${check.status}] ${check.title}`);
    lines.push(`  id: ${check.id}`);
    lines.push(`  detail: ${check.detail}`);
    if (check.recommendation) {
      lines.push(`  recommendation: ${check.recommendation}`);
    }
  }

  return lines.join("\n");
}
