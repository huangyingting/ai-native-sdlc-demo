import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { normalizeUsage, parseAnswer, parseJsonlAnswer, realCopilot } from "../copilot.mjs";
import { immutableImage, runSandbox } from "../sandbox.mjs";

const image = `node@sha256:${"a".repeat(64)}`;
const imageId = `sha256:${"b".repeat(64)}`;
const containerId = "c".repeat(64);

function jsonlEvents(content = '{"result":"synthetic"}') {
  return [
    { type: "assistant.message", data: { content, phase: "final_answer", toolRequests: [] } },
    { type: "session.usage_checkpoint", data: { promptCacheBreakState: [{
      conversation: "main", models: { observed: { tool_count: 0, tools: [], tools_truncated: 0 } },
    }] } },
    { type: "result", exitCode: 0 },
  ];
}
const jsonl = (events = jsonlEvents()) => events.map((event) => JSON.stringify(event)).join("\n") + "\n";

function paths(t) {
  const root = resolve(`.execution-test-${randomUUID()}`);
  const empty = join(root, "empty");
  const workspace = join(root, "workspace");
  const oracleRoot = join(root, "oracle");
  const repositoryRoot = join(root, "source");
  mkdirSync(root, { mode: 0o700 });
  for (const path of [empty, workspace, oracleRoot, repositoryRoot]) mkdirSync(path, { mode: 0o755 });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, cwd: root, empty, workspace, oracleRoot, repositoryRoot, dest: join(root, "call") };
}

async function rejectedCall(options, injections) {
  let result;
  await assert.rejects(realCopilot(options, injections), (error) => {
    assert.equal(error.name, "CopilotExecutionError");
    assert.equal(error.status, error.result.status);
    assert.deepEqual(error.artifacts, error.result.artifacts);
    assert.deepEqual(error.metrics, error.result.metrics);
    result = error.result;
    return true;
  });
  return result;
}

function dockerFixture(t, overrides = {}) {
  const directories = paths(t);
  const calls = [];
  let info;
  const state = { Status: "exited", Running: false, ExitCode: 0, Error: "" };
  const run = (command, args, options) => {
    assert.equal(command, "docker");
    calls.push({ args, options });
    if (args[0] === "image") return JSON.stringify([{ Id: imageId }]);
    if (args[0] === "create") {
      const [key, value] = args[args.indexOf("--label") + 1].split("=");
      info = {
        Id: containerId, Name: `/${args[args.indexOf("--name") + 1]}`, Image: imageId,
        Config: { Image: imageId, Labels: { [key]: value } },
        Mounts: [
          { Type: "bind", Source: directories.workspace, Destination: "/work", RW: false },
          { Type: "bind", Source: directories.oracleRoot, Destination: "/oracle", RW: false },
        ],
        State: state,
      };
      return overrides.create ? overrides.create(info, args) : containerId;
    }
    if (args[0] === "start") {
      return overrides.start ? overrides.start(info) : { stdout: "tests passed\n", stderr: "diagnostic\n", status: 0 };
    }
    if (args[0] === "container" && args[1] === "inspect") {
      if (overrides.inspect) overrides.inspect(info, args, calls);
      if (!info) throw Object.assign(new Error("missing"), { stderr: `Error: No such container: ${args[2]}` });
      return JSON.stringify([info]);
    }
    if (args[0] === "container" && args[1] === "rm") {
      assert.equal(args[3], containerId);
      if (overrides.remove) return overrides.remove(info);
      info = null;
      return containerId;
    }
    assert.fail(`Unexpected Docker command: ${args}`);
  };
  return { ...directories, calls, run };
}

