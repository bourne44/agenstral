import type { JsonValue } from "../domain/types.js";

export interface SecretMatch {
  type: string;
  preview: string;
}

const SECRET_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { type: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g },
  { type: "huggingface-token", pattern: /\bhf_[A-Za-z0-9]{16,}\b/g },
  { type: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g },
  { type: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    type: "generic-secret-assignment",
    pattern: /\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/gi
  }
];

export function detectSecrets(value: JsonValue | string): SecretMatch[] {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const matches: SecretMatch[] = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];

  for (const { type, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (!match[0]) {
        continue;
      }
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (occupiedRanges.some((range) => rangesOverlap(range, { start, end }))) {
        continue;
      }
      occupiedRanges.push({ start, end });
      matches.push({ type, preview: previewSecret(match[0]) });
    }
  }

  return matches;
}

export function hasSecret(value: JsonValue | string): boolean {
  return detectSecrets(value).length > 0;
}

export function redactSecrets(value: JsonValue): JsonValue {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (value !== null && typeof value === "object") {
    const redacted: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = redactSecrets(nested);
    }
    return redacted;
  }

  return value;
}

export function redactText(text: string): string {
  let redacted = text;

  for (const { type, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, `[REDACTED:${type}]`);
  }

  return redacted;
}

function previewSecret(secret: string): string {
  if (secret.length <= 8) {
    return "***";
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function rangesOverlap(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end;
}
