import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dependencyGraphViewport } from "./capture-dependency-graph.mjs";
import { redact } from "./trace-model.mjs";
import {
  buildTraceData,
  buildTraceReport,
  loadSpans,
  renderDependencyGraph,
  renderHtml,
  renderTraceSummary,
} from "./render-trace-report.mjs";

const attr = (key, stringValue) => ({ key, value: { stringValue } });
const span = (spanId, parentSpanId, name, start, end, attributes = [], traceId = "trace-a") => ({
  traceId, spanId, parentSpanId, name,
  startTimeUnixNano: `${start}000000`,
  endTimeUnixNano: `${end}000000`,
  attributes,
});
const line = (...spans) => JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans }] }] });

function traceDirectory(t) {
  const directory = mkdtempSync(".trace-viewer-test-");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runRenderer(t, trace, env = {}) {
  const directory = traceDirectory(t);
  const tracePath = join(directory, "trace.jsonl");
  const htmlPath = join(directory, "report.html");
  const dataPath = join(directory, "data.json");
  const summaryPath = join(directory, "summary.md");
  writeFileSync(tracePath, trace);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./render-trace-report.mjs", import.meta.url)), tracePath,
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      TRACE_HTML_PATH: htmlPath, TRACE_DATA_PATH: dataPath, GITHUB_STEP_SUMMARY: summaryPath,
      TRACE_INCLUDE_MESSAGES: "false", REQUIRE_MODEL: "", REQUIRE_PATTERN_EVIDENCE: "false",
      TRACE_PATTERN: "", PRICING_PATH: "", GITHUB_REPOSITORY: "", GITHUB_RUN_ID: "",
      ...env,
    },
  });
  return { ...result, htmlPath, dataPath, summaryPath };
}

test("sizes dependency screenshots to the graph instead of the full UI", () => {
  assert.deepEqual(
    dependencyGraphViewport('<svg id="dependency-graph" viewBox="0 0 500 158" width="500" height="158">'),
    { width: 524, height: 182 },
  );
  assert.throws(() => dependencyGraphViewport("<html></html>"), /dimensions were not found/);
});

test("reconstructs shuffled spans, nested agents, tools, models and real overlap", () => {
  const jsonl = [
    line({ ...span("tool", "left", "execute_tool web_search", 1300, 1400), status: { code: 1 } }),
    line(span("right", "root", "invoke_agent research-b", 1200, 1700)),
    line(span("chat", "left", "chat gpt-5", 1450, 1500, [attr("gen_ai.usage.input_tokens", "12"), attr("gen_ai.usage.output_tokens", "4")])),
    line(span("root", "", "invoke_agent parent", 1000, 2000)),
    line(span("left", "root", "invoke_agent research-a", 1100, 1600)),
  ].join("\n");
  const result = renderTraceSummary(loadSpans(jsonl));
  assert.match(result, /Subagents: 2 \| Peak concurrent subagents: 2/);
  assert.match(result, /Tool calls: 1 .* Tokens: 12\/4/);
  assert.match(result, /invoke_agent parent[\s\S]*  invoke_agent research-a[\s\S]*    execute_tool web_search .* status=ok[\s\S]*    chat gpt-5[\s\S]*  invoke_agent research-b/);
});

test("reports no invented subagents and isolates parent identifiers by trace", () => {
  const result = renderTraceSummary(loadSpans([
    line(span("same", "", "invoke_agent parent", 1000, 2000)),
    line(span("other", "same", "execute_tool view", 1100, 1200, [], "trace-b")),
  ].join("\n")));
  assert.match(result, /Subagents: 0 \| Peak concurrent subagents: 0/);
  assert.match(result, /No subagents observed/);
  assert.match(result, /execute_tool view .* status=ok/);
  assert.doesNotMatch(result, /status=unknown/);
});

