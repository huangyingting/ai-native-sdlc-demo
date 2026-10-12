import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function requireText(value, name) {
  if (!String(value ?? "").trim()) throw new Error(`${name} is required`);
  return String(value).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateTraceData(data) {
  if (data?.schemaVersion !== 1) throw new Error("Unsupported trace data schema");
  if (!Array.isArray(data.events) || !data.events.length) throw new Error("Trace data has no events");
  if (!data.timeRange || !data.counts || !data.costBreakdown) throw new Error("Trace data is incomplete");
}

function renderSiteIndex(entries) {
  const rows = entries.map((entry) => `<a class="run" href="./viewer/?run=${entry.runId}">
    <div><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.pattern || "Copilot CLI trace")}</span></div>
    <div class="metrics"><span>${escapeHtml(entry.durationText || "—")}</span><span>${entry.errors} errors</span><span>${entry.peak} peak</span><span>${escapeHtml(entry.costText || "—")}</span></div>
    <time datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(entry.createdAt.replace("T", " ").replace("Z", " UTC"))}</time>
  </a>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Copilot CLI Trace Reports</title>
<style>
:root{color-scheme:light dark;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fb;color:#18202b}*{box-sizing:border-box}body{max-width:1040px;margin:0 auto;padding:40px 24px}header{margin-bottom:24px}h1{margin:0;font-size:24px}p{margin:7px 0 0;color:#667085}.runs{display:grid;gap:8px}.run{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:24px;padding:14px 16px;border:1px solid #dfe4ec;border-radius:10px;background:#fff;color:inherit;text-decoration:none}.run:hover{border-color:#2563eb}.run div:first-child{min-width:0}.run strong,.run span{display:block}.run strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.run div:first-child span,time{margin-top:3px;color:#667085;font-size:12px}.metrics{display:flex;gap:18px;color:#667085;font-size:12px}.metrics span:last-child{color:#b7791f}time{white-space:nowrap}@media(max-width:760px){body{padding:24px 14px}.run{grid-template-columns:1fr;gap:8px}.metrics{flex-wrap:wrap}time{margin:0}}@media(prefers-color-scheme:dark){:root{background:#0b0f17;color:#edf2f7}.run{border-color:#263142;background:#111722}.run div:first-child span,time,.metrics{color:#9aa7b8}}
</style>
</head>
<body>
<header><h1>Copilot CLI Trace Reports</h1><p>Interactive reports rendered from redacted workflow artifacts.</p></header>
<main class="runs">${rows || "<p>No trace reports have been published yet.</p>"}</main>
</body>
</html>`;
}

export function publishTraceSite({ reportDirectory, pagesDirectory, sourceDirectory, metadata }) {
  const runId = requireText(metadata.runId, "RUN_ID");
  if (!/^\d+$/.test(runId)) throw new Error("RUN_ID must be numeric");
  const reportPath = join(resolve(reportDirectory), "trace-data.json");
  const data = readJson(reportPath);
  validateTraceData(data);

  const pagesRoot = resolve(pagesDirectory);
  const tracesDirectory = join(pagesRoot, "traces");
  const metadataDirectory = join(pagesRoot, "metadata");
  const viewerDirectory = join(pagesRoot, "viewer");
  mkdirSync(tracesDirectory, { recursive: true });
  mkdirSync(metadataDirectory, { recursive: true });
  mkdirSync(viewerDirectory, { recursive: true });
  copyFileSync(reportPath, join(tracesDirectory, `${runId}.json`));
  copyFileSync(join(resolve(sourceDirectory), "tools", "trace-viewer", "web", "index.html"), join(viewerDirectory, "index.html"));
  copyFileSync(join(resolve(sourceDirectory), "tools", "trace-viewer", "web", "app.mjs"), join(viewerDirectory, "app.mjs"));
  copyFileSync(join(resolve(sourceDirectory), "tools", "trace-viewer", "html-renderer.mjs"), join(viewerDirectory, "html-renderer.mjs"));

  const entry = {
    runId,
    title: requireText(metadata.title, "RUN_TITLE"),
    createdAt: requireText(metadata.createdAt, "RUN_CREATED_AT"),
    runUrl: requireText(metadata.runUrl, "RUN_URL"),
    pattern: data.pattern || "",
    durationText: data.durationText || "",
    errors: data.counts.errors ?? 0,
    peak: data.counts.peak ?? 0,
    costText: data.costText || "",
    includeMessages: Boolean(data.includeMessages),
  };
  writeFileSync(join(metadataDirectory, `${runId}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  const entries = readdirSync(metadataDirectory)
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => readJson(join(metadataDirectory, name)))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  writeFileSync(join(pagesRoot, "index.html"), renderSiteIndex(entries));
  writeFileSync(join(pagesRoot, ".nojekyll"), "");
  return { entry, count: entries.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [reportDirectory, pagesDirectory, sourceDirectory] = process.argv.slice(2);
  if (!reportDirectory || !pagesDirectory || !sourceDirectory) {
    throw new Error("Usage: publish-trace-site.mjs <report-directory> <pages-directory> <source-directory>");
  }
  const result = publishTraceSite({
    reportDirectory,
    pagesDirectory,
    sourceDirectory,
    metadata: {
      runId: process.env.RUN_ID,
      title: process.env.RUN_TITLE,
      createdAt: process.env.RUN_CREATED_AT,
      runUrl: process.env.RUN_URL,
    },
  });
  process.stdout.write(`Published run ${result.entry.runId}; ${result.count} run(s) indexed.\n`);
}
