import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { publishTraceSite } from "./publish-trace-site.mjs";

test("publishes artifact data for the shared trace site", () => {
  const root = mkdtempSync(join(tmpdir(), "trace-pages-"));
  const report = join(root, "report");
  const pages = join(root, "pages");
  try {
    mkdirSync(report);
    const data = {
      schemaVersion: 1,
      pattern: "parallel-delegation",
      durationText: "12.30 s",
      costText: "$0.123000",
      includeMessages: false,
      events: [{ id: "root", kind: "invoke_agent", name: "Orchestrator", start: 0, end: 1 }],
      timeRange: { start: 0, end: 1 },
      counts: { errors: 1, peak: 2 },
      costBreakdown: { byAgent: [], byModel: [] },
    };
    writeFileSync(join(report, "trace-data.json"), JSON.stringify(data));
    const result = publishTraceSite({
      reportDirectory: report,
      pagesDirectory: pages,
      sourceDirectory: resolve("."),
      metadata: {
        runId: "123",
        title: "Parallel storage comparison",
        createdAt: "2026-09-25T03:00:00Z",
        runUrl: "https://github.com/example/repo/actions/runs/123",
      },
    });
    assert.equal(result.count, 1);
    assert.deepEqual(JSON.parse(readFileSync(join(pages, "traces", "123.json"), "utf8")), data);
    assert.match(readFileSync(join(pages, "viewer", "index.html"), "utf8"), /Loading Trace Viewer/);
    assert.match(readFileSync(join(pages, "viewer", "app.mjs"), "utf8"), /renderHtml\(model\)/);
    assert.match(readFileSync(join(pages, "viewer", "html-renderer.mjs"), "utf8"), /export function renderHtml/);
    const index = readFileSync(join(pages, "index.html"), "utf8");
    assert.match(index, /Copilot CLI Trace Reports/);
    assert.match(index, /href="\.\/viewer\/\?run=123"/);
    assert.match(index, /Parallel storage comparison/);
    assert.equal(readFileSync(join(pages, ".nojekyll"), "utf8"), "");
    assert.throws(() => publishTraceSite({
      reportDirectory: report,
      pagesDirectory: pages,
      sourceDirectory: resolve("."),
      metadata: {
        runId: "../bad",
        title: "Bad",
        createdAt: "2026-09-25T03:00:00Z",
        runUrl: "https://github.com/example/repo/actions/runs/1",
      },
    }), /RUN_ID must be numeric/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
