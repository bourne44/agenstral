import { relative, sep } from "node:path";
import type { Finding, JsonObject, ScanReport, Severity } from "../domain/types.js";

export function renderSarifReport(report: ScanReport): JsonObject {
  const rules = Array.from(uniqueRules(report.findings).values()).sort((left, right) =>
    String(left["id"]).localeCompare(String(right["id"]))
  );

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Agenstral",
            rules
          }
        },
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: report.scannedAt,
            workingDirectory: {
              uri: pathToUri(report.workspace)
            }
          }
        ],
        results: report.findings.map((finding) => findingToResult(report, finding))
      }
    ]
  };
}

function uniqueRules(findings: Finding[]): Map<string, JsonObject> {
  const rules = new Map<string, JsonObject>();
  for (const finding of findings) {
    if (rules.has(finding.id)) {
      continue;
    }

    rules.set(finding.id, {
      id: finding.id,
      name: finding.title,
      shortDescription: {
        text: finding.title
      },
      fullDescription: {
        text: finding.detail
      },
      help: {
        text: finding.recommendation
      },
      properties: {
        severity: finding.severity
      }
    });
  }
  return rules;
}

function findingToResult(report: ScanReport, finding: Finding): JsonObject {
  const result: JsonObject = {
    ruleId: finding.id,
    level: severityToSarifLevel(finding.severity),
    message: {
      text: `${finding.title}: ${finding.detail} Recommendation: ${finding.recommendation}`
    },
    properties: {
      severity: finding.severity
    }
  };

  if (finding.location) {
    result["locations"] = [
      {
        physicalLocation: parseLocation(report.workspace, finding.location)
      }
    ];
  }

  return result;
}

function parseLocation(workspace: string, location: string): JsonObject {
  const { path, line } = splitLineSuffix(location);
  const uri = pathToUri(toWorkspaceRelativePath(workspace, stripFragment(path)));
  const physicalLocation: JsonObject = {
    artifactLocation: {
      uri
    }
  };

  if (line !== null) {
    physicalLocation["region"] = {
      startLine: line
    };
  }

  return physicalLocation;
}

function splitLineSuffix(location: string): { path: string; line: number | null } {
  const match = location.match(/^(.*):(\d+)$/);
  if (!match) {
    return {
      path: location,
      line: null
    };
  }

  return {
    path: match[1] ?? location,
    line: Number.parseInt(match[2] ?? "", 10)
  };
}

function stripFragment(path: string): string {
  return path.split("#", 1)[0] ?? path;
}

function toWorkspaceRelativePath(workspace: string, path: string): string {
  const relativePath = relative(workspace, path);
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    return path;
  }

  return relativePath;
}

function severityToSarifLevel(severity: Severity): "error" | "warning" | "note" {
  if (severity === "critical" || severity === "high") {
    return "error";
  }

  if (severity === "medium" || severity === "low") {
    return "warning";
  }

  return "note";
}

function pathToUri(path: string): string {
  return path.replaceAll("\\", "/");
}
