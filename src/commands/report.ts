import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { readAuditRecords, verifyAuditLog } from "../audit/auditLog.js";
import { renderHtmlReport } from "../reporting/htmlReport.js";
import { scanWorkspace } from "../scanner/discovery.js";
import { getFlag } from "../utils/args.js";

const execFileAsync = promisify(execFile);

export async function runReportCommand(args: string[]): Promise<void> {
  const workspace = resolve(getFlag(args, "--workspace") ?? process.cwd());
  const output = resolve(getFlag(args, "--out") ?? join(workspace, ".agenstral", "report.html"));
  const auditPath = getFlag(args, "--audit") ?? join(workspace, ".agenstral", "audit.jsonl");
  const scan = await scanWorkspace({ workspace });
  const [records, verification, git] = await Promise.all([
    readAuditRecords(auditPath),
    verifyAuditLog(auditPath),
    readGitSummary(workspace)
  ]);

  const html = renderHtmlReport({
    generatedAt: new Date().toISOString(),
    scan,
    audit: {
      records,
      verification
    },
    git
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  console.log(`Wrote ${output}`);
}

async function readGitSummary(workspace: string): Promise<{ changedFiles: number; head: string | null }> {
  try {
    const [{ stdout: status }, { stdout: head }] = await Promise.all([
      execFileAsync("git", ["status", "--short"], { cwd: workspace }),
      execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: workspace })
    ]);
    return {
      changedFiles: status.split(/\r?\n/).filter(Boolean).length,
      head: head.trim() || null
    };
  } catch {
    return {
      changedFiles: 0,
      head: null
    };
  }
}
