import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createEvidenceBundle, verifyEvidenceBundle } from "../bundle/evidenceBundle.js";
import { getFlag, hasFlag } from "../utils/args.js";

const USAGE = `Usage:
  agenstral bundle [create] [--workspace <path>] [--policy <policy.json>] [--audit <audit.jsonl>] [--out <bundle.json>] [--report-out <report.html>] [--no-report]
  agenstral bundle verify <bundle.json>`;

export async function runBundleCommand(args: string[]): Promise<void> {
  const subcommand = args[0] ?? "create";

  if (subcommand === "verify") {
    await verifyBundleCommand(args.slice(1));
    return;
  }

  if (subcommand === "create" || subcommand.startsWith("--")) {
    await createBundleCommand(subcommand === "create" ? args.slice(1) : args);
    return;
  }

  throw new Error(USAGE);
}

async function createBundleCommand(args: string[]): Promise<void> {
  const workspace = resolve(getFlag(args, "--workspace") ?? process.cwd());
  const output = resolve(getFlag(args, "--out") ?? join(workspace, ".agenstral", "bundle.json"));
  const reportOutput = resolve(getFlag(args, "--report-out") ?? join(workspace, ".agenstral", "report.html"));
  const auditPath = getFlag(args, "--audit");
  const policyPath = getFlag(args, "--policy");

  const bundle = await createEvidenceBundle({
    workspace,
    ...(auditPath ? { auditPath } : {}),
    ...(policyPath ? { policyPath } : {})
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`Wrote ${output}`);

  if (!hasFlag(args, "--no-report")) {
    await mkdir(dirname(reportOutput), { recursive: true });
    await writeFile(reportOutput, bundle.report.html, "utf8");
    console.log(`Wrote ${reportOutput}`);
  }

  console.log(`Bundle hash: ${bundle.integrity.bundleHash}`);
  console.log(`Audit: ${bundle.audit.verification.ok ? "verified" : "failed"} (${bundle.audit.verification.records} record(s))`);
}

async function verifyBundleCommand(args: string[]): Promise<void> {
  const path = args[0];
  if (!path) {
    throw new Error(USAGE);
  }

  const parsed = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  const verification = verifyEvidenceBundle(parsed);
  if (!verification.ok) {
    throw new Error(`Bundle verification failed:\n${verification.errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.log(`Bundle verified: ${verification.hash}`);
  console.log(`Audit: verified (${verification.audit?.records ?? 0} record(s))`);
}
