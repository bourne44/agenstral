import { readAuditRecords, verifyAuditLog } from "../audit/auditLog.js";
import { formatAuditRecords } from "../reporting/console.js";

export async function runAuditCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const path = args[1];

  if (!subcommand || !path || (subcommand !== "view" && subcommand !== "verify")) {
    throw new Error("Usage: agenstral audit <view|verify> <audit.jsonl>");
  }

  if (subcommand === "view") {
    console.log(formatAuditRecords(await readAuditRecords(path)));
    return;
  }

  const result = await verifyAuditLog(path);
  if (result.ok) {
    console.log(`OK: ${result.records} record(s) verified`);
    return;
  }

  console.error(`FAILED: ${result.records} record(s), ${result.errors.length} error(s)`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 2;
}
