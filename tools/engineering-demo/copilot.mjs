import { spawn } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { redact } from "../trace-viewer/trace-model.mjs";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const outputLimit = 1024 * 1024;
// Verified on CLI 1.0.89-3: an empty available-tools restores defaults, and a
// nonempty allowlist overrides exclusions. Exclude these observed tools only;
// structured zero-tool telemetry is still mandatory for every accepted call.
const excludedTools = [
  "bash", "read_bash", "stop_bash", "list_bash", "apply_patch", "view", "web_fetch",
  "fetch_copilot_cli_documentation", "skill", "run_factory", "factories_manage", "sql",
  "session_store_sql", "read_agent", "list_agents", "write_agent", "rg", "glob", "task",
];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const within = (root, path) => {
  const part = relative(root, path);
  return part === "" || (!isAbsolute(part) && part !== ".." && !part.startsWith("../"));
};

export function parseAnswer(raw) {
  let text = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (fenced) text = fenced[1];
  const answer = JSON.parse(text);
  if (!object(answer)) throw new Error("Copilot must return one JSON object.");
  return answer;
}

export function parseJsonlAnswer(raw) {
  const events = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  if (events.some((event) => !object(event) || typeof event.type !== "string")) {
    throw new Error("Copilot output must contain only structured events.");
  }
  const results = events.filter((event) => event.type === "result");
  const messages = events.filter((event) => event.type === "assistant.message");
  if (results.length !== 1 || events.at(-1) !== results[0] || results[0].exitCode !== 0 ||
      messages.length !== 1 || messages[0].data?.phase !== "final_answer" ||
      typeof messages[0].data?.content !== "string") {
    throw new Error("Copilot must emit one final assistant message and a terminal successful result.");
  }
  if (events.some((event) =>
    /^(?:tool\.|tool_|assistant\.tool)|tool[._](?:execution|call|request)/i.test(event.type) ||
    event.data?.containsBuiltInFileEditRequest === true ||
    (event.data?.toolRequests !== undefined &&
      (!Array.isArray(event.data.toolRequests) || event.data.toolRequests.length !== 0))) ||
      !Array.isArray(messages[0].data.toolRequests)) {
    throw Object.assign(new Error("Copilot tool activity is forbidden."), { code: "TOOL_ACTIVITY_DETECTED" });
  }
  const checkpoints = events.filter((event) => event.type === "session.usage_checkpoint");
  let models = 0;
  for (const checkpoint of checkpoints) {
    const states = checkpoint.data?.promptCacheBreakState;
    if (!Array.isArray(states) || states.length === 0) {
      throw Object.assign(new Error("Missing tool configuration telemetry."), { code: "TOOL_ISOLATION_UNVERIFIED" });
    }
    for (const state of states) {
      const entries = object(state.models) ? Object.values(state.models) : [];
      if (!entries.length || entries.some((entry) => entry?.tool_count !== 0 ||
          !Array.isArray(entry?.tools) || entry.tools.length !== 0 || entry.tools_truncated !== 0)) {
        throw Object.assign(new Error("Zero available tools were not verified."), { code: "TOOL_ISOLATION_UNVERIFIED" });
      }
      models += entries.length;
    }
  }
  if (!models) throw Object.assign(new Error("Missing tool configuration telemetry."), { code: "TOOL_ISOLATION_UNVERIFIED" });
  return parseAnswer(messages[0].data.content);
}

