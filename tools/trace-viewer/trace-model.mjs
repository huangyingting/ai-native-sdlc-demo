import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

const configuredMcpServers = JSON.parse(readFileSync(new URL("../../.github/mcp.json", import.meta.url), "utf8")).mcpServers;
export const defaultPricingCatalog = JSON.parse(
  readFileSync(new URL("./model-pricing.json", import.meta.url), "utf8"));
const hashIdentifier = (name) => createHash("sha256").update(name).digest("hex");
const mcpToolNames = new Map(Object.entries(configuredMcpServers).flatMap(([server, config]) =>
  config.tools.flatMap((tool) => [
    [`${hashIdentifier(server)}/${hashIdentifier(tool).slice(0, 35)}`, `${server}/${tool}`],
    [`${server}-${tool}`, `${server}/${tool}`],
  ])));

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const FILE_OUTPUT_PATTERN = /Output too large to read at once \([^)]*\)\.\s*Saved to:\s*(.+?copilot-tool-output-[\w-]+\.txt)(?:\r?\n|$)/i;

function normalizedModelName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(?:models\/|(?:openai|anthropic|google|xai|microsoft|moonshot|github(?:-copilot)?)[/:])/i, "")
    .replace(/\s*\((?:preview|fast mode)\)\s*/g, "-")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function pricingIndex(catalog) {
  const entries = Object.entries(catalog?.models ?? catalog ?? {});
  const index = new Map();
  for (const [name, price] of entries) {
    if (!price?.default) continue;
    const tier = (rates, tierName) => {
      const normalized = Object.fromEntries(["input", "cachedInput", "cacheWrite", "output"].map((field) => {
        const number = Number(rates?.[field] ?? 0);
        if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${tierName} ${field} price for model ${name}`);
        return [field, number];
      }));
      return normalized;
    };
    const threshold = Number(price.longContextThreshold ?? Number.MAX_SAFE_INTEGER);
    if (!Number.isFinite(threshold) || threshold < 0) throw new Error(`Invalid long-context threshold for model ${name}`);
    const normalizedPrice = {
      ...price,
      model: name,
      longContextThreshold: threshold,
      default: tier(price.default, "default"),
      longContext: price.longContext ? tier(price.longContext, "long-context") : null,
    };
    index.set(normalizedModelName(name), normalizedPrice);
    for (const alias of price.aliases ?? []) index.set(normalizedModelName(alias), normalizedPrice);
  }
  return index;
}

function modelPricing(model, index) {
  const normalized = normalizedModelName(model);
  if (index.has(normalized)) return index.get(normalized);
  const matches = [...index.entries()]
    .filter(([name]) => normalized.includes(name))
    .sort(([left], [right]) => right.length - left.length);
  return matches[0]?.[1] ?? null;
}

function sameModel(observed, expected) {
  const withoutVersion = (name) => normalizedModelName(name).replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return withoutVersion(observed) === withoutVersion(expected);
}

function value(attribute) {
  const data = attribute?.value;
  return data?.stringValue ?? data?.intValue ?? data?.doubleValue ?? data?.boolValue;
}

function attributes(span) {
  if (!Array.isArray(span.attributes)) return span.attributes ?? {};
  return Object.fromEntries(span.attributes.map((item) => [item.key, value(item)]));
}

function safe(text, limit = 100) {
  return (redact(String(text)) ?? "").replace(/[^a-zA-Z0-9 _,./:+;=-]/g, "").slice(0, limit);
}

function nano(time) {
  if (Array.isArray(time) && time.length === 2) {
    return (BigInt(time[0]) * 1_000_000_000n + BigInt(time[1])).toString();
  }
  return time?.toString();
}

function operation(span, attrs) {
  return attrs["gen_ai.operation.name"] ?? /^(invoke_agent|execute_tool|chat)(?: |$)/.exec(span.name)?.[1];
}

function toolName(span, attrs) {
  const observed = [attrs["gen_ai.tool.name"], span.name.replace(/^execute_tool ?/, "")];
  for (const candidate of observed) {
    if (mcpToolNames.has(candidate)) return mcpToolNames.get(candidate);
    const digest = String(candidate ?? "").match(/[a-f0-9]{64}\/[a-f0-9]{35}/)?.[0];
    if (digest && mcpToolNames.has(digest)) return mcpToolNames.get(digest);
  }
  return String(observed[0] ?? observed[1]);
}

function timestamp(nanos) {
  return new Date(Number(BigInt(nanos) / 1_000_000n)).toISOString();
}

function elapsed(span) {
  return `${(Number(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / 1e6).toFixed(0)}ms`;
}

function allowedPayloadRoots() {
  return [...new Set([process.env.RUNNER_TEMP, tmpdir()].filter(Boolean).map((root) => resolve(root)))];
}

function isWithin(path, root) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function hydrateFileBackedOutput(content, readPayload = readFileSync) {
  if (typeof content !== "string") return content;
  const match = content.match(FILE_OUTPUT_PATTERN);
  if (!match) return content;
  const requestedPath = match[1].trim();
  const fileName = basename(requestedPath);
  if (!/^.+-copilot-tool-output-[\w-]+\.txt$/i.test(fileName) || !isAbsolute(requestedPath)) {
    return content.replace(requestedPath, fileName);
  }
  try {
    const canonicalPath = realpathSync(requestedPath);
    if (!allowedPayloadRoots().some((root) => isWithin(canonicalPath, root))) {
      return `[File-backed tool output blocked outside the runner temporary directory: ${fileName}]`;
    }
    const payload = readPayload(canonicalPath, "utf8");
    const bytes = Buffer.byteLength(payload);
    if (bytes <= MAX_PAYLOAD_BYTES) return payload;
    return `${Buffer.from(payload).subarray(0, MAX_PAYLOAD_BYTES).toString("utf8")}\n\n[Viewer safety limit: showing ${MAX_PAYLOAD_BYTES.toLocaleString()} of ${bytes.toLocaleString()} bytes]`;
  } catch {
    const preview = content.split(/Preview \(first \d+ chars\):\s*/i)[1];
    return preview
      ? `${preview}\n\n[Full file-backed output was unavailable after the tool completed: ${fileName}]`
      : `[File-backed tool output was unavailable after the tool completed: ${fileName}]`;
  }
}

function normalizePaths(text) {
  const roots = [
    [process.env.GITHUB_WORKSPACE, "[WORKSPACE]"],
    [process.env.RUNNER_WORKSPACE, "[WORKSPACE]"],
    [process.cwd(), "[WORKSPACE]"],
    [process.env.RUNNER_TEMP, "[TEMP]"],
    [tmpdir(), "[TEMP]"],
    [homedir(), "[HOME]"],
  ].filter(([root]) => root && root !== "/")
    .sort(([left], [right]) => right.length - left.length);
  for (const [root, replacement] of roots) {
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(?<![\\w/])(?:file://)?${escaped}(?=[/\\\\\\s"'\\x60),:;\\]}]|$)`, "g"), replacement);
  }
  return text
    .replace(/\b[A-Z]:[\\/]+Users[\\/]+[^\\/\s"']+(?=[\\/]|[\s"']|$)/gi, "[HOME]")
    .replace(/\b[A-Z]:[\\/]+(?:a|Windows[\\/]+Temp)(?=[\\/]|[\s"']|$)/gi, "[RUNNER]")
    .replace(/(?<![\w/])(?:file:\/\/)?\/(?:home|Users)\/[^/\s"'\\]+(?=\/|[\s"'\\]|$)/g, "[HOME]")
    .replace(/(?<![\w/])(?:file:\/\/)?\/(?:root|github\/home)(?=\/|[\s"'\\]|$)/g, "[HOME]")
    .replace(/(?<![\w/])(?:file:\/\/)?\/(?:workspaces?|__w|github\/workspace|(?:opt\/)?(?:actions-runner|runner)\/_work)(?=\/|[\s"'\\]|$)/g, "[WORKSPACE]")
    .replace(/(?<![\w/])(?:file:\/\/)?\/(?:private\/)?(?:var\/)?tmp(?=\/|[\s"'\\]|$)/g, "[TEMP]");
}

function redactAuthorization(text) {
  let result = "";
  let cursor = 0;
  const headers = /(?:proxy-)?authorization\s*(?:\\*["'])?\s*[:=]\s*(\\*["'])?/gi;
  for (const match of text.matchAll(headers)) {
    if (match.index < cursor) continue;
    const start = match.index + match[0].length;
    const delimiter = match[1];
    let end = text.length;
    if (delimiter) {
      const escapes = delimiter.length - 1;
      for (const closing of text.slice(start).matchAll(/\\*["']/g)) {
        const slashes = closing[0].length - 1;
        // Each JSON serialization doubles escapes; distinguish a closing quote from a quoted value character.
        if (closing[0].at(-1) === delimiter.at(-1) && slashes % (2 * (escapes + 1)) === escapes) {
          end = start + closing.index + slashes - escapes;
          break;
        }
      }
    } else {
      const boundary = text.slice(start).search(/[\r\n]|\\+[rn]|\\*["']/);
      if (boundary >= 0) end = start + boundary;
    }
    result += `${text.slice(cursor, start)}[REDACTED]`;
    cursor = end;
  }
  return result + text.slice(cursor);
}

export function redact(content) {
  if (content == null) return null;
  const sanitized = redactValue(content);
  return (typeof sanitized === "string" ? sanitized : JSON.stringify(sanitized, null, 2)) || null;
}

function redactText(text) {
  return normalizePaths(redactAuthorization(text)
    .replace(/(?:gh[pousr]_|github_pat_)[\w-]{12,}/gi, "[REDACTED TOKEN]")
    .replace(/Bearer\s+[\w.-]{12,}/gi, "******")
    .replace(/((?:access[_-]?token|api[_-]?key|password|secret)\s*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi,
      (_, prefix, value) => {
        const quote = ['"', "'"].includes(value[0]) ? value[0] : "";
        return `${prefix}${quote}[REDACTED]${quote}`;
      }));
}

function redactValue(value) {
  if (typeof value === "string") {
    if (["{", "[", '"'].includes(value.trimStart()[0])) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        return redactText(value);
      }
      const sanitized = JSON.stringify(redactValue(parsed));
      return sanitized === JSON.stringify(parsed) ? value : sanitized;
    }
    return redactText(value);
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      redactText(key),
      /(?:access[_-]?token|api[_-]?key|password|secret|(?:proxy-)?authorization)$/i.test(key)
        ? "[REDACTED]" : redactValue(item),
    ]));
  }
  return value;
}

function hasPayload(content) {
  if (typeof content === "string") return Boolean(content.trim());
  if (Array.isArray(content)) return content.some(hasPayload);
  if (content && typeof content === "object") {
    return Object.entries(content).some(([key, item]) => key !== "type" && hasPayload(item));
  }
  return content != null;
}

function messagePreview(content) {
  if (content == null) return null;
  let parsed = content;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  const messages = Array.isArray(parsed) ? parsed : parsed?.messages;
  if (!Array.isArray(messages)) return null;
  const previews = messages
    .filter((message) => ["user", "assistant", "tool"].includes(message?.role))
    .flatMap((message) => {
      const parts = Array.isArray(message.parts) ? message.parts
        .filter(hasPayload).map((part) => part.type === "text" ? part.content ?? part.text : part) : [];
      const payloads = [
        message.content, ...parts,
        { tool_calls: message.tool_calls, function_call: message.function_call },
      ].filter(hasPayload);
      return payloads.length ? [`${message.role}: ${payloads
        .map((payload) => redact(payload)).join("\n")}`] : [];
    });
  return previews.join("\n") || null;
}

function capturedMessages(span, attrs, kind) {
  const eventFields = Object.fromEntries((span.events ?? []).flatMap((event) =>
    Object.entries(attributes(event)).filter(([key]) => /gen_ai\.(?:input|output)\.messages|gen_ai\.tool\.call\.(?:arguments|result)/.test(key))));
  const fields = { ...eventFields, ...attrs };
  return kind === "chat" ? {
    request: messagePreview(fields["gen_ai.input.messages"]),
    response: messagePreview(fields["gen_ai.output.messages"]),
  } : kind === "execute_tool" ? {
    request: redact(fields["gen_ai.tool.call.arguments"]),
    response: redact(hydrateFileBackedOutput(fields["gen_ai.tool.call.result"])),
  } : { request: null, response: null };
}

export function loadSpans(jsonl) {
  if (!jsonl?.trim()) throw new Error("Missing or empty OTLP JSONL trace");
  const spans = [];
  let firstKeys = "";
  let nestedKeys = "";
  for (const [index, line] of jsonl.trim().split(/\r?\n/).entries()) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON on trace line ${index + 1}`);
    }
    if (!entry || typeof entry !== "object") throw new Error(`Invalid OTLP entry on trace line ${index + 1}`);
    if (!firstKeys) {
      firstKeys = Object.keys(entry).map(safe).join(",");
      const nested = entry.data ?? entry.payload ?? entry;
      nestedKeys = Object.keys(nested).map(safe).join(",");
    }
    const candidates = entry.type === "span" ? [entry] :
      (entry.resourceSpans ?? []).flatMap((resource) =>
        (resource.scopeSpans ?? []).flatMap((scope) => scope.spans ?? []));
    for (const span of candidates) {
      const normalized = {
        ...span,
        startTimeUnixNano: nano(span.startTimeUnixNano ?? span.startTime),
        endTimeUnixNano: nano(span.endTimeUnixNano ?? span.endTime),
      };
      if (!normalized.traceId || !normalized.spanId || !normalized.startTimeUnixNano || !normalized.endTimeUnixNano) {
        throw new Error(`Incomplete span on trace line ${index + 1}; record keys: ${firstKeys}`);
      }
      spans.push(normalized);
    }
  }
  if (!spans.length) throw new Error(`No trace spans found (record keys: ${firstKeys}; nested keys: ${nestedKeys})`);
  return spans;
}

export function buildTraceModel(spans, {
  includeMessages = false,
  expectedModel = null,
  pattern = null,
  pricingCatalog = defaultPricingCatalog,
} = {}) {
  const prices = pricingIndex(pricingCatalog);
  const nodes = new Map();
  for (const span of spans) {
    const key = `${span.traceId}:${span.spanId}`;
    if (nodes.has(key)) throw new Error(`Duplicate span ID in trace: ${key}`);
    nodes.set(key, { span, attrs: attributes(span), children: [] });
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(`${node.span.traceId}:${node.span.parentSpanId}`);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (a, b) =>
    BigInt(a.span.startTimeUnixNano) < BigInt(b.span.startTimeUnixNano) ? -1 :
    BigInt(a.span.startTimeUnixNano) > BigInt(b.span.startTimeUnixNano) ? 1 : 0;
  const agents = [];
  const tools = [];
  const chats = [];
  const lines = [];
  const events = [];
  function visit(node, depth, insideAgent, branch, owner, parentEventId) {
    const { span, attrs } = node;
    const kind = operation(span, attrs);
    const isAgent = kind === "invoke_agent";
    const id = `${span.traceId}:${span.spanId}`;
    const currentBranch = isAgent && insideAgent ? span.spanId : branch;
    if (isAgent) agents.push({ span, subagent: insideAgent });
    if (kind === "execute_tool") tools.push({ ...node, branch: currentBranch });
    if (kind === "chat") chats.push(node);
    if (["invoke_agent", "execute_tool", "chat"].includes(kind)) {
      const detail = kind === "invoke_agent"
        ? (attrs["gen_ai.agent.name"] ?? span.name.replace(/^invoke_agent ?/, "")) || (insideAgent ? "Subagent" : "Orchestrator")
        : kind === "execute_tool"
          ? toolName(span, attrs)
          : attrs["gen_ai.response.model"] ?? attrs["gen_ai.request.model"] ?? span.name.replace(/^chat ?/, "");
      const mcp = kind === "execute_tool" && (attrs["mcp.server.name"] ?? attrs["github.copilot.mcp.server.name"]);
      const label = mcp && !String(detail).startsWith(`${mcp}/`) ? `${mcp}/${detail}` : detail;
      const failed = Number(span.status?.code) === 2 || Boolean(attrs["error.type"]);
      const errorReason = failed
        ? redact(attrs["error.message"] ?? attrs["exception.message"] ?? span.status?.message ?? attrs["error.type"] ?? "OpenTelemetry recorded an error without a message.")
        : null;
      const status = kind === "execute_tool" ? ` status=${failed ? "error" : "ok"}` : failed ? " ERROR" : "";
      const tokens = kind === "chat" && (attrs["gen_ai.usage.input_tokens"] != null || attrs["gen_ai.usage.output_tokens"] != null)
        ? ` tokens=${attrs["gen_ai.usage.input_tokens"] ?? "?"}/${attrs["gen_ai.usage.output_tokens"] ?? "?"} in/out`
        : "";
      const model = kind === "chat"
        ? String(attrs["gen_ai.response.model"] ?? attrs["gen_ai.request.model"] ?? span.name.replace(/^chat ?/, ""))
        : null;
      const inputTokens = kind === "chat" ? Number(attrs["gen_ai.usage.input_tokens"] ?? 0) : null;
      const outputTokens = kind === "chat" ? Number(attrs["gen_ai.usage.output_tokens"] ?? 0) : null;
      const hasTokenUsage = kind === "chat"
        && (attrs["gen_ai.usage.input_tokens"] != null || attrs["gen_ai.usage.output_tokens"] != null);
      const cachedInputTokens = kind === "chat"
        ? Number(attrs["gen_ai.usage.cache_read.input_tokens"]
          ?? attrs["gen_ai.usage.cached_input_tokens"] ?? attrs["gen_ai.usage.cache_read_input_tokens"] ?? 0) : null;
      const cacheWriteTokens = kind === "chat"
        ? Number(attrs["gen_ai.usage.cache_write_input_tokens"] ?? attrs["gen_ai.usage.cache_write_tokens"] ?? 0) : null;
      const reportedCost = kind === "chat" && Number.isFinite(Number(attrs["gen_ai.usage.cost"]))
        ? Number(attrs["gen_ai.usage.cost"]) : null;
      const price = modelPricing(model, prices);
      const priceTier = price
        ? inputTokens > (price.longContextThreshold ?? Number.MAX_SAFE_INTEGER)
          ? price.longContext ?? price.default
          : price.default
        : null;
      const estimatedCost = reportedCost == null && priceTier && hasTokenUsage
        ? (Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens) * priceTier.input
          + cachedInputTokens * priceTier.cachedInput
          + cacheWriteTokens * priceTier.cacheWrite
          + outputTokens * priceTier.output) / 1_000_000
        : null;
      const cost = reportedCost ?? estimatedCost;
      const costSource = reportedCost != null ? "reported" : estimatedCost != null ? "estimated" : null;
      const costText = cost == null ? "" : ` ${costSource}_cost=${cost}`;
      const text = `${kind} ${safe(label || "(unnamed)")} @ ${timestamp(span.startTimeUnixNano)} (${elapsed(span)})${tokens}${costText}${status}`;
      lines.push(`${"  ".repeat(depth)}${text}`);
      events.push({
        id, owner, parentId: parentEventId, kind, depth, text, name: safe(label || "(unnamed)"), failed,
        status: failed ? "error" : "ok",
        errorReason,
        start: Number(BigInt(span.startTimeUnixNano) / 1_000_000n),
        end: Number(BigInt(span.endTimeUnixNano) / 1_000_000n),
        cost,
        costSource,
        pricedModel: price?.model ?? null,
        hasTokenUsage,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        ...(includeMessages ? capturedMessages(span, attrs, kind) : {}),
      });
    }
    const nextParentId = ["invoke_agent", "execute_tool", "chat"].includes(kind) ? id : parentEventId;
    for (const child of node.children.sort(sort)) {
      visit(child, depth + (kind && ["invoke_agent", "execute_tool", "chat"].includes(kind) ? 1 : 0), insideAgent || isAgent, currentBranch, isAgent ? id : owner, nextParentId);
    }
  }
  for (const root of roots.sort(sort)) visit(root, 0, false, undefined, undefined, undefined);
  if (!agents.length && !tools.length && !chats.length) throw new Error("Trace has no invoke_agent, execute_tool, or chat spans");
  const eventById = new Map(events.map((event) => [event.id, event]));
  for (const event of events) event.childIds = [];
  for (const event of events) {
    const parent = eventById.get(event.parentId);
    if (parent) parent.childIds.push(event.id);
    event.parentName = parent?.name ?? null;
    event.ownerName = eventById.get(event.owner)?.name ?? null;
  }
  const delegatedEvents = events
    .filter((event) => event.kind === "invoke_agent" && event.owner)
    .sort((left, right) => left.start - right.start);
  for (const [index, event] of delegatedEvents.entries()) {
    event.patternRole = pattern === "parallel-delegation"
      ? `Branch ${index + 1}`
      : pattern === "sequential-pipeline"
        ? `Stage ${index + 1}`
        : pattern === "critic-reviser-loop"
          ? delegatedEvents.length === 1 ? "Critic" : `Critic ${index + 1}`
          : null;
    if (pattern === "sequential-pipeline" && index > 0) {
      event.dependsOn = delegatedEvents[index - 1].id;
    }
  }

  function aggregateCosts(items, keyFor, labelFor) {
    const groups = new Map();
    for (const event of items) {
      const key = keyFor(event);
      const existing = groups.get(key) ?? {
        id: key,
        label: labelFor(event),
        calls: 0,
        pricedCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      existing.calls++;
      existing.inputTokens += event.inputTokens ?? 0;
      existing.outputTokens += event.outputTokens ?? 0;
      if (event.cost != null) {
        existing.pricedCalls++;
        existing.cost += event.cost;
      }
      groups.set(key, existing);
    }
    return [...groups.values()]
      .map((group) => ({ ...group, cost: group.pricedCalls ? group.cost : null }))
      .sort((left, right) => (right.cost ?? -1) - (left.cost ?? -1));
  }

  const subagents = agents.filter((agent) => agent.subagent);
  let concurrent = 0;
  let peak = 0;
  const edges = subagents.flatMap(({ span }) => [
    { time: BigInt(span.startTimeUnixNano), delta: 1 },
    { time: BigInt(span.endTimeUnixNano), delta: -1 },
  ]).sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : a.delta - b.delta);
  for (const edge of edges) {
    concurrent += edge.delta;
    peak = Math.max(peak, concurrent);
  }
  const input = chats.reduce((sum, { attrs }) => sum + Number(attrs["gen_ai.usage.input_tokens"] ?? 0), 0);
  const output = chats.reduce((sum, { attrs }) => sum + Number(attrs["gen_ai.usage.output_tokens"] ?? 0), 0);
  const costs = events.filter((event) => event.cost != null);
  const totalCost = costs.reduce((sum, event) => sum + event.cost, 0);
  const costSources = new Set(costs.map((event) => event.costSource));
  const costMode = costSources.size === 1 ? [...costSources][0] : costSources.size > 1 ? "mixed" : null;
  const tokenInfo = chats.some(({ attrs }) => attrs["gen_ai.usage.input_tokens"] != null)
    ? `${input}/${output} in/out (reported chat spans)` : "unavailable";
  const models = chats.map(({ span, attrs }) =>
    String(attrs["gen_ai.response.model"] ?? attrs["gen_ai.request.model"] ?? span.name.replace(/^chat ?/, "")));
  const expectedModels = [...new Set(String(expectedModel ?? "").split(",").map((model) => model.trim()).filter(Boolean))];
  const allowedModelsObserved = models.length > 0
    && models.every((model) => expectedModels.some((expected) => sameModel(model, expected)));
  const requiredRuntimeModel = expectedModels.length > 1 && subagents.length
    ? expectedModels.at(-1)
    : expectedModels[0];
  const modelMatches = !expectedModels.length || (allowedModelsObserved
    && models.some((model) => sameModel(model, requiredRuntimeModel)));
  const modelExpectation = !expectedModels.length ? ""
    : expectedModels.length > 1 && subagents.length
      ? ` | Allowed: ${expectedModels.map((model) => safe(model)).join(", ")} | Delegated: ${safe(requiredRuntimeModel)} (${modelMatches ? "PASS" : "MISMATCH"})`
      : ` | Required: ${safe(requiredRuntimeModel)} (${modelMatches ? "PASS" : "MISMATCH"})`;
  function isAncestor(ancestorId, descendantId) {
    let owner = eventById.get(descendantId)?.owner;
    while (owner) {
      if (owner === ancestorId) return true;
      owner = eventById.get(owner)?.owner;
    }
    return false;
  }
  const parallelComplete = subagents.some(({ span: left }, index) =>
    subagents.slice(index + 1).some(({ span: right }) => {
      const leftId = `${left.traceId}:${left.spanId}`;
      const rightId = `${right.traceId}:${right.spanId}`;
      return BigInt(left.startTimeUnixNano) < BigInt(left.endTimeUnixNano)
        && BigInt(right.startTimeUnixNano) < BigInt(right.endTimeUnixNano)
        && BigInt(left.startTimeUnixNano) < BigInt(right.endTimeUnixNano)
        && BigInt(right.startTimeUnixNano) < BigInt(left.endTimeUnixNano)
        && !isAncestor(leftId, rightId) && !isAncestor(rightId, leftId);
    }));
  const sequentialComplete = subagents.length >= 2 && peak === 1;
  const criticComplete = subagents.length >= 1;
  const directComplete = subagents.length === 0 && chats.length >= 1;
  const complete = pattern === "parallel-delegation" ? parallelComplete
    : pattern === "sequential-pipeline" ? sequentialComplete
      : pattern === "critic-reviser-loop" ? criticComplete
        : pattern === "direct-execution" ? directComplete
      : true;
  const evidence = pattern === "parallel-delegation"
    ? `delegated branches: ${subagents.length} | concurrent execution: ${parallelComplete ? "yes" : "no"}`
    : pattern === "sequential-pipeline"
      ? `pipeline stages: ${subagents.length} | sequential execution: ${peak === 1 ? "yes" : "no"}`
      : pattern === "critic-reviser-loop"
        ? `critic branches: ${subagents.length}`
        : pattern === "direct-execution"
          ? `subagents: ${subagents.length} | direct model calls: ${chats.length}`
          : `subagents: ${subagents.length} | peak concurrency: ${peak}`;
  const messageCount = events.filter((event) => hasPayload(event.request) || hasPayload(event.response)).length;
  const contentKeys = includeMessages && !messageCount
    ? [...new Set([...nodes.values()].flatMap((node) => Object.keys(node.attrs)).filter((key) => /message|content|argument|result/i.test(key)))].slice(0, 20)
    : [];
  const start = Math.min(...events.map((event) => event.start));
  const end = Math.max(...events.map((event) => event.end));
  const summary = [
    "## Copilot CLI invocation chain",
    "",
    `Agent spans: ${agents.length} | Subagents: ${subagents.length} | Peak concurrent subagents: ${peak}`,
    `Tool calls: ${tools.length} | Failed tool calls: ${tools.filter(({ span, attrs }) => Number(span.status?.code) === 2 || attrs["error.type"]).length} | Chat calls: ${chats.length} | Tokens: ${tokenInfo}`,
    `Model cost: ${costs.length ? `${totalCost} (${costMode})` : "unavailable"} (${costs.length}/${chats.length} chat spans priced)`,
    `Models: ${[...new Set(models)].map((model) => safe(model)).join(", ") || "unavailable"}${modelExpectation}`,
    `Pattern evidence: ${complete ? "PASS" : "MISSING"} | ${evidence}`,
    ...(includeMessages ? [`Message payloads: ${messageCount} spans${contentKeys.length ? ` | available attribute names: ${contentKeys.map((key) => safe(key)).join(", ")}` : ""}`] : ["Message content capture: off (enable include_messages when dispatching to see payloads)."]),
    ...(subagents.length ? [] : ["No subagents observed in this trace; --fleet does not guarantee delegation."]),
    "",
    "Times are UTC; durations and overlap derive from span timestamps, not JSONL file order.",
    "",
    "```text",
    ...lines,
    "```",
    "",
  ];
  return redactValue({
    summary: summary.join("\n"),
    pattern,
    complete: Boolean(complete),
    modelMatches,
    events,
    includeMessages,
    messageCount,
    duration: Math.max(1, end - start),
    timeRange: { start, end },
    costBreakdown: {
      byModel: aggregateCosts(
        events.filter((event) => event.kind === "chat"),
        (event) => event.name,
        (event) => event.name,
      ),
      byAgent: aggregateCosts(
        events.filter((event) => event.kind === "chat"),
        (event) => event.owner ?? "unassigned",
        (event) => event.ownerName ?? "Unassigned",
      ),
    },
    counts: {
      agents: agents.length,
      subagents: subagents.length,
      peak,
      tools: tools.length,
      failedTools: tools.filter(({ span, attrs }) => Number(span.status?.code) === 2 || attrs["error.type"]).length,
      chats: chats.length,
      inputTokens: input,
      outputTokens: output,
      totalCost: costs.length ? totalCost : null,
      costedCalls: costs.length,
      costMode,
    },
    inventory: {
      agents: [...new Set(events.filter((event) => event.kind === "invoke_agent").map((event) => event.name))],
      models: [...new Set(models)],
      tools: [...new Set(events.filter((event) => event.kind === "execute_tool").map((event) => event.name))],
    },
  });
}
