import { strict as assert } from "node:assert";
import { test } from "node:test";
import { detectSecrets, hasSecret, redactSecrets, redactText } from "./detect.js";

test("detects common secret-looking values", () => {
  const matches = detectSecrets("token = ghp_1234567890abcdefghijklmnop");
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.type, "github-token");
});

test("redacts nested JSON values", () => {
  const value = redactSecrets({
    env: {
      OPENAI_API_KEY: "sk-1234567890abcdef"
    }
  });

  assert.deepEqual(value, {
    env: {
      OPENAI_API_KEY: "[REDACTED:openai-key]"
    }
  });
});

test("checks text for secret-looking values", () => {
  assert.equal(hasSecret("AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF"), true);
  assert.equal(redactText("AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF"), "AWS_ACCESS_KEY_ID=[REDACTED:aws-access-key]");
});