export function normalizeUsage(value) {
  const sources = object(value) ? [value, ...(object(value.usage) ? [value.usage] : [])] : [];
  const validNumber = (item, integer = true) => typeof item === "number" && Number.isFinite(item) &&
    item >= 0 && (!integer || Number.isSafeInteger(item));
  const number = (names, integer = true) => {
    for (const source of sources) {
      for (const name of names) {
        const item = source[name];
        if (validNumber(item, integer)) return item;
      }
    }
    return null;
  };
  const safeModel = (item) => typeof item === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(item) && redact(item) === item;
  const hasModelMetrics = object(value?.modelMetrics);
  const modelEntries = hasModelMetrics ? Object.entries(value.modelMetrics) : [];
  const models = modelEntries.map(([name]) => name).filter(safeModel);
  const model = [value?.currentModel, ...sources.map((source) => source.model),
    ...(models.length === 1 ? models : [])].find(safeModel) ?? null;
  if (!models.length && model) models.push(model);
  const modelTokenTotal = (name) => {
    const values = modelEntries.map(([, metrics]) => metrics?.usage?.[name]);
    if (!values.length || !values.every((item) => validNumber(item))) return null;
    const total = values.reduce((sum, item) => sum + item, 0);
    return validNumber(total) ? total : null;
  };
  // modelMetrics contains total input, including cache subsets. agentMetrics
  // duplicates these observations; tokenDetails.input is uncached input only.
  const tokens = (name, aliases) => hasModelMetrics ? modelTokenTotal(name) : number(aliases);
  const cacheReadTokens = tokens("cacheReadTokens",
    ["cacheReadTokens", "cachedInputTokens", "cached_input_tokens", "cache_read_input_tokens"]);
  return {
    model, models,
    inputTokens: tokens("inputTokens", ["inputTokens", "input_tokens"]),
    outputTokens: tokens("outputTokens", ["outputTokens", "output_tokens"]),
    cachedInputTokens: cacheReadTokens, cacheReadTokens,
    cacheWriteTokens: tokens("cacheWriteTokens", ["cacheWriteTokens", "cache_write_input_tokens"]),
    reasoningTokens: tokens("reasoningTokens", ["reasoningTokens", "reasoning_tokens"]),
    premiumRequestCost: number(["totalPremiumRequestCost", "premiumRequestCost"], false),
    totalNanoAiu: number(["totalNanoAiu"]),
    totalApiDurationMs: number(["totalApiDurationMs"], false),
    totalUserRequests: number(["totalUserRequests"]),
    aiCredits: number(["aiCredits", "ai_credits"], false),
    dollarCost: null,
  };
}

function callEnvironment() {
  const names = ["PATH", "HOME", "XDG_CONFIG_HOME", "GH_TOKEN", "GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN"];
  return { ...Object.fromEntries(names.filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]])), NO_COLOR: "1" };
}

// A dedicated process group bounds cancellation to this call and its descendants.
function boundedSpawn(command, args, options) {
  return new Promise((resolveResult) => {
    const started = performance.now();
    let child;
    let timer;
    let bytes = 0;
    let reason;
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (exitCode, signal, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
        stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode, signal: signal ?? null, code: reason ?? code ?? null,
        timedOut: reason === "ETIMEDOUT", wallMs: performance.now() - started,
      });
    };
    const cancel = (code) => {
      reason ??= code;
      try { process.kill(-child.pid, "SIGKILL"); } catch (error) {
        if (error.code !== "ESRCH") {
          reason = "CANCELLATION_FAILED";
          child.kill("SIGKILL");
        }
      }
    };
    const collect = (chunks, chunk) => {
      const remaining = Math.max(0, options.maxBuffer - bytes);
      chunks.push(chunk.subarray(0, remaining));
      bytes += chunk.length;
      if (bytes > options.maxBuffer) cancel("ENOBUFS");
    };
    try {
      child = spawn(command, args, {
        cwd: options.cwd, env: options.env, detached: true, shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => collect(stdout, chunk));
      child.stderr.on("data", (chunk) => collect(stderr, chunk));
      child.once("error", (error) => finish(null, null, error.code ?? "SPAWN_ERROR"));
      child.once("close", (code, signal) => finish(code, signal));
      timer = setTimeout(() => cancel("ETIMEDOUT"), options.timeout);
    } catch (error) {
      finish(null, null, error.code ?? "SPAWN_ERROR");
    }
  });
}

