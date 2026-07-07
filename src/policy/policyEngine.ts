import type { JsonValue, Policy, PolicyConditions, PolicyDecision, PolicyRule, ToolCall } from "../domain/types.js";
import { hasSecret } from "../secrets/detect.js";

export function evaluatePolicy(policy: Policy, call: ToolCall): PolicyDecision {
  for (const rule of policy.rules) {
    if (!matchesSelector(rule.match.server, call.server) || !matchesSelector(rule.match.tool, call.tool)) {
      continue;
    }

    if (!conditionsMatch(rule.conditions, call)) {
      continue;
    }

    return {
      action: rule.action,
      ruleId: rule.id,
      matchedRule: rule,
      reason: rule.description ?? `Matched rule ${rule.id}`
    };
  }

  return {
    action: policy.defaultAction,
    reason: `No rule matched. Default action is ${policy.defaultAction}.`
  };
}

function matchesSelector(selector: string | string[] | undefined, value: string): boolean {
  if (selector === undefined) {
    return true;
  }

  const selectors = Array.isArray(selector) ? selector : [selector];
  return selectors.some((item) => item === "*" || item === value);
}

function conditionsMatch(conditions: PolicyConditions | undefined, call: ToolCall): boolean {
  if (conditions === undefined) {
    return true;
  }

  const args = call.arguments ?? {};
  const flattened = flattenJson(args);
  const allValues = flattened.map((item) => String(item.value));

  if (conditions.hasSecret !== undefined && hasSecret(args) !== conditions.hasSecret) {
    return false;
  }

  if (conditions.anyArgumentKeyMatches && !anyRegexMatches(conditions.anyArgumentKeyMatches, flattened.map((item) => item.path))) {
    return false;
  }

  if (conditions.anyArgumentValueMatches && !anyRegexMatches(conditions.anyArgumentValueMatches, allValues)) {
    return false;
  }

  if (conditions.commandMatches && !anyRegexMatches(conditions.commandMatches, commandLikeValues(flattened))) {
    return false;
  }

  if (conditions.urlMatches && !anyRegexMatches(conditions.urlMatches, allValues.filter(looksLikeUrl))) {
    return false;
  }

  if (conditions.pathMatches && !anyRegexMatches(conditions.pathMatches, pathLikeValues(flattened))) {
    return false;
  }

  return true;
}

function flattenJson(value: JsonValue, path = "$"): Array<{ path: string; value: JsonValue }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJson(item, `${path}[${index}]`));
  }

  if (value !== null && typeof value === "object") {
    const entries: Array<{ path: string; value: JsonValue }> = [];
    for (const [key, nested] of Object.entries(value)) {
      entries.push(...flattenJson(nested, `${path}.${key}`));
    }
    return entries;
  }

  return [{ path, value }];
}

function anyRegexMatches(patterns: string[], values: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern, "i");
    return values.some((value) => regex.test(value));
  });
}

function commandLikeValues(flattened: Array<{ path: string; value: JsonValue }>): string[] {
  return flattened
    .filter((item) => /command|cmd|script|shell/i.test(item.path))
    .map((item) => String(item.value));
}

function pathLikeValues(flattened: Array<{ path: string; value: JsonValue }>): string[] {
  return flattened
    .filter((item) => /path|file|dir|directory/i.test(item.path))
    .map((item) => String(item.value));
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