test("Copilot uses only bounded restricted CLI flags and private artifacts", async (t) => {
  const fixture = paths(t);
  writeFileSync(join(fixture.cwd, "AGENTS.md"), "Synthetic parent instructions must not be read.");
  writeFileSync(join(fixture.workspace, "evidence.json"), '{"synthetic":true}');
  const calls = [];
  const response = await realCopilot({ ...fixture, prompt: 'Synthetic evidence: {"value":1}' }, {
    repositoryRoot: fixture.repositoryRoot,
    run(command, args, options) {
      calls.push({ command, args, options });
      assert.deepEqual(readdirSync(options.cwd), []);
      assert.equal(statSync(args[args.indexOf("--usage-output-file") + 1]).mode & 0o777, 0o600);
      writeFileSync(args[args.indexOf("--usage-output-file") + 1], JSON.stringify({
        model: "observed-model", inputTokens: 17, outputTokens: 2, cachedInputTokens: 0, aiCredits: 0.25,
        secret: "must-not-escape",
      }));
      return jsonl();
    },
  });
  assert.equal(response.status, "ok");
  assert.deepEqual(response.answer, { result: "synthetic" });
  assert.equal(response.metrics.model, "observed-model");
  assert.equal(response.metrics.cachedInputTokens, 0);
  assert.equal(response.metrics.aiCredits, 0.25);
  assert.ok(response.metrics.wallMs >= 0);
  assert.equal(response.metrics.usageStatus, "recorded");
  assert.equal(response.metrics.noToolsVerified, true);
  assert.equal(JSON.stringify(response).includes("must-not-escape"), false);
  assert.equal(calls.length, 1);
  const { command, args, options } = calls[0];
  assert.equal(command, "copilot");
  for (const flag of ["--no-custom-instructions", "--no-auto-update", "--no-ask-user",
    "--disable-builtin-mcps", "--excluded-tools", "--deny-tool=write", "--deny-tool=shell", "--silent"]) {
    assert.ok(args.includes(flag));
  }
  assert.deepEqual(args.slice(args.indexOf("--excluded-tools") + 1, args.indexOf("--deny-tool=write")), [
    "bash", "read_bash", "stop_bash", "list_bash", "apply_patch", "view", "web_fetch",
    "fetch_copilot_cli_documentation", "skill", "run_factory", "factories_manage", "sql",
    "session_store_sql", "read_agent", "list_agents", "write_agent", "rg", "glob", "task",
  ]);
  assert.equal(args.some((arg) => arg.startsWith("--available-tools")), false);
  assert.equal(args[args.indexOf("--stream") + 1], "off");
  assert.equal(args[args.indexOf("--output-format") + 1], "json");
  for (const flag of ["--deny-tool=*", "--model", "--reasoning-effort", "--allow-all", "--allow-all-tools",
    "--allow-all-paths", "--allow-all-urls", "--enable-all-github-mcp-tools", "--resume"]) {
    assert.equal(args.includes(flag), false);
  }
  assert.equal(options.timeout, 120_000);
  assert.equal(options.maxBuffer, 1024 * 1024);
  assert.equal(options.cwd, join(fixture.dest, "workspace"));
  assert.equal(statSync(options.cwd).mode & 0o777, 0o700);
  assert.equal(options.env.NODE_OPTIONS, undefined);
  assert.equal(options.env.AWS_SECRET_ACCESS_KEY, undefined);
  for (const path of Object.values(response.artifacts)) assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(statSync(fixture.dest).mode & 0o777, 0o700);
  assert.equal(readFileSync(response.artifacts.response, "utf8"), jsonl());
  await assert.rejects(realCopilot({ ...fixture, prompt: "Again" }, {
    repositoryRoot: fixture.repositoryRoot, run() { assert.fail("Never reuse a destination."); },
  }), /already exists/);
});

test("usage normalization keeps absent and invalid observations null, not zero or dollars", () => {
  const empty = {
    model: null, models: [], inputTokens: null, outputTokens: null, cachedInputTokens: null,
    cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null,
    premiumRequestCost: null, totalNanoAiu: null, totalApiDurationMs: null, totalUserRequests: null,
    aiCredits: null, dollarCost: null,
  };
  for (const usage of [null, undefined, [], {}, { inputTokens: "0", outputTokens: -1, aiCredits: Infinity },
    { token_count: 99, cost: 3.5, model: "Bearer-private-value with spaces" }]) {
    assert.deepEqual(normalizeUsage(usage), empty);
  }
  assert.deepEqual(normalizeUsage({ usage: {
    model: "selected-model", input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, ai_credits: 0,
  } }), {
    ...empty, model: "selected-model", models: ["selected-model"], inputTokens: 0, outputTokens: 0,
    cachedInputTokens: 0, cacheReadTokens: 0, aiCredits: 0,
  });
  assert.equal(normalizeUsage({ model: "ghp_abcdefghijklmnopqrstuv" }).model, null);
  assert.equal(normalizeUsage({ inputTokens: 1.5 }).inputTokens, null);
});

