import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { publishPresentationSite } from "./publish-presentation-site.mjs";

test("publishes the presentation and preserves an existing site index", () => {
  const root = mkdtempSync(join(tmpdir(), "presentation-pages-"));
  const pages = join(root, "pages");
  try {
    writeFileSync(join(root, "placeholder"), "");
    publishPresentationSite({ sourceDirectory: ".", pagesDirectory: pages });
    assert.ok(existsSync(join(pages, "docs", "presentation", "index.html")));
    assert.ok(existsSync(join(pages, "docs", "cases", "README.md")));
    assert.ok(existsSync(join(pages, "tools", "trace-viewer", "web", "index.html")));
    assert.ok(existsSync(join(pages, "demos", "meeting-room-booking", "docs", "method-comparison-2026-10-20.md")));
    assert.match(readFileSync(join(pages, "index.html"), "utf8"), /docs\/presentation/);

    writeFileSync(join(pages, "index.html"), "existing trace index");
    publishPresentationSite({ sourceDirectory: ".", pagesDirectory: pages });
    assert.equal(readFileSync(join(pages, "index.html"), "utf8"), "existing trace index");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
