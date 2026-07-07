export interface SystemComponent {
  name: string;
  purpose: string;
  owns: string[];
}

export const SYSTEM_COMPONENTS: SystemComponent[] = [
  {
    name: "CLI",
    purpose: "Command parsing, process exit boundaries, and user output.",
    owns: ["src/cli.ts", "src/commands/*"]
  },
  {
    name: "Policy",
    purpose: "Deterministic allow, deny, or ask decisions for tool calls.",
    owns: ["src/policy/defaultPolicy.ts", "src/policy/loadPolicy.ts", "src/policy/policyEngine.ts"]
  },
  {
    name: "Audit",
    purpose: "Tamper-evident JSONL event records with local verification.",
    owns: ["src/audit/auditLog.ts", "src/utils/canonicalJson.ts"]
  },
  {
    name: "Scanner",
    purpose: "Local discovery of MCP configs, agent guidance, package scripts, workflows, and risky settings.",
    owns: ["src/scanner/discovery.ts", "src/scanner/packageScripts.ts", "src/scanner/githubActions.ts", "src/scanner/shellRisk.ts"]
  },
  {
    name: "Proxy",
    purpose: "Runtime mediation before tool calls or shell commands execute.",
    owns: ["src/proxy/stdioProxy.ts", "src/commands/run.ts"]
  },
  {
    name: "Secrets",
    purpose: "Secret-looking value detection and redaction.",
    owns: ["src/secrets/detect.ts"]
  },
  {
    name: "Reporting",
    purpose: "Stable human-readable output for scans, decisions, audit, reports, and maps.",
    owns: ["src/reporting/console.ts", "src/reporting/htmlReport.ts", "src/commands/report.ts"]
  },
  {
    name: "Bundle",
    purpose: "Portable evidence snapshots for fast handoff, audit verification, and backtracking.",
    owns: ["src/bundle/evidenceBundle.ts", "src/commands/bundle.ts"]
  }
];