test("accepts the CLI's direct JSONL span records with hrtime and attribute objects", () => {
  const hashIdentifier = (name) => createHash("sha256").update(name).digest("hex");
  const toolId = (server, tool) => `${hashIdentifier(server)}/${hashIdentifier(tool).slice(0, 35)}`;
  assert.equal(toolId("microsoft-learn", "microsoft_docs_search"),
    "13b8ca8a502562dbd2771a98ddffb2928c5f332b9613385401698065fc630761/9eda69db084fe3d07903b420273b6010da2");
  const direct = (id, parent, name, start, end, attributes = {}) => JSON.stringify({
    type: "span", traceId: "direct-trace", spanId: id, parentSpanId: parent, name,
    kind: 0, startTime: [1700000000, start], endTime: [1700000000, end],
    attributes, status: { code: 1 },
  });
  const spans = loadSpans([
    direct("web", "aws", "execute_tool web_fetch", 250000000, 350000000),
    direct("mcp", "azure", `execute_tool ${toolId("microsoft-learn", "microsoft_docs_search")}`, 260000000, 360000000,
      { "gen_ai.tool.name": `${toolId("microsoft-learn", "microsoft_docs_search")}\u200b` }),
    direct("aws-chat", "aws", "chat gpt-6-luna", 400000000, 450000000, {
      "gen_ai.input.messages": JSON.stringify([{ role: "system", content: "internal instructions" },
        { role: "user", content: "Fetch public S3 docs using ghs_12345678901234567890" }]),
      "gen_ai.output.messages": JSON.stringify([{ role: "assistant", content: "S3 versioning <verified>" }]),
      "gen_ai.usage.input_tokens": 120,
      "gen_ai.usage.output_tokens": 30,
      "gen_ai.usage.cost": 0.003,
    }),
    direct("azure-chat", "azure", "chat gpt-6-luna", 410000000, 460000000),
    direct("root-chat", "root", "chat gpt-6-luna", 750000000, 800000000, { "gen_ai.usage.cost": 0.02 }),
    direct("azure", "root", "invoke_agent Azure", 200000000, 700000000),
    direct("aws", "root", "invoke_agent AWS", 100000000, 600000000),
    direct("root", "", "invoke_agent parent", 0, 900000000, { "gen_ai.input.messages": "private prompt must never be rendered" }),
  ].join("\n"));
  const result = buildTraceReport(spans, { includeMessages: true, expectedModel: "gpt-6-luna", pattern: "parallel-delegation" });
  assert.equal(result.complete, true);
  assert.equal(result.modelMatches, true);
  assert.equal(result.includeMessages, true);
  assert.ok(result.messageCount > 0);
  assert.match(result.summary, /Pattern evidence: PASS.*delegated branches: 2.*concurrent execution: yes/);
  assert.match(result.summary, /execute_tool web_fetch/);
  assert.match(result.summary, /execute_tool microsoft-learn\/microsoft_docs_search/);
  assert.doesNotMatch(result.summary, /status=unknown/);
  assert.match(renderTraceSummary(loadSpans(line(span("x", "", "execute_tool microsoft-learn-microsoft_docs_search", 1, 2)))),
    /execute_tool microsoft-learn\/microsoft_docs_search/);
  assert.match(result.summary, /Peak concurrent subagents: 2/);
  assert.match(result.summary, /Required: gpt-6-luna \(PASS\)/);
  const graph = renderDependencyGraph(result.events, result.pattern);
  assert.match(graph, /aria-label="Agent, model, and tool dependency graph"/);
  assert.match(graph, /microsoft-learn\/microsoft_docs_search/);
  assert.match(graph, /Branch 1 · AWS/);
  assert.match(graph, /Branch 2 · Azure/);
  assert.ok((graph.match(/<path /g) ?? []).length >= 4);
  const html = renderHtml(result);
  assert.match(html, /scoutTheme/);
  assert.match(html, /Copilot CLI Trace Viewer/);
  assert.match(html, /data-mode="trace"/);
  assert.match(html, /data-mode="dependencies"/);
  assert.match(html, /id="span-search"/);
  assert.match(html, /class="inspector-panel"/);
  assert.match(html, /\.span-row\.relation-highlight\{/);
  assert.match(html, /classList\.toggle\("relation-highlight"/);
  assert.doesNotMatch(html, /\.span-row\.related\{|classList\.toggle\("related"/);
  assert.match(html, /const replaceLocation =/);
  assert.match(html, /replaceLocation\(\{ span: id \}\)/);
  assert.match(html, /replaceLocation\(\{ tab: map \? "dependencies" : "trace" \}\)/);
  assert.match(html, /\.span-row\.active \.span-title strong[^}]*color:var\(--blue\)/);
  assert.match(html, /\.span-row\.relation-highlight \.span-title strong\{color:var\(--violet\)\}/);
  assert.match(html, /\.span-row\[data-failed="true"\] \.span-title strong[^}]*color:var\(--red\)/);
  assert.match(html, /\.span-row\[data-kind="execute_tool"\] \.span-title small\{color:var\(--green\)\}/);
  assert.match(html, /capture-graph \.commandbar[^}]*display:none/);
  assert.match(html, /capture-graph \.graph-wrap\{[^}]*padding:12px/);
  assert.match(html, /class="svg-icon/);
  assert.match(html, /aria-label="Download PNG"/);
  assert.doesNotMatch(html, /Signals/);
  assert.match(html, />Dependencies</);
  assert.match(html, /reported cost/i);
  assert.match(html, /\$0\.0230/);
  assert.match(html, /Cost allocation/);
  assert.match(html, /By agent branch/);
  assert.equal(result.costBreakdown.byModel.length, 1);
  assert.equal(result.costBreakdown.byAgent.length, 3);
  const data = buildTraceData(result);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.events.length, result.events.length);
  assert.deepEqual(data.timeRange, result.timeRange);
  assert.equal(data.counts.events, result.events.length);
  assert.ok(data.dependencies.some((dependency) => dependency.name === "Branch 1 · AWS"));
  assert.match(html, /id="download-png"/);
  assert.match(html, /microsoft-learn\/microsoft_docs_search/);
  assert.match(html, /S3 versioning &lt;verified&gt;/);
  assert.match(html, /\[REDACTED TOKEN\]/);
  assert.doesNotMatch(html, /ghs_12345678901234567890|internal instructions/);
  assert.doesNotMatch(html, /private prompt must never be rendered/);
  assert.equal(buildTraceReport(spans, { expectedModel: "gpt-5" }).modelMatches, false);
  assert.equal(buildTraceReport(spans, { expectedModel: "gpt-6-luna,gpt-5" }).modelMatches, false);
  assert.doesNotMatch(renderHtml(buildTraceReport(spans)), /S3 versioning &lt;verified&gt;/);
});

test("validates observed models against the requested runtime model set", () => {
  const spans = loadSpans(line(
    span("parent", "", "chat github-copilot/gpt-6-luna-2026-09-01", 1, 2),
    span("child", "", "chat claude-sonnet-4.6", 3, 4),
  ));
  assert.equal(buildTraceReport(spans, { expectedModel: "gpt-6-luna,claude-sonnet-4.6" }).modelMatches, true);
  assert.equal(buildTraceReport(spans, { expectedModel: "gpt-6-luna,gpt-6-sol" }).modelMatches, false);
  assert.equal(buildTraceReport(loadSpans(line(
    span("root", "", "invoke_agent", 0, 10),
    span("agent", "root", "invoke_agent explore", 1, 9),
    span("child", "agent", "chat claude-sonnet-4.6", 2, 8),
  )), { expectedModel: "gpt-6-luna,claude-sonnet-4.6" }).modelMatches, true);
  assert.equal(buildTraceReport(loadSpans(line(
    span("mini", "", "chat gpt-5.4-mini", 1, 2),
  )), { expectedModel: "gpt-5.4" }).modelMatches, false);
});

test("surfaces OTEL failure reasons without message capture", () => {
  const failed = {
    ...span("tool", "", "execute_tool web_fetch", 1, 2, [
      attr("error.type", "permission_denied"),
      attr("error.message", "URL is not allowed by policy"),
    ]),
    status: { code: 2 },
  };
  const result = buildTraceReport(loadSpans(line(failed)));
  assert.equal(result.events[0].errorReason, "URL is not allowed by policy");
  assert.match(renderHtml(result), /Failure reason[\s\S]*URL is not allowed by policy/);
});

test("redacts complete authorization headers in payloads and metadata-only failures", () => {
  const credential = Buffer.from("synthetic-user:synthetic-password").toString("base64");
  const bearer = "synthetic-bearer-token-123456";
  const headers = [
    `Authorization: Basic ${credential}`,
    JSON.stringify({ Authorization: `Basic ${credential}` }),
    JSON.stringify({ request: JSON.stringify({ Authorization: `Basic ${credential}` }) }),
    `authorization=Bearer ${bearer}`,
    `Proxy-Authorization: Basic ${credential}`,
    "api_key=synthetic-api-key password=synthetic-password",
    "ghs_12345678901234567890",
    `Standalone Bearer ${bearer}`,
  ].join("\n");
  const spans = loadSpans(line({
    ...span("tool", "", "execute_tool request", 1, 2, [
      attr("gen_ai.tool.call.arguments", headers),
      attr("gen_ai.tool.call.result", headers),
      attr("error.message", headers),
    ]),
    status: { code: 2 },
  }));
  for (const includeMessages of [true, false]) {
    const model = buildTraceReport(spans, { includeMessages });
    const published = JSON.stringify(buildTraceData(model)) + renderHtml(model);
    for (const secret of [credential, bearer, "synthetic-api-key", "synthetic-password", "ghs_12345678901234567890"]) {
      assert.ok(!published.includes(secret), `exposed synthetic credential with capture=${includeMessages}`);
    }
    assert.match(model.events[0].errorReason, /REDACTED/);
  }
});

test("redacts tab-separated and JSON-escaped authorization values completely", () => {
  const credential = "dummy-credential";
  const following = "following public value";
  const header = { Authorization: `Basic\t${credential}`, "X-Trace": following };
  const payloads = [
    `Authorization: Basic\t${credential}\nX-Trace: ${following}`,
    JSON.stringify(header),
    JSON.stringify({ request: JSON.stringify(header) }),
    JSON.stringify({ request: JSON.stringify({ request: JSON.stringify(header) }) }),
    JSON.stringify(`Authorization: Basic\t${credential}\nX-Trace: ${following}`),
    JSON.stringify({ ...header, Authorization: `Basic\t"${credential}"` }),
    JSON.stringify({ ...header, Authorization: `Basic\n${credential}` }),
    JSON.stringify({ ...header, "Proxy-Authorization": `Basic\t${credential}` }),
  ];
  for (const payload of payloads) {
    const sanitized = redact(payload);
    assert.ok(!sanitized.includes(credential), sanitized);
    assert.ok(sanitized.includes(following), "must retain following public fields");
    if (payload.startsWith("{") || payload.startsWith('"')) {
      assert.doesNotThrow(() => JSON.parse(sanitized));
    }
    const model = buildTraceReport(loadSpans(line({
      ...span("tool", "", "execute_tool request", 1, 2, [
        attr("gen_ai.tool.call.arguments", payload),
        attr("gen_ai.tool.call.result", payload),
        attr("error.message", payload),
      ]),
      status: { code: 2 },
    })), { includeMessages: true });
    assert.ok(!(JSON.stringify(buildTraceData(model)) + renderHtml(model)).includes(credential));
    assert.ok(model.events[0].errorReason.includes(following));
  }
});

test("redacts nested structured and JSON-encoded tool arguments before publication", () => {
  const secrets = {
    password: "synthetic-not-a-real-password-12345",
    api_key: "synthetic-not-a-real-api-key-67890",
    "access-token": "synthetic-not-a-real-access-token-54321",
  };
  const authorization = Buffer.from("synthetic-user:synthetic-nested-password").toString("base64");
  const innerArguments = JSON.stringify({
    credentials: secrets,
    headers: { Authorization: `Basic\t${authorization}` },
    file: "/home/runner/private/nested-tool.json",
    query: "public nested query",
  });
  const outerArguments = {
    ...secrets,
    tool_calls: [{ id: "nested-call", type: "function", function: {
      name: "nested_lookup", arguments: innerArguments,
    } }],
    function_call: { name: "nested_function", arguments: JSON.stringify({ credentials: secrets }) },
    visible: { count: 3, enabled: true, absent: null, items: ["public item"] },
  };
  const messages = [
    { role: "assistant", tool_calls: [{ id: "legacy-call", type: "function", function: {
      name: "legacy_lookup", arguments: JSON.stringify(outerArguments),
    } }] },
    { role: "assistant", function_call: { name: "legacy_function", arguments: outerArguments } },
    { role: "assistant", parts: [{ type: "tool_call", id: "standard-call",
      name: "standard_lookup", arguments: JSON.stringify(outerArguments) }] },
    { role: "assistant", content: [{ type: "tool_use", name: "content_lookup", input: outerArguments }] },
  ];
  const spans = loadSpans(line(
    span("chat", "", "chat gpt-6-luna", 1, 2, [
      attr("gen_ai.output.messages", JSON.stringify(messages)),
    ]),
    {
      ...span("tool", "", "execute_tool lookup", 3, 4, {
        "gen_ai.tool.call.arguments": outerArguments,
        "gen_ai.tool.call.result": JSON.stringify(outerArguments),
        "error.message": JSON.stringify({ failure: { function: { arguments: innerArguments } } }),
      }),
      status: { code: 2 },
    },
  ));
  for (const includeMessages of [true, false]) {
    const model = buildTraceReport(spans, { includeMessages });
    for (const published of [JSON.stringify(buildTraceData(model)), renderHtml(model)]) {
      for (const secret of [...Object.values(secrets), authorization, "/home/runner/private"]) {
        assert.ok(!published.includes(secret), `exposed nested secret with capture=${includeMessages}`);
      }
      assert.ok(published.includes("public nested query"), "must retain public failure details");
    }
    if (includeMessages) {
      for (const name of ["legacy_lookup", "legacy_function", "standard_lookup", "content_lookup", "nested_lookup"]) {
        assert.ok(model.events[0].response.includes(name), `must retain ${name}`);
      }
      const request = JSON.parse(model.events[1].request);
      assert.equal(request.password, "[REDACTED]");
      assert.deepEqual(request.visible, outerArguments.visible);
      assert.equal(typeof request.tool_calls[0].function.arguments, "string");
      assert.deepEqual(JSON.parse(request.tool_calls[0].function.arguments).credentials, {
        password: "[REDACTED]", api_key: "[REDACTED]", "access-token": "[REDACTED]",
      });
    } else {
      assert.equal(model.events[0].response, undefined);
      assert.equal(model.events[1].request, undefined);
    }
  }
});

test("preserves nested JSON argument types and legitimate values without mutating input", () => {
  const originalArguments = JSON.stringify(JSON.stringify({
    password: "synthetic-nested-password-12345",
    next: JSON.stringify({ api_key: "synthetic-nested-api-key-12345", keep: [0, false, null, {}] }),
  }));
  const payload = { function: { name: "lookup", arguments: originalArguments } };
  const sanitized = JSON.parse(redact(payload));
  assert.equal(sanitized.function.name, "lookup");
  assert.equal(typeof sanitized.function.arguments, "string");
  const args = JSON.parse(JSON.parse(sanitized.function.arguments));
  assert.equal(args.password, "[REDACTED]");
  assert.equal(typeof args.next, "string");
  assert.deepEqual(JSON.parse(args.next), { api_key: "[REDACTED]", keep: [0, false, null, {}] });
  assert.equal(payload.function.arguments, originalArguments);
  for (const legitimate of [
    ' { "query": "public query", "count": 3, "enabled": true, "items": [] } \n',
    "42", "false", "null", '""', JSON.stringify(JSON.stringify({ query: "public query" })),
    "https://example.com/docs?q=public", "src/main.mjs",
  ]) {
    assert.equal(redact(legitimate), legitimate);
  }
});

test("uses text redaction for malformed nested arguments without losing public content", () => {
  const secret = "synthetic-malformed-password-12345";
  const malformed = `{ "password": "${secret}", "query": "public malformed query", trailing`;
  const messages = [{ role: "assistant", tool_calls: [{ type: "function", function: {
    name: "malformed_lookup", arguments: malformed,
  } }] }];
  const model = buildTraceReport(loadSpans(line(
    span("chat", "", "chat gpt-6-luna", 1, 2, [
      attr("gen_ai.output.messages", JSON.stringify(messages)),
    ]),
    {
      ...span("tool", "", "execute_tool lookup", 3, 4, [
        attr("gen_ai.tool.call.arguments", malformed),
        attr("error.message", malformed),
      ]),
      status: { code: 2 },
    },
  )), { includeMessages: true });
  for (const published of [JSON.stringify(buildTraceData(model)), renderHtml(model)]) {
    assert.ok(!published.includes(secret));
    assert.ok(published.includes("public malformed query"));
    assert.ok(published.includes("trailing"));
  }
  const invalidMessages = buildTraceReport(loadSpans(line(span("invalid", "", "chat gpt-6-luna", 1, 2, [
    attr("gen_ai.output.messages", malformed),
  ]))), { includeMessages: true });
  assert.equal(invalidMessages.messageCount, 0);
});

test("normalizes local path prefixes in every published payload and diagnostic", () => {
  const paths = [
    "/home/runner/work/sample/sample/src/main.mjs",
    "/home/alice/private/config.json",
    "/Users/alice/private/config.json",
    "/workspace/sample/src/main.mjs",
    "/workspaces/sample/src/main.mjs",
    "/tmp/session/tool.txt",
    "/var/tmp/session/tool.txt",
    "/root/private/config.json",
    "/github/workspace/src/main.mjs",
    "/opt/actions-runner/_work/sample/src/main.mjs",
    `${process.cwd()}/local-file.txt`,
    "C:\\Users\\alice\\private\\config.json",
    "C:/Users/alice/private/config.json",
    "D:\\a\\sample\\sample\\src\\main.mjs",
  ];
  const payload = `${paths.join("\n")}\n${JSON.stringify({ paths })}\nfile:///home/alice/private/file.txt\ncwd:/workspace/sample\nhttps://example.com/home/alice/docs\nsrc/main.mjs`;
  const spans = loadSpans(line(
    span("root", "", "invoke_agent parent", 0, 10),
    {
      ...span("tool", "root", `execute_tool ${paths[0]}`, 1, 2, [
        attr("gen_ai.tool.call.arguments", payload),
        attr("gen_ai.tool.call.result", payload),
        attr("exception.message", payload),
      ]),
      status: { code: 2 },
    },
    span("chat", "root", `chat ${paths[1]}`, 3, 4, [
      attr("gen_ai.input.messages", JSON.stringify([{ role: "user", content: payload }])),
      attr("gen_ai.output.messages", JSON.stringify([{ role: "assistant", content: payload }])),
    ]),
  ));
  for (const includeMessages of [true, false]) {
    const model = buildTraceReport(spans, { includeMessages });
    const published = JSON.stringify(buildTraceData(model)) + renderHtml(model) + model.summary;
    for (const path of paths) {
      assert.ok(!published.includes(path), `exposed absolute path ${path}`);
      assert.ok(!published.includes(JSON.stringify(path).slice(1, -1)), `exposed serialized path ${path}`);
    }
    assert.ok(!published.includes("/home/alice/private/file.txt"));
    assert.ok(!published.includes("cwd:/workspace"));
    assert.match(model.events[1].errorReason, /https:\/\/example\.com\/home\/alice\/docs/);
    assert.match(model.events[1].errorReason, /src\/main\.mjs/);
  }
});

test("recognizes standard message parts, legacy content, and tool-call payloads", () => {
  const spans = loadSpans(line(
    span("parts", "", "chat gpt-6-luna", 1, 2, [
      attr("gen_ai.input.messages", JSON.stringify([
        { role: "system", parts: [{ type: "text", content: "private system instruction" }] },
        { role: "user", parts: [{ type: "text", content: "standard input" }] },
      ])),
      attr("gen_ai.output.messages", JSON.stringify([{ role: "assistant", parts: [
        { type: "text", content: "standard answer" },
        { type: "tool_call", id: "call-1", name: "lookup", arguments: { query: "part query" } },
      ] }])),
    ]),
    {
      ...span("legacy", "", "chat gpt-6-luna", 3, 4),
      events: [{ attributes: [
        attr("gen_ai.input.messages", JSON.stringify({ messages: [
          { role: "user", content: [{ type: "text", text: "legacy input" }] },
          { role: "tool", content: "legacy tool result" },
        ] })),
        attr("gen_ai.output.messages", JSON.stringify([{ role: "assistant", content: null,
          tool_calls: [{ id: "call-2", type: "function", function: { name: "lookup", arguments: "{}" } }] }])),
      ] }],
    },
  ));
  const model = buildTraceReport(spans, { includeMessages: true });
  assert.equal(model.messageCount, 2);
  assert.match(model.events[0].request, /user:.*standard input/s);
  assert.match(model.events[0].response, /standard answer[\s\S]*part query/);
  assert.match(model.events[1].request, /legacy input[\s\S]*legacy tool result/);
  assert.match(model.events[1].response, /call-2[\s\S]*lookup/);
  assert.doesNotMatch(renderHtml(model), /private system instruction/);
});

test("does not count role labels or empty message payloads as captured evidence", () => {
  const emptyMessages = [
    { role: "user" }, { role: "assistant", content: "" }, { role: "tool", content: "  " },
    { role: "user", parts: [] }, { role: "user", content: {} },
    { role: "user", parts: [{ type: "text", content: "" }, { type: "text", content: " " }] },
    { role: "assistant", content: [{ type: "text", text: "" }], tool_calls: [] },
  ];
  const model = buildTraceReport(loadSpans(line(span("chat", "", "chat gpt-6-luna", 1, 2, [
    attr("gen_ai.input.messages", JSON.stringify(emptyMessages)),
    attr("gen_ai.output.messages", JSON.stringify(emptyMessages)),
  ]))), { includeMessages: true });
  assert.equal(model.messageCount, 0);
  assert.equal(model.events[0].request, null);
  assert.equal(model.events[0].response, null);
});

test("requires overlapping branches for parallel delegation", () => {
  const spans = loadSpans(line(
    span("root", "", "invoke_agent", 0, 100),
    span("aws", "root", "invoke_agent aws-storage", 10, 80),
    span("azure", "root", "invoke_agent azure-storage", 20, 90),
  ));
  assert.equal(buildTraceReport(spans, { pattern: "parallel-delegation" }).complete, true);
  assert.equal(buildTraceReport(loadSpans(line(
    span("root", "", "invoke_agent", 0, 100),
    span("first", "root", "invoke_agent explore", 10, 40),
    span("second", "root", "invoke_agent explore", 50, 90),
  )), { pattern: "parallel-delegation" }).complete, false);
});

test("requires incomparable concurrent agents rather than nested delegation", () => {
  const root = span("root", "", "invoke_agent orchestrator", 0, 100);
  const worker = span("worker", "root", "invoke_agent worker", 10, 90);
  const helper = span("helper", "worker", "invoke_agent helper", 20, 80);
  const nested = buildTraceReport(loadSpans(line(root, worker, helper)), { pattern: "parallel-delegation" });
  assert.equal(nested.complete, false);
  assert.equal(nested.counts.peak, 2);
  assert.match(nested.summary, /Peak concurrent subagents: 2/);
  assert.match(nested.summary, /Pattern evidence: MISSING.*concurrent execution: no/);
  const nestedBranches = buildTraceReport(loadSpans(line(
    root, worker, helper,
    span("wrapper", "worker", "execute_tool task", 25, 75),
    span("other-helper", "wrapper", "invoke_agent other-helper", 30, 70),
  )), { pattern: "parallel-delegation" });
  assert.equal(nestedBranches.complete, true);
  assert.equal(buildTraceReport(loadSpans(line(root,
    span("first", "root", "invoke_agent first", 10, 40),
    span("second", "root", "invoke_agent second", 40, 80),
  )), { pattern: "parallel-delegation" }).complete, false);
  assert.equal(buildTraceReport(loadSpans(line(root, worker,
    span("instant", "root", "invoke_agent instant", 20, 20),
  )), { pattern: "parallel-delegation" }).complete, false);
  assert.equal(buildTraceReport(loadSpans(line(root,
    { ...span("first", "root", "invoke_agent first", 10, 11), endTimeUnixNano: "10200000" },
    { ...span("second", "root", "invoke_agent second", 10, 11), startTimeUnixNano: "10100000" },
  )), { pattern: "parallel-delegation" }).complete, true);
});

test("validates review and sequential orchestration pattern evidence", () => {
  const review = loadSpans(line(
    span("root", "", "invoke_agent", 0, 100),
    span("left", "root", "invoke_agent architecture-review", 10, 70),
    span("right", "root", "invoke_agent reliability-review", 20, 80),
  ));
  assert.equal(buildTraceReport(review, { pattern: "parallel-delegation" }).complete, true);
  assert.equal(buildTraceReport(review, { pattern: "sequential-pipeline" }).complete, false);

  const collaboration = loadSpans(line(
    span("root", "", "invoke_agent", 0, 100),
    span("architect", "root", "invoke_agent solution-architect", 10, 40),
    span("reviewer", "root", "invoke_agent critical-reviewer", 50, 90),
  ));
  const result = buildTraceReport(collaboration, { pattern: "sequential-pipeline" });
  assert.equal(result.complete, true);
  const graph = renderDependencyGraph(result.events, result.pattern);
  assert.match(graph, /Stage 1/);
  assert.match(graph, /Stage 2/);
  assert.match(graph, /class="flow-edge"/);
  assert.match(result.summary, /sequential execution: yes/);
  assert.equal(buildTraceReport(collaboration, { pattern: "parallel-delegation" }).complete, false);
  const critic = buildTraceReport(collaboration, { pattern: "critic-reviser-loop" });
  assert.equal(critic.complete, true);
  assert.match(renderDependencyGraph(critic.events, critic.pattern), /Critic 2 · critical-reviewer/);
});

test("validates a single-agent baseline without delegated agents", () => {
  const baseline = loadSpans(line(
    span("root", "", "invoke_agent", 0, 100),
    span("chat", "root", "chat gpt-6-luna", 10, 90),
  ));
  assert.equal(buildTraceReport(baseline, { pattern: "direct-execution" }).complete, true);
  assert.equal(buildTraceReport(baseline, { pattern: "critic-reviser-loop" }).complete, false);
});

test("hydrates file-backed tool output before redaction and rendering", (t) => {
  const directory = traceDirectory(t);
  const outputPath = resolve(directory, "123-copilot-tool-output-result.txt");
  const previousRunnerTemp = process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP = resolve(directory);
  const fullOutput = `{"results":[{"title":"Complete result","content":"${"useful ".repeat(400)}END-OF-FILE"}]}`;
  writeFileSync(outputPath, fullOutput);
  try {
    const trace = line(span("tool", "", "execute_tool microsoft_docs_search", 1, 2, [
      attr("gen_ai.tool.call.result", `Output too large to read at once (4 KB). Saved to: ${outputPath}\n\nPreview (first 500 chars): partial only`),
    ]));
    const model = buildTraceReport(loadSpans(trace), { includeMessages: true });
    assert.equal(model.events[0].response, fullOutput);
    const html = renderHtml(model);
    assert.match(html, /END-OF-FILE/);
    assert.doesNotMatch(html, /\[truncated\]|Saved to:|trace-viewer-test-/);
  } finally {
    if (previousRunnerTemp == null) delete process.env.RUNNER_TEMP;
    else process.env.RUNNER_TEMP = previousRunnerTemp;
  }
});

test("normalizes standard and legacy cached-input token attributes before pricing", () => {
  const pricingCatalog = { models: { "test-model": {
    default: { input: 2, cachedInput: 0.2, cacheWrite: 3, output: 5 },
  } } };
  for (const key of [
    "gen_ai.usage.cache_read.input_tokens",
    "gen_ai.usage.cached_input_tokens",
    "gen_ai.usage.cache_read_input_tokens",
  ]) {
    const spans = loadSpans(line(span("chat", "", "chat test-model", 1, 2, [
      attr("gen_ai.usage.input_tokens", "1000"),
      attr("gen_ai.usage.output_tokens", "100"),
      attr(key, "800"),
    ])));
    const model = buildTraceReport(spans, { pricingCatalog });
    assert.equal(model.events[0].cachedInputTokens, 800, key);
    assert.equal(model.events[0].cost, 0.00106, key);
    assert.equal(model.counts.totalCost, 0.00106, key);
    assert.equal(model.counts.inputTokens, 1000, key);
  }
  const canonical = buildTraceReport(loadSpans(line(span("chat", "", "chat test-model", 1, 2, {
    "gen_ai.usage.input_tokens": 1000,
    "gen_ai.usage.cache_read.input_tokens": 0,
    "gen_ai.usage.cached_input_tokens": 800,
  }))), { pricingCatalog });
  assert.equal(canonical.events[0].cachedInputTokens, 0);
  assert.equal(canonical.events[0].cost, 0.002);
});

test("enforces require-model independently of pattern and message evidence", (t) => {
  const trace = line(span("chat", "", "chat gpt-6-luna", 1, 2));
  for (const REQUIRE_PATTERN_EVIDENCE of ["", "false", "direct-execution"]) {
    const mismatch = runRenderer(t, trace, {
      REQUIRE_MODEL: "gpt-5", REQUIRE_PATTERN_EVIDENCE, TRACE_PATTERN: "direct-execution",
    });
    assert.equal(mismatch.status, 1, REQUIRE_PATTERN_EVIDENCE);
    assert.match(mismatch.stderr, /model/i);
    assert.match(readFileSync(mismatch.summaryPath, "utf8"), /MISMATCH/);
    assert.equal(JSON.parse(readFileSync(mismatch.dataPath, "utf8")).modelMatches, false);
  }
  assert.equal(runRenderer(t, trace, { REQUIRE_MODEL: "gpt-6-luna" }).status, 0);
  assert.equal(runRenderer(t, trace).status, 0);
  assert.equal(runRenderer(t, line(span("tool", "", "execute_tool view", 1, 2)), {
    REQUIRE_MODEL: "gpt-6-luna",
  }).status, 1);
});

test("rejects empty message evidence at the CLI but accepts standard parts", (t) => {
  for (const [content, status] of [["", 1], ["captured text", 0]]) {
    const result = runRenderer(t, line(span("chat", "", "chat gpt-6-luna", 1, 2, [
      attr("gen_ai.input.messages", JSON.stringify([{ role: "user", parts: [{ type: "text", content }] }])),
    ])), {
      TRACE_INCLUDE_MESSAGES: "true", REQUIRE_PATTERN_EVIDENCE: "direct-execution",
      TRACE_PATTERN: "direct-execution",
    });
    assert.equal(result.status, status);
  }
});

test("sanitizes CLI diagnostics including custom runner roots", (t) => {
  const root = resolve(traceDirectory(t));
  const failure = runRenderer(t, line(span("chat", "", "chat gpt-6-luna", 1, 2)), {
    PRICING_PATH: `${root}/missing-pricing.json`, RUNNER_TEMP: root,
  });
  assert.equal(failure.status, 1);
  assert.ok(!failure.stderr.includes(root));
  assert.ok(!readFileSync(failure.summaryPath, "utf8").includes(root));
  const credential = Buffer.from("synthetic-user:synthetic-password").toString("base64");
  const duplicate = span(`Authorization: Basic ${credential}`, "", "chat gpt-6-luna", 1, 2);
  const secretFailure = runRenderer(t, line(duplicate, duplicate));
  assert.equal(secretFailure.status, 1);
  assert.ok(!secretFailure.stderr.includes(credential));
  assert.ok(!readFileSync(secretFailure.summaryPath, "utf8").includes(credential));
});

test("sanitizes custom workspace and runner paths before writing report artifacts", (t) => {
  const payload = "cwd=/srv/custom-build/source/main.mjs\noutput=/mnt/custom-scratch/result.txt";
  const result = runRenderer(t, line({
    ...span("tool", "", "execute_tool read", 1, 2, [
      attr("gen_ai.tool.call.arguments", payload),
      attr("gen_ai.tool.call.result", payload),
    ]),
    status: { code: 2, message: payload },
  }), {
    TRACE_INCLUDE_MESSAGES: "true",
    GITHUB_WORKSPACE: "/srv/custom-build",
    RUNNER_TEMP: "/mnt/custom-scratch",
  });
  assert.equal(result.status, 0);
  for (const path of [result.htmlPath, result.dataPath, result.summaryPath]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /\/srv\/custom-build|\/mnt\/custom-scratch/);
  }
  const data = JSON.parse(readFileSync(result.dataPath, "utf8"));
  assert.match(data.events[0].request, /\[WORKSPACE\]\/source\/main\.mjs/);
  assert.match(data.events[0].response, /\[TEMP\]\/result\.txt/);
  assert.match(data.signals.errors[0].reason, /\[TEMP\]\/result\.txt/);
});

