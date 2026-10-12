import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildDemoResultComment } from "./build-demo-result-comment.mjs";

test("builds an issue comment with a result, diagnostics, and a dependency graph", () => {
  const comment = buildDemoResultComment({
    orchestratorModel: "gpt-6-luna",
    subagentModel: "claude-sonnet-4.6",
    patternLabel: "Parallel delegation",
    result: "S3 and Blob Storage differ in lifecycle semantics.",
    runUrl: "https://github.com/example/repo/actions/runs/1",
    pagesUrl: "https://example.github.io/repo/viewer/?run=1",
    artifactUrl: "https://github.com/example/repo/actions/runs/1/artifacts/42",
    report: {
      durationText: "12.30 s",
      costText: "$0.123000",
      counts: { events: 8, errors: 1, peak: 2, inputTokens: 100, outputTokens: 20, costedCalls: 2, chats: 2 },
      signals: {
        errors: [{ id: "error", name: "web_fetch", duration: "500 ms" }],
        slow: [{ id: "slow", name: "aws-storage", duration: "8,000 ms" }],
      },
      dependencies: [
        { id: "root", owner: null, kind: "invoke_agent", name: "orchestrator", calls: 1, failed: false },
        { id: "child", owner: "root", kind: "invoke_agent", name: "aws-storage", calls: 1, failed: false },
        { id: "tool", owner: "child", kind: "execute_tool", name: "web_fetch", calls: 2, failed: true },
      ],
    },
  });
  assert.match(comment, /### Result[\s\S]*S3 and Blob Storage/);
  assert.match(comment, /orchestrator `gpt-6-luna` · subagents `claude-sonnet-4.6`/);
  assert.match(comment, /\*\*Pattern:\*\* Parallel delegation/);
  assert.match(comment, /\*\*Error:\*\* `web_fetch`/);
  assert.match(comment, /```mermaid[\s\S]*flowchart LR/);
  assert.match(comment, /orchestrator[\s\S]*aws-storage[\s\S]*web_fetch/);
  assert.match(comment, /class n2 failed/);
  assert.match(comment, /Open Trace Viewer]\(https:\/\/example\.github\.io\/repo\/viewer\/\?run=1\)/);
  assert.match(comment, /Download HTML artifact]\(https:\/\/github\.com\/example\/repo\/actions\/runs\/1\/artifacts\/42\)/);
});

test("uses a GitHub-hosted dependency image when one is available", () => {
  const comment = buildDemoResultComment({
    orchestratorModel: "gpt-6-luna",
    subagentModel: "gpt-6-luna",
    patternLabel: "Parallel delegation",
    result: "Result",
    runUrl: "https://github.com/example/repo/actions/runs/1",
    mediaUrl: "https://github.com/user-attachments/assets/dependency-graph",
    report: {
      durationText: "1.00 s",
      costText: "$0.001000",
      counts: { events: 2, errors: 0, peak: 1, inputTokens: 10, outputTokens: 2, costedCalls: 1, chats: 1 },
      signals: { errors: [], slow: [] },
      dependencies: [],
    },
  });
  assert.match(comment, /!\[Copilot CLI trace dependency graph\]\(https:\/\/github.com\/user-attachments\/assets\/dependency-graph\)/);
  assert.doesNotMatch(comment, /```mermaid/);
});
