import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTraceModel, loadSpans, redact } from "./trace-model.mjs";
import { renderDependencyGraph, renderHtml } from "./html-renderer.mjs";

export { loadSpans, renderDependencyGraph, renderHtml };

export function buildTraceReport(spans, options) {
  return buildTraceModel(spans, options);
}

export function renderTraceSummary(spans) {
  return buildTraceModel(spans).summary;
}

export function buildTraceData(result) {
  const sortedByDuration = [...result.events].sort((left, right) =>
    (right.end - right.start) - (left.end - left.start));
  const dependencyNodes = new Map();
  for (const event of result.events) {
    const id = event.kind === "invoke_agent" ? event.id : `${event.owner ?? "root"}:${event.kind}:${event.name}`;
    const existing = dependencyNodes.get(id);
    if (existing) {
      existing.calls++;
      existing.failed ||= event.failed;
    } else {
      dependencyNodes.set(id, {
        id,
        owner: event.owner,
        kind: event.kind,
        name: event.patternRole ? `${event.patternRole} · ${event.name}` : event.name,
        dependsOn: event.dependsOn,
        calls: 1,
        failed: event.failed,
      });
    }
  }
  return {
    schemaVersion: 1,
    ...result,
    durationText: result.duration < 1000
      ? `${Math.round(result.duration)} ms`
      : `${(result.duration / 1000).toFixed(2)} s`,
    costText: result.counts.totalCost == null ? "unavailable" : `$${result.counts.totalCost.toFixed(6)}`,
    counts: {
      ...result.counts,
      events: result.events.length,
      errors: result.events.filter((event) => event.failed).length,
    },
    signals: {
      errors: result.events.filter((event) => event.failed).map((event) => ({
        id: event.id,
        name: event.name,
        duration: `${Math.max(0, event.end - event.start).toLocaleString()} ms`,
        reason: event.errorReason,
      })),
      slow: sortedByDuration.slice(0, 3).map((event) => ({
        id: event.id,
        name: event.name,
        duration: `${Math.max(0, event.end - event.start).toLocaleString()} ms`,
      })),
    },
    dependencies: [...dependencyNodes.values()],
  };
}

function safeError(text, limit = 280) {
  return (redact(String(text)) ?? "").replace(/[^a-zA-Z0-9 _,./:+;=()[\]-]/g, "").slice(0, limit);
}

function configuredPricingCatalog() {
  if (!process.env.PRICING_PATH) return undefined;
  const catalog = JSON.parse(readFileSync(process.env.PRICING_PATH, "utf8"));
  if (!catalog || typeof catalog !== "object" || !Object.keys(catalog.models ?? catalog).length) {
    throw new Error("Pricing catalog is empty or invalid");
  }
  return catalog;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = buildTraceModel(loadSpans(readFileSync(process.argv[2], "utf8")), {
      includeMessages: process.env.TRACE_INCLUDE_MESSAGES === "true",
      expectedModel: process.env.REQUIRE_MODEL || null,
      pattern: process.env.TRACE_PATTERN || null,
      pricingCatalog: configuredPricingCatalog(),
    });
    if (process.env.TRACE_HTML_PATH) {
      mkdirSync(dirname(process.env.TRACE_HTML_PATH), { recursive: true });
      writeFileSync(process.env.TRACE_HTML_PATH, renderHtml(result));
    }
    if (process.env.TRACE_DATA_PATH) {
      mkdirSync(dirname(process.env.TRACE_DATA_PATH), { recursive: true });
      writeFileSync(process.env.TRACE_DATA_PATH, JSON.stringify(buildTraceData(result), null, 2));
    }
    const artifactLink = process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `\n[Download the HTML trace viewer](https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}#artifacts)\n`
      : "";
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary + artifactLink);
    console.log(result.summary + artifactLink);
    if (process.env.REQUIRE_MODEL && !result.modelMatches) {
      console.error("Required model evidence missing: observed model calls did not satisfy require-model.");
      process.exitCode = 1;
    }
    if (process.env.REQUIRE_PATTERN_EVIDENCE && process.env.REQUIRE_PATTERN_EVIDENCE !== "false"
      && (!result.complete || (result.includeMessages && !result.messageCount))) {
      console.error("Pattern evidence missing: the selected orchestration topology or requested message payloads were not observed.");
      process.exitCode = 1;
    }
  } catch (error) {
    const message = `## Copilot CLI invocation chain\n\nTrace rendering failed: ${safeError(error.message)}\n`;
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
    console.error(message);
    process.exitCode = 1;
  }
}
