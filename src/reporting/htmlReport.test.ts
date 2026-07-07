import { strict as assert } from "node:assert";
import { test } from "node:test";
import { escapeHtml, renderHtmlReport } from "./htmlReport.js";

test("escapes html content", () => {
  assert.equal(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
});

test("renders a minimal report", () => {
  const html = renderHtmlReport({
    generatedAt: "2026-07-07T00:00:00.000Z",
    scan: {
      scannedAt: "2026-07-07T00:00:00.000Z",
      workspace: "C:/repo",
      configs: [],
      guidance: [],
      findings: []
    },
    audit: {
      records: [],
      verification: {
        ok: true,
        records: 0,
        errors: []
      }
    },
    git: {
      changedFiles: 0,
      head: "abc123"
    }
  });

  assert.match(html, /Agenstral Report/);
  assert.match(html, /No findings/);
  assert.match(html, /abc123/);
});
