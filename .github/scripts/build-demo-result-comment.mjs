import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readOptionalTextFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function truncateForComment(text, limit) {
  const normalized = String(text ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}\n\n> Output truncated in this comment. Download the artifact for the complete result.`
    : normalized;
}

function sanitizeMermaidLabel(text) {
  return String(text ?? "unnamed")
    .replace(/["<>{}|`]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 54);
}

function renderDependencyGraph(dependencies = []) {
  if (!dependencies.length) return "> Dependency data was unavailable. The complete graph remains in the workflow artifact.";
  const visible = dependencies.slice(0, 28);
  const ids = new Map(visible.map((node, index) => [node.id, `n${index}`]));
  const lines = ["```mermaid", "flowchart LR"];
  for (const node of visible) {
    const detail = `${node.kind === "invoke_agent" ? "Agent" : node.kind === "chat" ? "Model" : "Tool"} · ${node.calls}×`;
    lines.push(`  ${ids.get(node.id)}["${sanitizeMermaidLabel(node.name)}<br/><small>${detail}</small>"]`);
  }
  for (const node of visible) {
    if (ids.has(node.owner)) lines.push(`  ${ids.get(node.owner)} --> ${ids.get(node.id)}`);
    if (ids.has(node.dependsOn)) lines.push(`  ${ids.get(node.dependsOn)} -. next .-> ${ids.get(node.id)}`);
  }
  const failed = visible.filter((node) => node.failed).map((node) => ids.get(node.id));
  if (failed.length) lines.push(`  class ${failed.join(",")} failed`, "  classDef failed stroke:#dc3545,stroke-width:2px,color:#dc3545");
  lines.push("```");
  return lines.join("\n");
}

export function buildDemoResultComment({
  report,
  result,
  orchestratorModel,
  subagentModel,
  patternLabel,
  runUrl,
  pagesUrl,
  artifactUrl,
  mediaUrl,
}) {
  const response = truncateForComment(result, 24_000) || "_The orchestrator did not produce a result._";
  const errors = report?.signals?.errors ?? [];
  const slowEvents = report?.signals?.slow ?? [];
  const dependencyGraph = mediaUrl
    ? `![Copilot CLI trace dependency graph](${mediaUrl})`
    : renderDependencyGraph(report?.dependencies);
  const diagnosticRows = report ? [
    `| Duration | ${report.durationText} |`,
    `| Spans | ${report.counts.events} |`,
    `| Errors | ${report.counts.errors} |`,
    `| Peak parallel subagents | ${report.counts.peak} |`,
    `| Tokens | ${report.counts.inputTokens.toLocaleString()} in / ${report.counts.outputTokens.toLocaleString()} out |`,
    `| Model cost | ${report.costText} (${report.counts.costedCalls}/${report.counts.chats} model calls priced) |`,
  ].join("\n") : "| Trace report | Rendering did not complete |";
  const signalLines = [
    ...errors.map((event) => `- **Error:** \`${event.name}\` · ${event.duration}`),
    ...slowEvents.filter((event) => !errors.some((error) => error.id === event.id))
      .map((event) => `- **Slow span:** \`${event.name}\` · ${event.duration}`),
  ];
  return `<!-- copilot-agent-demo-result -->
## Copilot CLI agent demo result

**Models:** orchestrator \`${orchestratorModel}\` · subagents \`${subagentModel}\`
**Pattern:** ${patternLabel}

### Result

${response}

<details>
<summary>Trace diagnostics</summary>

| Metric | Value |
|---|---:|
${diagnosticRows}

${signalLines.length ? signalLines.join("\n") : "- No errors were recorded in the trace."}

</details>

<details>
<summary>Dependency graph</summary>

${dependencyGraph}

</details>

[Open Trace Viewer](${pagesUrl || artifactUrl || `${runUrl}#artifacts`}) · [Open workflow run](${runUrl}) · [Download HTML artifact](${artifactUrl || `${runUrl}#artifacts`})
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rawReport = readOptionalTextFile(process.env.TRACE_DATA_PATH);
  writeFileSync(process.env.COMMENT_PATH, buildDemoResultComment({
    report: rawReport ? JSON.parse(rawReport) : null,
    result: readOptionalTextFile(process.env.DEMO_RESULT_PATH),
    orchestratorModel: process.env.ORCHESTRATOR_MODEL,
    subagentModel: process.env.SUBAGENT_MODEL,
    patternLabel: process.env.PATTERN_LABEL,
    runUrl: process.env.RUN_URL,
    pagesUrl: process.env.PAGES_URL,
    artifactUrl: process.env.ARTIFACT_URL,
    mediaUrl: process.env.MEDIA_URL,
  }));
}
