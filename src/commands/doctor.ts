import { resolve } from "node:path";
import { runDoctor, type DoctorReport, type DoctorStatus } from "../doctor/doctor.js";
import { formatDoctorReport } from "../reporting/console.js";
import { getFlag, hasFlag } from "../utils/args.js";

const STATUS_RANK: Record<DoctorStatus, number> = {
  pass: 0,
  warn: 1,
  fail: 2
};

export async function runDoctorCommand(args: string[]): Promise<void> {
  const workspace = resolve(getFlag(args, "--workspace") ?? process.cwd());
  const failOn = parseFailOn(getFlag(args, "--fail-on"));
  const report = await runDoctor({ workspace });

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatDoctorReport(report));
  }

  if (failOn && hasStatusAtOrAbove(report, failOn)) {
    const count = countAtOrAbove(report, failOn);
    console.error(`agenstral: doctor failed because ${count} check(s) are ${failOn} or worse`);
    process.exitCode = 2;
  }
}

export function hasStatusAtOrAbove(report: DoctorReport, threshold: DoctorStatus): boolean {
  return report.checks.some((check) => STATUS_RANK[check.status] >= STATUS_RANK[threshold]);
}

function countAtOrAbove(report: DoctorReport, threshold: DoctorStatus): number {
  return report.checks.filter((check) => STATUS_RANK[check.status] >= STATUS_RANK[threshold]).length;
}

function parseFailOn(value: string | undefined): DoctorStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === "warn" || normalized === "fail") {
    return normalized;
  }

  throw new Error(`Invalid --fail-on status: ${value}. Expected one of: warn, fail`);
}
