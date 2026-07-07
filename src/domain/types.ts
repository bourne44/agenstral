export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type PolicyAction = "allow" | "deny" | "ask";

export interface ToolCall {
  server: string;
  tool: string;
  arguments?: JsonObject;
  raw?: JsonValue;
}

export interface Policy {
  version: 1;
  defaultAction: PolicyAction;
  rules: PolicyRule[];
}

export interface PolicyRule {
  id: string;
  description?: string;
  action: PolicyAction;
  match: {
    server?: string | string[];
    tool?: string | string[];
  };
  conditions?: PolicyConditions;
}

export interface PolicyConditions {
  hasSecret?: boolean;
  anyArgumentKeyMatches?: string[];
  anyArgumentValueMatches?: string[];
  commandMatches?: string[];
  urlMatches?: string[];
  pathMatches?: string[];
}

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
  ruleId?: string;
  matchedRule?: PolicyRule;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  location?: string;
  detail: string;
  recommendation: string;
}

export interface McpServerConfig {
  name: string;
  sourceFile: string;
  command?: string;
  args: string[];
  envKeys: string[];
  url?: string;
  transport: "stdio" | "http" | "unknown";
}

export interface GuidanceFile {
  path: string;
  hasSetup: boolean;
  hasTesting: boolean;
  hasSecurity: boolean;
}

export interface ScanReport {
  scannedAt: string;
  workspace: string;
  configs: McpServerConfig[];
  guidance: GuidanceFile[];
  findings: Finding[];
}

export interface AuditEventInput {
  kind: string;
  payload: JsonValue;
}

export interface AuditRecord {
  version: 1;
  id: string;
  timestamp: string;
  kind: string;
  payload: JsonValue;
  previousHash: string | null;
  hash: string;
}

export interface AuditVerification {
  ok: boolean;
  records: number;
  errors: string[];
}