test("verified CLI usage takes authoritative model totals without adding duplicated agent or cache subsets", () => {
  const modelMetrics = {
    "gpt-5.6-sol": {
      requests: { count: 1, cost: 1 },
      usage: { inputTokens: 12468, outputTokens: 9, cacheReadTokens: 0, cacheWriteTokens: 12465, reasoningTokens: 0 },
      totalNanoAiu: 6251700000,
      tokenDetails: { input: { tokenCount: 3 }, cache_write: { tokenCount: 12465 }, output: { tokenCount: 9 } },
    },
  };
  const result = normalizeUsage({
    totalPremiumRequestCost: 1, totalUserRequests: 1, totalNanoAiu: 6251700000, totalApiDurationMs: 2939,
    currentModel: "gpt-5.6-sol", modelMetrics,
    tokenDetails: modelMetrics["gpt-5.6-sol"].tokenDetails,
    agentMetrics: { main: { modelMetrics, totalNanoAiu: 6251700000, totalApiDurationMs: 2939 } },
    lastCallInputTokens: 12468, lastCallOutputTokens: 9,
    dollarCost: 99,
  });
  assert.deepEqual(result, {
    model: "gpt-5.6-sol", models: ["gpt-5.6-sol"],
    inputTokens: 12468, outputTokens: 9, cachedInputTokens: 0, cacheReadTokens: 0,
    cacheWriteTokens: 12465, reasoningTokens: 0, premiumRequestCost: 1,
    totalNanoAiu: 6251700000, totalApiDurationMs: 2939, totalUserRequests: 1,
    aiCredits: null, dollarCost: null,
  });
});

test("per-model usage aggregation retains missing fields and zero values without fallback or invented units", () => {
  const first = { usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 7, reasoningTokens: 0 } };
  const second = { usage: { inputTokens: 20, outputTokens: 4, cacheReadTokens: 3, reasoningTokens: 1 } };
  const result = normalizeUsage({
    modelMetrics: { "observed-a": first, "observed-b": second },
    totalPremiumRequestCost: 0, totalNanoAiu: 0, totalApiDurationMs: 0, totalUserRequests: 0,
    inputTokens: 5000, cacheWriteTokens: 6000,
    tokenDetails: { input: { tokenCount: 50000 } },
    agentMetrics: { main: { modelMetrics: { "observed-a": first, "observed-b": second } } },
  });
  assert.equal(result.model, null);
  assert.deepEqual(result.models, ["observed-a", "observed-b"]);
  assert.equal(result.inputTokens, 30);
  assert.equal(result.outputTokens, 4);
  assert.equal(result.cachedInputTokens, 3);
  assert.equal(result.cacheWriteTokens, null);
  assert.equal(result.reasoningTokens, 1);
  assert.equal(result.premiumRequestCost, 0);
  assert.equal(result.totalNanoAiu, 0);
  assert.equal(result.totalApiDurationMs, 0);
  assert.equal(result.totalUserRequests, 0);
  assert.equal(result.aiCredits, null);
  assert.equal(result.dollarCost, null);
  assert.equal(normalizeUsage({ modelMetrics: {}, inputTokens: 99 }).inputTokens, null);
  assert.equal(normalizeUsage({ tokenDetails: { input: { tokenCount: 3 } } }).inputTokens, null);
  assert.equal(normalizeUsage({ agentMetrics: { main: { modelMetrics: { "observed-a": first } } } }).inputTokens, null);
  assert.equal(normalizeUsage({ modelMetrics: {
    a: { usage: { inputTokens: Number.MAX_SAFE_INTEGER } }, b: { usage: { inputTokens: 1 } },
  } }).inputTokens, null);
  assert.deepEqual(normalizeUsage({ modelMetrics: { "ghp_abcdefghijklmnopqrstuv": first } }).models, []);
});

