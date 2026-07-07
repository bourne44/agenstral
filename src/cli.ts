#!/usr/bin/env node
import { runAuditCommand } from "./commands/audit.js";
import { runCheckCommand } from "./commands/check.js";
import { runMapCommand } from "./commands/map.js";
import { runPolicyCommand } from "./commands/policy.js";
import { runProxyCommand } from "./commands/proxy.js";
import { runReportCommand } from "./commands/report.js";
import { runShellCommand } from "./commands/run.js";
import { runScanCommand } from "./commands/scan.js";
import { runStateCommand } from "./commands/state.js";

const HELP = `Agenstral

Usage:
  agenstral scan [--workspace <path>] [--json]
  agenstral policy init [--force]
  agenstral check --call <tool-call.json> [--policy <policy.json>] [--audit <audit.jsonl>]
  agenstral run [--approve-ask] [--policy <policy.json>] [--audit <audit.jsonl>] -- <command> [args...]
  agenstral proxy --name <server> [--policy <policy.json>] [--audit <audit.jsonl>] -- <command> [args...]
  agenstral audit view <audit.jsonl>
  agenstral audit verify <audit.jsonl>
  agenstral map
  agenstral report [--workspace <path>] [--audit <audit.jsonl>] [--out <report.html>]
  agenstral state [--workspace <path>] [--json]
`;

async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  const args = argv.slice(1);

  switch (command) {
    case "scan":
      await runScanCommand(args);
      return;
    case "policy":
      await runPolicyCommand(args);
      return;
    case "check":
      await runCheckCommand(args);
      return;
    case "proxy":
      await runProxyCommand(args);
      return;
    case "run":
      await runShellCommand(args);
      return;
    case "audit":
      await runAuditCommand(args);
      return;
    case "map":
      await runMapCommand();
      return;
    case "report":
      await runReportCommand(args);
      return;
    case "state":
      await runStateCommand(args);
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      return;
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agenstral: ${message}`);
  process.exitCode = 1;
});
