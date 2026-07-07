import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding, JsonValue } from "../domain/types.js";
import { detectSecrets } from "../secrets/detect.js";
import { isJsonObject } from "../utils/jsonFile.js";
import { detectShellRisks } from "./shellRisk.js";

export async function scanPackageScripts(workspace: string, findings: Finding[]): Promise<void> {
  const packagePath = join(workspace, "package.json");
  if (!(await exists(packagePath))) {
    return;
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(await readFile(packagePath, "utf8")) as JsonValue;
  } catch (error) {
    findings.push({
      id: "package.json.invalid-json",
      title: "Invalid package manifest JSON",
      severity: "medium",
      location: packagePath,
      detail: error instanceof Error ? error.message : "Unable to parse package.json.",
      recommendation: "Fix package.json before relying on package-script safety checks."
    });
    return;
  }

  if (!isJsonObject(parsed) || !isJsonObject(parsed["scripts"])) {
    return;
  }

  for (const [name, script] of Object.entries(parsed["scripts"])) {
    if (typeof script !== "string") {
      continue;
    }

    inspectPackageScript(packagePath, name, script, findings);
  }
}

function inspectPackageScript(packagePath: string, name: string, script: string, findings: Finding[]): void {
  const location = `${packagePath}#scripts.${name}`;
  const secretMatches = detectSecrets(script);
  if (secretMatches.length > 0) {
    findings.push({
      id: "package.script.secret",
      title: "Secret-looking value in package script",
      severity: "critical",
      location,
      detail: `Script "${name}" contains ${secretMatches.map((match) => match.type).join(", ")}.`,
      recommendation: "Move secrets out of package scripts and rotate any exposed credentials."
    });
  }

  for (const risk of detectShellRisks(script)) {
    findings.push({
      id: `package.script.${risk.kind}`,
      title: risk.title,
      severity: risk.severity,
      location,
      detail: `Script "${name}": ${risk.detail}`,
      recommendation: risk.recommendation
    });
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