test("answers allow only one entire JSON object, optionally fenced", () => {
  assert.deepEqual(parseAnswer(' {"ok":true} \n'), { ok: true });
  assert.deepEqual(parseAnswer('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseAnswer('```\n{"ok":true}\n```'), { ok: true });
  for (const invalid of ['hello {"ok":true}', '{"ok":true} goodbye', '{"a":1} {"b":2}',
    'before\n```json\n{"ok":true}\n```', '```json\n{"ok":true}\n```\nafter', "[]", "null", '"text"', "{"]) {
    assert.throws(() => parseAnswer(invalid));
  }
});

test("JSONL extracts lossless final content, never a result wrapper or terminal line repair", () => {
  const answer = { text: "alphabet".repeat(40), code: 'const text = "hello";\nconst next = "\\n";\n' };
  const events = jsonlEvents(JSON.stringify(answer));
  events[2].answer = { text: "untrusted result wrapper" };
  events.unshift({ type: "user.message", data: { content: '{"spoofed":"answer"}', apiCallId: "private-id" } });
  assert.deepEqual(parseJsonlAnswer(jsonl(events)), answer);
  assert.throws(() => parseJsonlAnswer(jsonl(jsonlEvents('{"text":"literal\nnewline"}'))));
  assert.throws(() => parseJsonlAnswer('{"plain":"response"}'));
});

test("JSONL refuses ambiguous final answers, malformed events and unsuccessful or absent terminal results", () => {
  for (const mutate of [
    (events) => events.unshift(events[0]),
    (events) => { events[0].data.phase = "commentary"; },
    (events) => { events[0].data.content = {}; },
    (events) => { events[2].exitCode = 1; },
    (events) => events.pop(),
    (events) => events.push({ type: "assistant.idle", data: {} }),
    (events) => events.push({ type: "result", exitCode: 0 }),
    (events) => events.unshift(null),
  ]) {
    const events = jsonlEvents();
    mutate(events);
    assert.throws(() => parseJsonlAnswer(jsonl(events)));
  }
  assert.throws(() => parseJsonlAnswer(jsonl() + "prose"));
});

test("JSONL fails closed on any tool requests, tool execution or unverified available-tool telemetry", () => {
  for (const mutate of [
    (events) => { events[0].data.toolRequests.push({ name: "bash" }); },
    (events) => { delete events[0].data.toolRequests; },
    (events) => events.unshift({ type: "tool.execution_start", data: {} }),
    (events) => events.unshift({ type: "tool.execution_end", data: {} }),
    (events) => events.unshift({ type: "tool.execution_complete", data: {} }),
    (events) => events.unshift({ type: "assistant.tool_call", data: {} }),
    (events) => events.unshift({ type: "model.call_finished", data: { containsBuiltInFileEditRequest: true } }),
    (events) => { events[1].data.promptCacheBreakState[0].models.observed.tool_count = 19; },
    (events) => { events[1].data.promptCacheBreakState[0].models.observed.tools.push({ name: "view" }); },
    (events) => { delete events[1].data.promptCacheBreakState[0].models.observed.tool_count; },
    (events) => { events[1].data.promptCacheBreakState[0].models.observed.tools_truncated = 1; },
    (events) => { events[1].data.promptCacheBreakState[0].models.other = { tool_count: 1, tools: [] }; },
    (events) => { events[1].data.promptCacheBreakState = []; },
    (events) => events.splice(1, 1),
  ]) {
    const events = jsonlEvents();
    mutate(events);
    assert.throws(() => parseJsonlAnswer(jsonl(events)), (error) => error.code?.startsWith("TOOL_"));
  }
});

test("Copilot tool isolation failure preserves private JSONL but returns no answer", async (t) => {
  const fixture = paths(t);
  const events = jsonlEvents();
  events[1].data.promptCacheBreakState[0].models.observed = {
    tool_count: 19, tools: [{ name: "bash" }], tools_truncated: 0, privateRequestId: "private-id",
  };
  const result = await rejectedCall({ ...fixture, prompt: "Synthetic" }, {
    repositoryRoot: fixture.repositoryRoot, run: () => jsonl(events),
  });
  assert.equal(result.status, "safety-violation");
  assert.equal(result.failure.code, "TOOL_ISOLATION_UNVERIFIED");
  assert.equal(result.answer, null);
  assert.equal(result.metrics.noToolsVerified, false);
  assert.equal(readFileSync(result.artifacts.response, "utf8"), jsonl(events));
  assert.equal(JSON.stringify(result).includes("private-id"), false);
});

test("Copilot failures and timeout preserve partial private evidence without success fallback", async (t) => {
  for (const [name, execution, expected] of [
    ["timeout", { stdout: '{"untrusted":"partial"}', stderr: "private failure", code: "ETIMEDOUT", status: null }, "timeout"],
    ["nonzero", { stdout: '{"not":"success"}', stderr: "failure", status: 1 }, "error"],
    ["limit", { stdout: "partial", code: "ENOBUFS" }, "output-limit"],
  ]) {
    await t.test(name, async (t) => {
      const fixture = paths(t);
      let count = 0;
      const result = await rejectedCall({ ...fixture, prompt: "Synthetic" }, {
        repositoryRoot: fixture.repositoryRoot,
        run() { count++; throw Object.assign(new Error("Do not publish arbitrary private message"), execution); },
      });
      assert.equal(result.status, expected);
      assert.equal(result.answer, null);
      assert.equal(result.metrics.inputTokens, null);
      assert.equal(result.metrics.usageStatus, "missing");
      assert.equal(count, 1);
      assert.equal(JSON.stringify(result).includes("private failure"), false);
      assert.equal(readFileSync(result.artifacts.response, "utf8"), execution.stdout);
      assert.equal(JSON.parse(readFileSync(result.artifacts.result, "utf8")).status, expected);
    });
  }
});

test("Copilot malformed JSON and oversized responses are rejected", async (t) => {
  for (const [stdout, expected] of [["not JSON", "invalid-response"], ["x".repeat(1024 * 1024 + 1), "output-limit"]]) {
    await t.test(expected, async (t) => {
      const fixture = paths(t);
      const result = await rejectedCall({ ...fixture, prompt: "Synthetic" }, {
        repositoryRoot: fixture.repositoryRoot, run: () => stdout,
      });
      assert.equal(result.status, expected);
      assert.equal(result.answer, null);
      assert.ok(statSync(result.artifacts.response).size <= 1024 * 1024);
    });
  }
});

test("Copilot validates timeout, new destination containment and repository exclusion before running", async (t) => {
  const fixture = paths(t);
  const injections = { repositoryRoot: fixture.repositoryRoot, run() { assert.fail("Validation must precede spawning."); } };
  for (const timeoutMs of [0, -1, 180_001, Infinity, 1.5]) {
    await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", timeoutMs }, injections), /timeout/);
  }
  await assert.rejects(realCopilot({ ...fixture, prompt: "" }, injections), /prompt/);
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", cwd: "." }, injections), /absolute/);
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", cwd: fixture.repositoryRoot }, injections), /outside/);
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", dest: join(fixture.repositoryRoot, "call") }, injections), /outside/);
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", cwd: fixture.empty }, injections), /contained/);
  symlinkSync(fixture.empty, join(fixture.root, "alias"));
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", cwd: join(fixture.root, "alias") }, injections), /symlink/);
  await assert.rejects(realCopilot({ ...fixture, prompt: "Synthetic", dest: join(fixture.root, "alias", "call") }, injections), /symlink/);
});

test("sandbox applies all isolation restrictions, resolves immutable image and cleans exact owned ID", (t) => {
  const fixture = dockerFixture(t);
  const result = runSandbox({ ...fixture, image, args: ["--test", "tests/example.test.mjs"] }, fixture);
  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.imageId, imageId);
  assert.equal(result.cleaned, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, "tests passed\n");
  assert.equal(result.stderr, "diagnostic\n");
  const args = fixture.calls.find((call) => call.args[0] === "create").args;
  for (const [flag, value] of Object.entries({
    "--network": "none", "--cap-drop": "ALL", "--security-opt": "no-new-privileges",
    "--pids-limit": "64", "--memory": "256m", "--cpus": "1", "--user": "65534:65534",
    "--workdir": "/tmp", "--entrypoint": "node", "--pull": "never",
    "--tmpfs": "/tmp:rw,nosuid,noexec,size=64m,mode=1777",
  })) assert.equal(args[args.indexOf(flag) + 1], value);
  assert.ok(args.includes("--read-only"));
  assert.ok(args.includes(`type=bind,source=${fixture.workspace},target=/work,readonly`));
  assert.ok(args.includes(`type=bind,source=${fixture.oracleRoot},target=/oracle,readonly`));
  assert.deepEqual(args.slice(-3), [imageId, "--test", "/work/tests/example.test.mjs"]);
  assert.equal(args.includes("--env"), false);
  assert.equal(args.includes("--env-file"), false);
  for (const call of fixture.calls) {
    assert.deepEqual(Object.keys(call.options.env).sort(), ["LANG", "PATH"]);
    assert.ok(call.options.timeout <= 30_000);
    assert.equal(call.options.maxBuffer, 1024 * 1024);
  }
  assert.ok(fixture.calls.some((call) => call.args.join(" ") === `container rm --force ${containerId}`));
});

test("sandbox rejects mutable images, unsafe paths and arbitrary Node entry points", (t) => {
  const fixture = paths(t);
  const run = () => assert.fail("Invalid input must not invoke Docker.");
  for (const mutable of ["node:24", "node", `node:24@sha256:${"a".repeat(64)}`, "--privileged", "sha256:bad"]) {
    assert.throws(() => runSandbox({ ...fixture, image: mutable, args: ["--test"] }, { run }), /immutable/);
  }
  assert.equal(immutableImage(image), image);
  assert.equal(immutableImage(imageId), imageId);
  assert.equal(immutableImage(`registry.example:5000/a/node@sha256:${"a".repeat(64)}`).startsWith("registry"), true);
  for (const args of [[], ["-e", "evil()"], ["--test", "--eval=evil()"], ["--test", "../escape.mjs"],
    ["--test", "/etc/passwd"], ["/oracle/oracle.mjs", "--inspect"], ["/work/script.mjs"], ["--test", "a\0b"],
    ["--test", "foo,bar"], "--test"]) {
    assert.throws(() => runSandbox({ ...fixture, image, args }, { run }), /arguments|allowed/);
  }
  for (const workspace of [".", "/", `${fixture.workspace},readonly=false`, fixture.oracleRoot]) {
    assert.throws(() => runSandbox({ ...fixture, image, workspace, args: ["--test"] }, { run }));
  }
  symlinkSync(fixture.workspace, join(fixture.root, "alias"));
  assert.throws(() => runSandbox({ ...fixture, image, workspace: join(fixture.root, "alias"), args: ["--test"] }, { run }));
  for (const timeoutMs of [0, 180_001, 1.5]) {
    assert.throws(() => runSandbox({ ...fixture, image, args: ["--test"], timeoutMs }, { run }), /timeout/);
  }
});

test("sandbox test failures remain evidence, not Docker infrastructure failures", (t) => {
  const fixture = dockerFixture(t, {
    start(info) {
      info.State.ExitCode = 1;
      throw Object.assign(new Error("test failed"), { status: 1, stdout: "not ok 1", stderr: "assertion" });
    },
  });
  const result = runSandbox({ ...fixture, image, args: ["/oracle/oracle.mjs", "product", "/work"] }, fixture);
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.equal(result.timedOut, false);
  assert.equal(result.cleaned, true);
  assert.equal(result.stdout, "not ok 1");
  assert.equal(result.stderr, "assertion");
  assert.equal(result.failure, null);
});

test("sandbox accepts the fixed TAP reporter and canonical trailing mount separator", (t) => {
  const fixture = dockerFixture(t);
  const args = ["--test", "--test-reporter=tap", "/work/tests/example.test.mjs"];
  const result = runSandbox({ ...fixture, oracleRoot: fixture.oracleRoot + "/", image, args }, fixture);
  assert.equal(result.status, "passed");
  assert.deepEqual(fixture.calls.find((call) => call.args[0] === "create").args.slice(-3), args);
});

test("sandbox rejects resource exhaustion and dead containers as infrastructure failures", async (t) => {
  for (const state of [{ OOMKilled: true }, { Status: "dead" }]) {
    await t.test(JSON.stringify(state), (t) => {
      const fixture = dockerFixture(t, {
        start(info) { Object.assign(info.State, state); return ""; },
      });
      const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
      assert.equal(result.status, "infrastructure-error");
      assert.equal(result.exitCode, null);
      assert.equal(result.cleaned, true);
    });
  }
});

test("sandbox mismatched start client errors are infrastructure failures", (t) => {
  const fixture = dockerFixture(t, {
    start() { throw Object.assign(new Error("daemon unavailable"), { status: 125, stderr: "daemon unavailable" }); },
  });
  const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
  assert.equal(result.status, "infrastructure-error");
  assert.equal(result.exitCode, null);
  assert.equal(result.cleaned, true);
  assert.equal(result.failure.clientExitCode, 125);
});

test("sandbox reconciles create timeout after daemon creation and cleans by verified ID", (t) => {
  const fixture = dockerFixture(t, {
    create() { throw Object.assign(new Error("client timeout"), { code: "ETIMEDOUT" }); },
  });
  const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
  assert.equal(result.status, "timeout");
  assert.equal(result.exitCode, null);
  assert.equal(result.timedOut, true);
  assert.equal(result.cleaned, true);
  assert.equal(result.containerId, containerId);
  assert.equal(result.failure.phase, "create");
  assert.equal(fixture.calls.some((call) => call.args[0] === "start"), false);
  assert.ok(fixture.calls.some((call) => call.args.join(" ") === `container rm --force ${containerId}`));
});

test("sandbox start timeout cleans the owned running container", (t) => {
  const fixture = dockerFixture(t, {
    start(info) {
      info.State.Running = true;
      info.State.Status = "running";
      throw Object.assign(new Error("client timeout"), { code: "ETIMEDOUT", stdout: "partial\n" });
    },
  });
  const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
  assert.equal(result.status, "timeout");
  assert.equal(result.exitCode, null);
  assert.equal(result.cleaned, true);
  assert.equal(result.stdout, "partial\n");
  assert.equal(result.failure.phase, "start");
});

test("sandbox shares one setup and execution deadline and never starts after expiry", (t) => {
  const fixture = dockerFixture(t);
  let clock = 0;
  let execution = true;
  const result = runSandbox({ ...fixture, image, args: ["--test"], timeoutMs: 100 }, {
    now: () => clock,
    run(command, args, options) {
      const response = fixture.run(command, args, options);
      if (execution) {
        clock += args[0] === "container" ? 50 : 25;
        if (clock === 100) execution = false;
      } else clock += 1;
      return response;
    },
  });
  assert.equal(result.status, "timeout");
  assert.equal(result.failure.phase, "inspect-created");
  assert.equal(result.timedOut, true);
  assert.equal(result.executionBudgetMs, 100);
  assert.equal(result.executionWallMs, 100);
  assert.equal(result.cleaned, true);
  assert.equal(result.cleanupBudgetMs, 10_000);
  assert.ok(result.cleanupWallMs > 0);
  assert.equal(result.cleanupTimedOut, false);
  assert.equal(fixture.calls.some((call) => call.args[0] === "start"), false);
  assert.deepEqual(fixture.calls.slice(0, 3).map((call) => call.options.timeout), [100, 75, 50]);
  assert.equal(fixture.calls[3].options.timeout, 10_000);
});

test("sandbox passes only the remaining execution budget to docker start", (t) => {
  const fixture = dockerFixture(t);
  let clock = 0;
  const result = runSandbox({ ...fixture, image, args: ["--test"], timeoutMs: 100 }, {
    now: () => clock,
    run(command, args, options) {
      try { return fixture.run(command, args, options); } finally {
        clock += args[0] === "image" ? 10 : args[0] === "create" ? 15 : args[0] === "start" ? 50 : 5;
      }
    },
  });
  assert.equal(result.status, "passed");
  assert.equal(fixture.calls.find((call) => call.args[0] === "start").options.timeout, 70);
  assert.equal(result.executionWallMs, 85);
  assert.equal(result.cleanupWallMs, 20);
  assert.equal(result.wallMs, 105);
});

test("sandbox reconciles creation completing after the shared deadline without starting it", (t) => {
  const fixture = dockerFixture(t);
  let clock = 0;
  const result = runSandbox({ ...fixture, image, args: ["--test"], timeoutMs: 100 }, {
    now: () => clock,
    run(command, args, options) {
      const response = fixture.run(command, args, options);
      if (args[0] === "create") clock = 100;
      return response;
    },
  });
  assert.equal(result.status, "timeout");
  assert.equal(result.failure.phase, "create");
  assert.equal(result.cleaned, true);
  assert.equal(result.containerId, containerId);
  assert.equal(fixture.calls.some((call) => call.args[0] === "start"), false);
});

test("sandbox cleanup has one separate bounded allowance and reports unresolved timeout", (t) => {
  let clock = 0;
  let cleanup = false;
  const fixture = dockerFixture(t, {
    start() {
      clock = 100;
      cleanup = true;
      throw Object.assign(new Error("execution expired"), { code: "ETIMEDOUT" });
    },
  });
  const result = runSandbox({ ...fixture, image, args: ["--test"], timeoutMs: 100 }, {
    now: () => clock,
    run(command, args, options) {
      const response = fixture.run(command, args, options);
      if (cleanup && args[0] === "container") clock += 10_000;
      return response;
    },
  });
  assert.equal(result.status, "infrastructure-error");
  assert.equal(result.cleaned, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.cleanupTimedOut, true);
  assert.equal(result.cleanupBudgetMs, 10_000);
  assert.equal(result.cleanupWallMs, 10_000);
  assert.equal(result.cleanupFailure.code, "ETIMEDOUT");
  assert.equal(fixture.calls.some((call) => call.args[1] === "rm"), false);
});

test("sandbox refuses cleanup after identity, mounts, image or label substitution", async (t) => {
  for (const [name, mutate] of [
    ["identity", (info) => { info.Id = "d".repeat(64); }],
    ["name", (info) => { info.Name = "/accepted-demo"; }],
    ["label", (info) => { info.Config.Labels = {}; }],
    ["image", (info) => { info.Image = `sha256:${"e".repeat(64)}`; }],
    ["mount", (info) => { info.Mounts[0].RW = true; }],
    ["extra-mount", (info) => { info.Mounts.push({ Type: "bind", Destination: "/host" }); }],
  ]) {
    await t.test(name, (t) => {
      const fixture = dockerFixture(t, {
        start(info) { mutate(info); throw Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }); },
      });
      const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
      assert.equal(result.status, "infrastructure-error");
      assert.equal(result.cleaned, false);
      assert.equal(result.timedOut, true);
      assert.equal(result.cleanupFailure.code, "OWNERSHIP_MISMATCH");
      assert.equal(fixture.calls.some((call) => call.args[1] === "rm"), false);
    });
  }
});