function validatePaths(cwd, dest, repositoryRoot) {
  if (typeof cwd !== "string" || typeof dest !== "string" || !isAbsolute(cwd) || !isAbsolute(dest) ||
      /[\x00-\x1f\x7f]/.test(cwd + dest)) throw new Error("Use absolute call cwd and destination paths.");
  const root = realpathSync(repositoryRoot);
  const directory = realpathSync(cwd);
  const parent = realpathSync(dirname(dest));
  const destination = join(parent, basename(dest));
  if (directory !== resolve(cwd) || parent !== resolve(dirname(dest)) ||
      within(root, directory) || within(root, destination) || !within(directory, destination) ||
      directory === destination || directory === "/" || !lstatSync(directory).isDirectory()) {
    throw new Error("Call destination must be contained by its external cwd parent, outside the repository and without symlink aliases.");
  }
  try {
    lstatSync(destination);
    throw new Error("Call destination already exists.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { directory, destination };
}

export async function realCopilot({ prompt, cwd, dest, timeoutMs = 120_000 },
  { run = boundedSpawn, repositoryRoot = sourceRoot } = {}) {
  if (typeof prompt !== "string" || !prompt.trim() || Buffer.byteLength(prompt) > outputLimit) {
    throw new Error("Supply a nonempty bounded synthetic prompt.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 180_000) {
    throw new Error("Copilot timeout must be between 1 and 180000 milliseconds.");
  }
  if (process.platform === "win32" && run === boundedSpawn) {
    throw new Error("Bounded Copilot cancellation requires a POSIX process group.");
  }
  const { destination } = validatePaths(cwd, dest, repositoryRoot);
  mkdirSync(destination, { mode: 0o700 });
  const directory = join(destination, "workspace");
  mkdirSync(directory, { mode: 0o700 });
  const artifacts = {
    response: join(destination, "response.raw.jsonl"),
    usage: join(destination, "usage.raw.json"),
    stderr: join(destination, "stderr.raw.txt"),
    result: join(destination, "result.json"),
  };
  for (const path of Object.values(artifacts)) writeFileSync(path, "", { flag: "wx", mode: 0o600 });
  const started = performance.now();
  let execution;
  try {
    execution = await run("copilot", [
      "--no-custom-instructions", "--no-auto-update", "--no-ask-user",
      "--disable-builtin-mcps", "--excluded-tools", ...excludedTools, "--deny-tool=write", "--deny-tool=shell",
      "--silent", "--stream", "off", "--output-format", "json", "--usage-output-file", artifacts.usage, "-p", prompt,
    ], { cwd: directory, timeout: timeoutMs, maxBuffer: outputLimit, env: callEnvironment(), killSignal: "SIGKILL" });
    if (typeof execution === "string" || Buffer.isBuffer(execution)) {
      execution = { stdout: String(execution), stderr: "", exitCode: 0 };
    }
  } catch (error) {
    execution = {
      stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.status ?? null,
      signal: error.signal ?? null, code: error.code ?? "EXECUTION_ERROR",
      timedOut: error.code === "ETIMEDOUT",
    };
  }
  const wallMs = Math.max(0, Math.round(performance.now() - started));
  const stdout = Buffer.from(String(execution?.stdout ?? ""));
  const stderr = Buffer.from(String(execution?.stderr ?? ""));
  writeFileSync(artifacts.response, stdout.subarray(0, outputLimit), { mode: 0o600 });
  writeFileSync(artifacts.stderr, stderr.subarray(0, Math.max(0, outputLimit - stdout.length)), { mode: 0o600 });
  let usage = null;
  let usageStatus = "missing";
  try {
    const stat = lstatSync(artifacts.usage);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe usage file.");
    chmodSync(artifacts.usage, 0o600);
    if (stat.size > outputLimit) usageStatus = "output-limit";
    else if (stat.size) {
      usage = JSON.parse(readFileSync(artifacts.usage, "utf8"));
      usageStatus = object(usage) ? "recorded" : "invalid";
    }
  } catch (error) {
    usageStatus = error.code === "ENOENT" ? "missing" : "invalid";
  }
  let status = execution?.timedOut || execution?.code === "ETIMEDOUT" ? "timeout"
    : execution?.code === "ENOBUFS" || stdout.length + stderr.length > outputLimit || usageStatus === "output-limit"
      ? "output-limit"
      : execution?.exitCode !== 0 || execution?.code || execution?.signal ? "error" : "ok";
  let answer = null;
  if (status === "ok") {
    try { answer = parseJsonlAnswer(stdout.toString("utf8")); } catch (error) {
      status = error.code?.startsWith("TOOL_") ? "safety-violation" : "invalid-response";
      execution.code = error.code ?? null;
    }
  }
  const metrics = { wallMs, ...normalizeUsage(usage), usageStatus, noToolsVerified: status === "ok" };
  const failure = status === "ok" ? null : {
    phase: ["invalid-response", "safety-violation"].includes(status) ? "parse" : "execute",
    code: /^[A-Z][A-Z0-9_]{0,40}$/.test(execution?.code ?? "") ? execution.code : null,
    exitCode: Number.isInteger(execution?.exitCode) ? execution.exitCode : null,
    signal: /^SIG[A-Z0-9]+$/.test(execution?.signal ?? "") ? execution.signal : null,
  };
  const result = { answer, metrics, artifacts, status, failure };
  writeFileSync(artifacts.result, JSON.stringify({ status, metrics, failure }, null, 2) + "\n", { mode: 0o600 });
  if (status !== "ok") {
    throw Object.assign(new Error(`Copilot call failed (${status}); inspect the private call artifacts.`), {
      name: "CopilotExecutionError", status, code: failure?.code, metrics, artifacts, failure, result,
    });
  }
  return result;
}