test("estimates mixed-model cost from the model pricing catalog", () => {
  const gpt = span("gpt", "", "chat github-copilot/gpt-6-luna-2026-09-01", 1, 2, [
    attr("gen_ai.usage.input_tokens", "1000000"),
    attr("gen_ai.usage.output_tokens", "2000000"),
  ]);
  const claude = span("claude", "", "chat anthropic/claude-sonnet-4.6", 3, 4, [
    attr("gen_ai.usage.input_tokens", "1000000"),
    attr("gen_ai.usage.output_tokens", "2000000"),
  ]);
  const unknownSpan = span("unknown", "", "chat private-model", 5, 6, [
    attr("gen_ai.usage.input_tokens", "1000000"),
    attr("gen_ai.usage.output_tokens", "2000000"),
  ]);
  const model = buildTraceReport(loadSpans(line(gpt, claude, unknownSpan)));
  assert.equal(model.events[0].cost, 1.7);
  assert.equal(model.events[0].pricedModel, "gpt-6-luna");
  assert.equal(model.events[1].cost, 33);
  assert.equal(model.events[1].pricedModel, "claude-sonnet-4.6");
  assert.equal(model.events[2].cost, null);
  assert.equal(model.counts.totalCost, 34.7);
  assert.equal(model.counts.costedCalls, 2);
  assert.equal(model.counts.costMode, "estimated");
  assert.equal(model.costBreakdown.byModel.length, 3);
  assert.equal(model.costBreakdown.byModel.find((group) => group.label === "private-model").cost, null);
  assert.match(renderHtml(model), /estimated cost/i);
  assert.match(renderHtml(model), /\$34\.7000/);
  const unknown = buildTraceReport(loadSpans(line(span("unknown", "", "chat private-model", 1, 2))));
  assert.equal(unknown.events[0].cost, null);
  assert.equal(unknown.counts.totalCost, null);
});

test("fails clearly on missing or malformed traces", () => {
  assert.throws(() => loadSpans(""), /Missing or empty/);
  assert.throws(() => loadSpans("{broken"), /Invalid JSON/);
  assert.throws(() => loadSpans("null"), /Invalid OTLP entry/);
  assert.throws(() => loadSpans(line()), /No trace spans/);
  assert.throws(() => renderTraceSummary(loadSpans(line(span("x", "", "unrelated", 1, 2)))), /no invoke_agent/);
});
