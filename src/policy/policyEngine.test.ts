import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEFAULT_POLICY } from "./defaultPolicy.js";
import { evaluatePolicy } from "./policyEngine.js";

test("allows read-only filesystem calls", () => {
  const decision = evaluatePolicy(DEFAULT_POLICY, {
    server: "filesystem",
    tool: "read_file",
    arguments: { path: "README.md" }
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.ruleId, "allow-readonly-filesystem");
});

test("denies secret-looking tool arguments", () => {
  const decision = evaluatePolicy(DEFAULT_POLICY, {
    server: "filesystem",
    tool: "write_file",
    arguments: { content: "OPENAI_API_KEY=sk-1234567890abcdef" }
  });

  assert.equal(decision.action, "deny");
  assert.equal(decision.ruleId, "block-secret-values");
});

test("denies cloud metadata service access", () => {
  const decision = evaluatePolicy(DEFAULT_POLICY, {
    server: "shell",
    tool: "run_command",
    arguments: { command: "curl http://169.254.169.254/latest/meta-data/" }
  });

  assert.equal(decision.action, "deny");
  assert.equal(decision.ruleId, "block-cloud-metadata-access");
});

test("asks on unknown calls", () => {
  const decision = evaluatePolicy(DEFAULT_POLICY, {
    server: "github",
    tool: "create_issue",
    arguments: { title: "hello" }
  });

  assert.equal(decision.action, "ask");
});