test("sandbox unresolved create and failed removal never claim cleanup success", async (t) => {
  await t.test("create error and unavailable daemon", (t) => {
    const fixture = dockerFixture(t, {
      create() { throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }); },
      inspect() { throw new Error("Cannot connect to daemon"); },
    });
    const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
    assert.equal(result.cleaned, false);
    assert.equal(result.status, "infrastructure-error");
    assert.equal(result.failure.phase, "create");
  });
  await t.test("rm returns without removing resource", (t) => {
    const fixture = dockerFixture(t, { remove: () => "" });
    const result = runSandbox({ ...fixture, image, args: ["--test"] }, fixture);
    assert.equal(result.cleaned, false);
    assert.equal(result.status, "infrastructure-error");
    assert.equal(result.cleanupFailure.phase, "cleanup");
  });
});

test("sandbox allows cleanup only after explicit exact-name absence for pre-creation failure", (t) => {
  const fixture = paths(t);
  let attemptedName;
  const result = runSandbox({ ...fixture, image, args: ["--test"] }, {
    run(command, args) {
      if (args[0] === "image") return JSON.stringify([{ Id: imageId }]);
      if (args[0] === "create") {
        attemptedName = args[args.indexOf("--name") + 1];
        throw new Error("create unavailable");
      }
      assert.deepEqual(args, ["container", "inspect", attemptedName]);
      throw Object.assign(new Error("not found"), { stderr: `Error response from daemon: No such container: ${attemptedName}` });
    },
  });
  assert.equal(result.status, "infrastructure-error");
  assert.equal(result.cleaned, true);
  assert.equal(result.exitCode, null);
});
