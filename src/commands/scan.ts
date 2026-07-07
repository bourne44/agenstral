import { scanWorkspace } from "../scanner/discovery.js";
import { formatScanReport } from "../reporting/console.js";
import { getFlag, hasFlag } from "../utils/args.js";

export async function runScanCommand(args: string[]): Promise<void> {
  const workspace = getFlag(args, "--workspace") ?? process.cwd();
  const report = await scanWorkspace({ workspace });

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatScanReport(report));
}
