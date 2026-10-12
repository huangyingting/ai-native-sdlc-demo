import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export function dependencyGraphViewport(html, padding = 24) {
  const match = String(html).match(
    /<svg id="dependency-graph"[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/,
  );
  if (!match) throw new Error("Dependency graph dimensions were not found in the HTML report");
  return {
    width: Number(match[1]) + padding,
    height: Number(match[2]) + padding,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [htmlPath, outputPath] = process.argv.slice(2);
  if (!htmlPath || !outputPath) {
    throw new Error("Usage: capture-dependency-graph.mjs <trace-report.html> <dependency-graph.png>");
  }
  const { width, height } = dependencyGraphViewport(readFileSync(htmlPath, "utf8"));
  const url = pathToFileURL(resolve(htmlPath));
  url.searchParams.set("tab", "dependencies");
  url.searchParams.set("capture", "graph");
  const result = spawnSync(process.env.CHROME_BIN || "google-chrome", [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    `--window-size=${width},${height}`,
    `--screenshot=${resolve(outputPath)}`,
    url.href,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Chrome exited with status ${result.status}`);
}
