import type { Severity } from "../domain/types.js";

export type ShellRiskKind = "remote-exec" | "destructive" | "unpinned-runner";

export interface ShellRisk {
  kind: ShellRiskKind;
  title: string;
  severity: Severity;
  detail: string;
  recommendation: string;
}

export function detectShellRisks(command: string): ShellRisk[] {
  const risks: ShellRisk[] = [];

  if (matchesAny(command, REMOTE_EXECUTION_PATTERNS)) {
    risks.push({
      kind: "remote-exec",
      title: "Command downloads and executes remote code",
      severity: "high",
      detail: "The command appears to pipe downloaded content into a shell or expression evaluator.",
      recommendation: "Replace remote execution with a pinned, reviewed script or package artifact."
    });
  }

  if (matchesAny(command, DESTRUCTIVE_PATTERNS)) {
    risks.push({
      kind: "destructive",
      title: "Command can destroy repository state",
      severity: "high",
      detail: "The command can erase source, history, or untracked work when run in the repository.",
      recommendation: "Move destructive cleanup behind an explicit manual step or narrow it to generated paths."
    });
  }

  if (matchesAny(command, UNPINNED_RUNNER_PATTERNS)) {
    risks.push({
      kind: "unpinned-runner",
      title: "Command uses an unpinned package runner",
      severity: "medium",
      detail: "The command executes a package runner with @latest, making behavior change over time.",
      recommendation: "Pin the package version or vendor a reviewed executable."
    });
  }

  return risks;
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

const REMOTE_EXECUTION_PATTERNS = [
  /\b(curl|wget)\b[^\r\n|;]*(\|\s*(sh|bash|zsh|pwsh|powershell)\b)/i,
  /\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\r\n|;]*(\|\s*)?(iex|Invoke-Expression)\b/i,
  /\bDownloadString\b[^\r\n|;]*(iex|Invoke-Expression)\b/i
];

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*\s+(\.|\.\/|\/|~|\$HOME)(\s|$)/i,
  /\bRemove-Item\b[^\r\n]*(\s\.|\s~|\s\$HOME|\s[A-Z]:\\)[^\r\n]*\b-Recurse\b[^\r\n]*\b-Force\b/i,
  /\bRemove-Item\b[^\r\n]*(\s\.|\s~|\s\$HOME|\s[A-Z]:\\)[^\r\n]*\b-Force\b[^\r\n]*\b-Recurse\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[A-Za-z]*f[A-Za-z]*d[A-Za-z]*\b/i,
  /\bdel\s+\/[sq][^\r\n]*(\*|\.)/i
];

const UNPINNED_RUNNER_PATTERNS = [
  /\bnpx\s+[^&|;\r\n]*@latest\b/i,
  /\bpnpm\s+dlx\s+[^&|;\r\n]*@latest\b/i,
  /\byarn\s+dlx\s+[^&|;\r\n]*@latest\b/i,
  /\bbunx\s+[^&|;\r\n]*@latest\b/i,
  /\buvx\s+[^&|;\r\n]*@latest\b/i,
  /\bpipx\s+run\s+[^&|;\r\n]*@latest\b/i
];
