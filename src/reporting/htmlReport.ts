import type { AuditRecord, AuditVerification, ScanReport, Severity } from "../domain/types.js";
import { SYSTEM_COMPONENTS } from "../systemMap.js";

export interface HtmlReportInput {
  generatedAt: string;
  scan: ScanReport;
  audit: {
    verification: AuditVerification;
    records: AuditRecord[];
  };
  git: {
    changedFiles: number;
    head: string | null;
  };
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function renderHtmlReport(input: HtmlReportInput): string {
  const findingsBySeverity = summarizeFindings(input.scan);
  const auditStatus = input.audit.verification.ok ? "verified" : "failed";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agenstral Report</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f8fafc;
      --fg: #111827;
      --muted: #64748b;
      --panel: #ffffff;
      --line: #dbe3ee;
      --accent: #0f766e;
      --danger: #b91c1c;
      --warn: #b45309;
      --ok: #15803d;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b1020;
        --fg: #e5e7eb;
        --muted: #9ca3af;
        --panel: #111827;
        --line: #243244;
        --accent: #2dd4bf;
        --danger: #f87171;
        --warn: #fbbf24;
        --ok: #4ade80;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    header {
      margin-bottom: 28px;
    }
    h1, h2, h3 {
      margin: 0;
      line-height: 1.2;
    }
    h1 {
      font-size: 28px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 18px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 14px;
      margin-bottom: 6px;
    }
    .muted { color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 20px 0 28px;
    }
    .metric, section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .metric strong {
      display: block;
      font-size: 24px;
      margin-bottom: 2px;
    }
    section {
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-weight: 600;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      word-break: break-word;
    }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 12px;
      border: 1px solid var(--line);
    }
    .critical, .high { color: var(--danger); }
    .medium { color: var(--warn); }
    .verified, .ok { color: var(--ok); }
    .timeline {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .timeline li {
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
    }
    .timeline li:last-child, tr:last-child td { border-bottom: 0; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Agenstral Report</h1>
      <p class="muted">Generated ${escapeHtml(input.generatedAt)} for <code>${escapeHtml(input.scan.workspace)}</code></p>
    </header>

    <div class="grid">
      <div class="metric"><strong>${input.scan.configs.length}</strong><span>MCP servers</span></div>
      <div class="metric"><strong>${input.scan.findings.length}</strong><span>findings</span></div>
      <div class="metric"><strong>${input.audit.records.length}</strong><span>audit records</span></div>
      <div class="metric"><strong class="${input.audit.verification.ok ? "verified" : "critical"}">${escapeHtml(auditStatus)}</strong><span>audit chain</span></div>
      <div class="metric"><strong>${input.git.changedFiles}</strong><span>Git changed files</span></div>
    </div>

    <section>
      <h2>Finding Summary</h2>
      <table>
        <thead><tr><th>Severity</th><th>Count</th></tr></thead>
        <tbody>
          ${SEVERITIES.map((severity) => `<tr><td class="${severity}">${severity}</td><td>${findingsBySeverity[severity]}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Findings</h2>
      ${renderFindings(input.scan)}
    </section>

    <section>
      <h2>Audit Timeline</h2>
      ${renderAudit(input.audit.records)}
    </section>

    <section>
      <h2>System Map</h2>
      <table>
        <thead><tr><th>Component</th><th>Purpose</th><th>Owns</th></tr></thead>
        <tbody>
          ${SYSTEM_COMPONENTS.map((component) => `<tr><td>${escapeHtml(component.name)}</td><td>${escapeHtml(component.purpose)}</td><td><code>${escapeHtml(component.owns.join(", "))}</code></td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Git</h2>
      <p>HEAD: <code>${escapeHtml(input.git.head ?? "unknown")}</code></p>
      <p>Changed files: ${input.git.changedFiles}</p>
    </section>
  </main>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeFindings(scan: ScanReport): Record<Severity, number> {
  const summary: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const finding of scan.findings) {
    summary[finding.severity] += 1;
  }

  return summary;
}

function renderFindings(scan: ScanReport): string {
  if (scan.findings.length === 0) {
    return '<p class="ok">No findings.</p>';
  }

  return `<table>
    <thead><tr><th>Severity</th><th>Title</th><th>Location</th><th>Recommendation</th></tr></thead>
    <tbody>
      ${scan.findings.map((finding) => `<tr>
        <td class="${finding.severity}">${escapeHtml(finding.severity)}</td>
        <td>${escapeHtml(finding.title)}<br><span class="muted">${escapeHtml(finding.detail)}</span></td>
        <td><code>${escapeHtml(finding.location ?? "")}</code></td>
        <td>${escapeHtml(finding.recommendation)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderAudit(records: AuditRecord[]): string {
  if (records.length === 0) {
    return '<p class="muted">No audit records yet.</p>';
  }

  return `<ul class="timeline">
    ${records.map((record) => `<li>
      <h3>${escapeHtml(record.kind)} <span class="pill">${escapeHtml(record.hash.slice(0, 12))}</span></h3>
      <div class="muted">${escapeHtml(record.timestamp)} - ${escapeHtml(record.id)}</div>
      <code>prev=${escapeHtml(record.previousHash ?? "none")}</code>
    </li>`).join("")}
  </ul>`;
}
