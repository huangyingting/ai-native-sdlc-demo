function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 2 : 1)} s`;
  return `${Math.floor(milliseconds / 60_000)}m ${Math.round((milliseconds % 60_000) / 1000)}s`;
}

function formatCost(cost) {
  if (cost == null) return "—";
  if (cost === 0) return "$0.00";
  return `$${cost < 0.01 ? cost.toFixed(6) : cost.toFixed(4)}`;
}

function kindLabel(kind) {
  return kind === "invoke_agent" ? "Agent" : kind === "chat" ? "Model" : "Tool";
}

function shortId(id) {
  return String(id).split(":").at(-1)?.slice(0, 12) ?? "";
}

function icon(name, className = "") {
  const paths = {
    agent: '<circle cx="8" cy="5" r="2.25"/><path d="M3.5 14v-1.25A3.75 3.75 0 0 1 7.25 9h1.5a3.75 3.75 0 0 1 3.75 3.75V14M12 4.5h2M13 3.5v2"/>',
    model: '<path d="M8 2.25 9.15 5.1 12 6.25 9.15 7.4 8 10.25 6.85 7.4 4 6.25 6.85 5.1 8 2.25Z"/><path d="m12.5 10 .55 1.45L14.5 12l-1.45.55L12.5 14l-.55-1.45L10.5 12l1.45-.55L12.5 10Z"/>',
    tool: '<path d="M9.8 3.1a3.2 3.2 0 0 0-3.9 3.9l-3.4 3.4a1.5 1.5 0 1 0 2.1 2.1L8 9.1a3.2 3.2 0 0 0 3.9-3.9L10 7.1 8.9 6 10.8 4.1Z"/>',
    error: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.75v4M8 11.5h.01"/>',
    check: '<circle cx="8" cy="8" r="5.5"/><path d="m5.25 8 1.8 1.8 3.7-3.7"/>',
    search: '<circle cx="7" cy="7" r="4.25"/><path d="m10.25 10.25 3 3"/>',
    waterfall: '<path d="M2.5 3.5h4v2h-4zM5 7h4v2H5zM8 10.5h5.5v2H8z"/><path d="M4.5 5.5V7M7 9v1.5"/>',
    map: '<circle cx="3.5" cy="8" r="1.5"/><circle cx="8" cy="4" r="1.5"/><circle cx="12.5" cy="9.5" r="1.5"/><path d="m4.8 6.9 1.9-1.7M9.3 5.1l1.9 3.2"/>',
    chevron: '<path d="m5 6 3 3 3-3"/>',
    download: '<path d="M8 2.5v7M5.25 7 8 9.75 10.75 7M3 12.5h10"/>',
    link: '<path d="m6.5 9.5-1 1a2.12 2.12 0 0 1-3-3l2-2a2.12 2.12 0 0 1 3 0M9.5 6.5l1-1a2.12 2.12 0 1 1 3 3l-2 2a2.12 2.12 0 0 1-3 0M5.75 10.25l4.5-4.5"/>',
    request: '<path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/>',
    response: '<path d="M13 8H4M7.5 4.5 4 8l3.5 3.5"/>',
  };
  return `<svg class="svg-icon ${className}" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

export function renderDependencyGraph(events, pattern = null) {
  const nodes = new Map();
  for (const event of events) {
    const id = event.kind === "invoke_agent" ? event.id : `${event.owner ?? "root"}:${event.kind}:${event.name}`;
    const existing = nodes.get(id);
    if (existing) {
      existing.count++;
      existing.duration += event.end - event.start;
      existing.cost = existing.cost == null && event.cost == null ? null : (existing.cost ?? 0) + (event.cost ?? 0);
      existing.failed ||= event.failed;
    } else {
      nodes.set(id, {
        id,
        eventId: event.id,
        owner: event.owner,
        kind: event.kind,
        name: event.name,
        patternRole: event.patternRole,
        dependsOn: event.dependsOn,
        count: 1,
        start: event.start,
        duration: event.end - event.start,
        cost: event.cost,
        failed: event.failed,
      });
    }
  }
  const children = new Map();
  for (const node of nodes.values()) {
    const parent = nodes.has(node.owner) ? node.owner : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  for (const group of children.values()) group.sort((a, b) => a.start - b.start);
  const positions = new Map();
  let nextY = 24;
  let maxDepth = 0;
  function place(node, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const descendants = children.get(node.id) ?? [];
    const ys = descendants.map((child) => place(child, depth + 1));
    const y = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : nextY;
    if (!ys.length) nextY += 58;
    positions.set(node.id, { x: 20 + depth * 246, y });
    return y;
  }
  for (const root of children.get(null) ?? []) place(root, 0);
  const edges = [...nodes.values()].filter((node) => positions.has(node.owner)).map((node) => {
    const from = positions.get(node.owner);
    const to = positions.get(node.id);
    const middle = (from.x + 214 + to.x) / 2;
    return `<path d="M${from.x + 214} ${from.y + 19} C${middle} ${from.y + 19},${middle} ${to.y + 19},${to.x - 7} ${to.y + 19}" />`;
  }).join("\n");
  const flowEdges = [...nodes.values()].filter((node) => positions.has(node.dependsOn)).map((node) => {
    const from = positions.get(node.dependsOn);
    const to = positions.get(node.id);
    const x = from.x + 107;
    return `<path class="flow-edge" d="M${x} ${from.y + 39} L${x} ${to.y - 5}" marker-end="url(#flow-arrow)" />`;
  }).join("\n");
  const cards = [...nodes.values()].map((node) => {
    const { x, y } = positions.get(node.id);
    const displayName = node.patternRole ? `${node.patternRole} · ${node.name}` : node.name;
    const shown = displayName.length > 25 ? `${displayName.slice(0, 23)}…` : displayName;
    return `<g class="graph-node ${node.kind}${node.failed ? " failed" : ""}" data-event-id="${escapeHtml(node.eventId)}" tabindex="0" role="button" transform="translate(${x} ${y})">
      <title>${escapeHtml(`${kindLabel(node.kind)}: ${displayName}; ${node.count} call${node.count === 1 ? "" : "s"}; ${formatDuration(node.duration)}; ${formatCost(node.cost)}`)}</title>
      <rect width="214" height="38" rx="9" />
      <circle cx="14" cy="19" r="4" />
      <text x="26" y="16">${escapeHtml(shown)}</text>
      <text class="graph-meta" x="26" y="29">${kindLabel(node.kind).toUpperCase()} · ${node.count}× · ${formatDuration(node.duration)}${node.cost == null ? "" : ` · ${formatCost(node.cost)}`}</text>
    </g>`;
  }).join("\n");
  const width = 20 + maxDepth * 246 + 234;
  const height = Math.max(90, nextY + 18);
  const patternSummary = pattern === "parallel-delegation"
    ? "Parallel delegation · independent concurrent branches"
    : pattern === "sequential-pipeline"
      ? "Sequential pipeline · each stage consumes the previous result"
      : pattern === "critic-reviser-loop"
        ? "Critic-reviser loop · initial position → independent critic → revised conclusion"
        : pattern === "direct-execution"
          ? "Direct execution · no subagent delegation"
          : "";
  return `<svg id="dependency-graph" class="graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Agent, model, and tool dependency graph">
    <title>${escapeHtml(patternSummary || "Agent, model, and tool dependency graph")}</title>
    <defs><marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" /></marker></defs>
    <g class="graph-edges">${edges}${flowEdges}</g>${cards}
  </svg>`;
}

export function renderHtml(model) {
  const { events, counts, complete, includeMessages, duration, timeRange, costBreakdown, pattern } = model;
  const selectedEvent = events[0];
  const failed = events.filter((event) => event.failed);
  const costLabel = counts.costMode === "estimated" ? "Estimated" : counts.costMode === "reported" ? "Reported" : counts.costMode === "mixed" ? "Mixed" : "Cost";
  const graph = renderDependencyGraph(events, pattern);

  const rows = events.map((event) => {
    const left = ((event.start - timeRange.start) / duration) * 100;
    const width = Math.min(100 - left, Math.max(0.35, ((event.end - event.start) / duration) * 100));
    const search = `${event.kind} ${event.name} ${event.failed ? "failed error" : "success"} ${event.ownerName ?? ""}`.toLowerCase();
    return `<div class="span-row${event.id === selectedEvent.id ? " active" : ""}" role="button" tabindex="0"
      data-id="${escapeHtml(event.id)}" data-parent="${escapeHtml(event.parentId ?? "")}" data-owner="${escapeHtml(event.owner ?? "")}"
      data-kind="${event.kind}" data-failed="${event.failed}" data-priced="${event.cost != null}" data-filter="${escapeHtml(search)}">
      <div class="span-identity" style="--depth:${event.depth}">
        ${event.childIds.length ? `<button class="collapse" type="button" data-collapse="${escapeHtml(event.id)}" aria-label="Collapse descendants">${icon("chevron")}</button>` : `<span class="collapse-spacer"></span>`}
        <span class="kind-icon ${event.kind}">${icon(event.kind === "invoke_agent" ? "agent" : event.kind === "chat" ? "model" : "tool")}</span>
        <span class="span-title"><strong>${escapeHtml(event.name)}</strong><small>${kindLabel(event.kind)}${event.ownerName && event.kind !== "invoke_agent" ? ` · ${escapeHtml(event.ownerName)}` : ""}${event.failed ? " · Error" : ""}</small></span>
      </div>
      <div class="waterfall-track"><span class="waterfall-bar ${event.kind}${event.failed ? " failed" : ""}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span></div>
      <span class="span-duration">${formatDuration(event.end - event.start)}</span>
      <span class="span-cost">${formatCost(event.cost)}</span>
      <span class="span-state ${event.failed ? "failed" : "ok"}" title="${event.failed ? "Error recorded by OTEL" : "No error recorded"}"></span>
    </div>`;
  }).join("\n");

  const costRows = (groups) => {
    const maximum = Math.max(...groups.map((group) => group.cost ?? 0), 0);
    const labelCounts = new Map();
    for (const group of groups) labelCounts.set(group.label, (labelCounts.get(group.label) ?? 0) + 1);
    return groups.map((group) => {
      const width = maximum && group.cost != null ? Math.max(2, (group.cost / maximum) * 100) : 0;
      const coverage = group.pricedCalls === group.calls ? `${group.calls} call${group.calls === 1 ? "" : "s"}`
        : `${group.pricedCalls}/${group.calls} priced`;
      const label = labelCounts.get(group.label) > 1 ? `${group.label} · ${shortId(group.id)}` : group.label;
      return `<div class="cost-row">
        <div class="cost-row-head"><strong>${escapeHtml(label)}</strong><span>${formatCost(group.cost)}</span></div>
        <div class="cost-meter"><i style="width:${width.toFixed(2)}%"></i></div>
        <small>${coverage} · ${group.inputTokens.toLocaleString()} in / ${group.outputTokens.toLocaleString()} out</small>
      </div>`;
    }).join("");
  };
  const costSummary = `<section class="cost-allocation">
    <div class="section-title"><span>Cost allocation</span><small>${counts.costedCalls}/${counts.chats} calls priced</small></div>
    <div class="cost-groups">
      <div><h3>By agent branch</h3>${costRows(costBreakdown.byAgent)}</div>
      <div><h3>By model</h3>${costRows(costBreakdown.byModel)}</div>
    </div>
  </section>`;

  const detailPanels = events.map((event) => {
    const children = event.childIds.map((id) => events.find((candidate) => candidate.id === id)).filter(Boolean);
    const relations = [
      ...(event.parentId ? [`<button type="button" data-select="${escapeHtml(event.parentId)}"><span>Parent</span>${escapeHtml(event.parentName ?? shortId(event.parentId))}</button>`] : []),
      ...children.map((child) => `<button type="button" data-select="${escapeHtml(child.id)}"><span>Child</span>${escapeHtml(child.name)}</button>`),
    ];
    const relationButtons = relations.slice(0, 8).join("");
    const hiddenRelations = Math.max(0, relations.length - 8);
    const offset = event.start - timeRange.start;
    return `<article class="inspector-panel" data-inspector="${escapeHtml(event.id)}" ${event.id === selectedEvent.id ? "" : "hidden"}>
      <header class="inspector-head">
        <div><span class="kind-kicker ${event.kind}">${kindLabel(event.kind)}</span><h2>${escapeHtml(event.name)}</h2></div>
        <span class="status-pill ${event.failed ? "failed" : "ok"}">${icon(event.failed ? "error" : "check")}${event.failed ? "Error" : "Success"}</span>
      </header>
      <div class="breadcrumb">${event.parentName ? `${escapeHtml(event.parentName)} <span>›</span> ` : ""}<strong>${escapeHtml(event.name)}</strong></div>
      <dl class="properties">
        <div><dt>Start offset</dt><dd>+${formatDuration(offset)}</dd></div>
        <div><dt>Duration</dt><dd>${formatDuration(event.end - event.start)}</dd></div>
        <div><dt>Cost</dt><dd>${formatCost(event.cost)}${event.costSource ? `<small>${event.costSource}</small>` : ""}</dd></div>
        <div><dt>Span ID</dt><dd class="mono">${escapeHtml(shortId(event.id))}</dd></div>
        ${event.hasTokenUsage ? `<div><dt>Input tokens</dt><dd>${event.inputTokens.toLocaleString()}</dd></div>` : ""}
        ${event.hasTokenUsage ? `<div><dt>Output tokens</dt><dd>${event.outputTokens.toLocaleString()}</dd></div>` : ""}
      </dl>
      ${event.errorReason ? `<section class="error-detail"><h3>${icon("error")}Failure reason</h3><pre>${escapeHtml(event.errorReason)}</pre></section>` : ""}
      ${event.depth === 0 ? costSummary : ""}
      ${relationButtons ? `<section class="related"><h3>${icon("link")}Related calls</h3><div>${relationButtons}${hiddenRelations ? `<small class="relation-overflow">+${hiddenRelations} more calls in the trace</small>` : ""}</div></section>` : ""}
      <section class="payload">
        <details ${event.request ? "open" : ""}><summary>${icon("request")}Request ${event.request ? "" : "<span>not captured</span>"}</summary><pre>${escapeHtml(event.request ?? "No request payload was recorded for this span.")}</pre></details>
        <details ${event.response ? "open" : ""}><summary>${icon("response")}Response ${event.response ? "" : "<span>not captured</span>"}</summary><pre>${escapeHtml(event.response ?? "No response payload was recorded for this span.")}</pre></details>
      </section>
    </article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Copilot CLI Trace Viewer</title>
<script>
(() => {
  const requested = new URLSearchParams(location.search).get("theme") || new URLSearchParams(location.search).get("scoutTheme");
  document.documentElement.dataset.theme = requested || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
})();
</script>
<style>
:root{color-scheme:light;--bg:#f5f7fb;--surface:#fff;--surface-soft:#f7f8fb;--surface-hover:#f0f4fa;--border:#dfe4ec;--border-strong:#c9d1dc;--text:#18202b;--muted:#667085;--soft:#98a2b3;--blue:#2563eb;--blue-soft:#eaf1ff;--violet:#7c3aed;--green:#159455;--green-soft:#e9f8f0;--red:#dc3545;--red-soft:#fff0f1;--amber:#b7791f;--amber-soft:#fff8e7;--shadow:0 10px 30px rgba(29,41,57,.07)}
html[data-theme="dark"]{color-scheme:dark;--bg:#0b0f17;--surface:#111722;--surface-soft:#151c28;--surface-hover:#1b2432;--border:#263142;--border-strong:#364258;--text:#edf2f7;--muted:#9aa7b8;--soft:#6f7d91;--blue:#6ea8fe;--blue-soft:#162747;--violet:#b794f4;--green:#4ade80;--green-soft:#10291d;--red:#ff6b78;--red-soft:#351820;--amber:#f2c66d;--amber-soft:#332916;--shadow:none}
*{box-sizing:border-box}[hidden]{display:none!important}html,body{height:100%}body{margin:0;background:var(--bg);color:var(--text);font:13px/1.45 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}button,input{font:inherit;color:inherit}.mono,pre{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}.svg-icon{display:inline-block;width:14px;height:14px;flex:0 0 auto;vertical-align:-2px}
.app{height:100%}.workspace{height:100%;min-height:0;display:grid;grid-template-columns:minmax(620px,1fr) 340px;gap:1px;background:var(--border)}.main,.inspector{min-height:0;background:var(--surface)}
.main{display:grid;grid-template-rows:auto 1fr;min-width:0}.commandbar{display:flex;align-items:center;gap:8px;min-height:46px;padding:0 10px;border-bottom:1px solid var(--border)}.trace-meta{display:flex;align-items:center;gap:9px;margin-left:auto;white-space:nowrap;color:var(--muted);font-size:9px}.trace-meta strong{color:var(--text);font-size:10px;font-variant-numeric:tabular-nums}.trace-meta .error{color:var(--red)}.trace-meta .cost{color:var(--amber)}.search-wrap{position:relative;flex:1;max-width:340px}.search-wrap>.svg-icon{position:absolute;left:9px;top:7px;color:var(--soft);width:13px;height:13px}.search{width:100%;border:0;border-radius:7px;background:var(--surface-soft);padding:6px 9px 6px 29px;outline:0}.search:focus{box-shadow:inset 0 0 0 1px var(--blue)}.mode{display:flex;align-self:stretch;margin-right:4px}.mode button,.icon-button{display:inline-flex;align-items:center;gap:5px;border:0;border-bottom:2px solid transparent;background:transparent;padding:0 10px;color:var(--muted);font-size:10px;font-weight:600;cursor:pointer}.mode button .svg-icon,.icon-button .svg-icon{width:12px;height:12px}.mode button.active{border-bottom-color:var(--blue);color:var(--text)}.icon-button{align-self:center;border:0;border-radius:6px;padding:5px 7px;font-size:9px}.icon-button:hover{background:var(--surface-hover);color:var(--text)}.focus{display:flex;gap:2px}.focus button{display:flex;align-items:center;gap:4px;border:0;border-radius:6px;background:transparent;padding:5px 7px;color:var(--muted);font-size:9px;cursor:pointer}.focus button:hover{background:var(--surface-hover)}.focus button.active{background:var(--blue-soft);color:var(--blue)}.focus button span{color:var(--soft);font-variant-numeric:tabular-nums}.focus button[data-focus="errors"] span{color:${failed.length ? "var(--red)" : "var(--soft)"}}
.canvas{min-height:0;position:relative}.trace-view{height:100%;display:grid;grid-template-rows:30px 1fr}.trace-view[hidden],.map-view[hidden]{display:none}.axis{display:grid;grid-template-columns:300px 1fr 68px 68px 24px;align-items:end;border-bottom:1px solid var(--border);color:var(--soft);font-size:9px}.axis-label{padding:0 10px 7px}.ticks{display:flex;justify-content:space-between;padding:0 2px 7px}.span-list{overflow:auto}.span-row{display:grid;grid-template-columns:300px minmax(220px,1fr) 68px 68px 24px;align-items:center;min-height:39px;border-bottom:1px solid var(--border);cursor:pointer;outline:0;transition:background .12s,opacity .12s}.span-row:hover{background:var(--surface-hover)}.span-row.active{background:var(--blue-soft)}.span-row.active .span-title strong,.span-row.active .span-duration{color:var(--blue)}.span-row.relation-highlight{background:color-mix(in srgb,var(--violet) 8%,var(--surface))}.span-row.relation-highlight .span-title strong{color:var(--violet)}.span-row.branch-context:not(.active):not(.relation-highlight){background:color-mix(in srgb,var(--blue) 3%,var(--surface))}.span-row.dimmed{opacity:.32}.span-row.filtered,.span-row.collapsed{display:none}.span-row[data-failed="true"] .span-title strong,.span-row[data-failed="true"] .span-duration{color:var(--red)}.span-identity{min-width:0;display:flex;align-items:center;padding-left:calc(7px + var(--depth) * 14px);gap:7px}.collapse{display:grid;place-items:center;width:16px;height:20px;border:0;background:transparent;color:var(--muted);padding:0;cursor:pointer;transition:transform .15s}.collapse .svg-icon{width:12px;height:12px}.collapse.closed{transform:rotate(-90deg)}.collapse-spacer{width:16px}.kind-icon{display:grid;place-items:center;flex:0 0 auto;width:20px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--violet) 12%,transparent);color:var(--violet)}.kind-icon .svg-icon{width:12px;height:12px}.kind-icon.execute_tool{background:var(--green-soft);color:var(--green)}.kind-icon.chat{background:var(--blue-soft);color:var(--blue)}.span-title{min-width:0;display:grid}.span-title strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.span-title small{color:var(--muted);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.span-row[data-kind="invoke_agent"] .span-title small{color:var(--violet)}.span-row[data-kind="chat"] .span-title small{color:var(--blue)}.span-row[data-kind="execute_tool"] .span-title small{color:var(--green)}.waterfall-track{position:relative;height:100%;background:linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:25% 100%}.waterfall-bar{position:absolute;top:14px;height:10px;min-width:3px;border-radius:4px;background:var(--violet);box-shadow:0 0 0 1px color-mix(in srgb,var(--violet) 18%,transparent)}.waterfall-bar.execute_tool{background:var(--green)}.waterfall-bar.chat{background:var(--blue)}.waterfall-bar.failed{background:var(--red)}.span-duration,.span-cost{padding-right:9px;text-align:right;font:10px "SFMono-Regular",Consolas,monospace;color:var(--muted)}.span-cost{color:var(--amber)}.span-state{width:7px;height:7px;border-radius:50%;background:var(--green)}.span-state.failed{background:var(--red)}
.map-view{height:100%;overflow:auto;background:radial-gradient(var(--border) .7px,transparent .7px);background-size:15px 15px}.graph-context{position:sticky;left:0;width:max-content;margin:12px 0 -8px 22px;padding:5px 9px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--muted);font-size:10px;z-index:1}.graph-wrap{min-width:100%;min-height:100%;padding:22px}.graph{display:block;max-width:none;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.graph-edges path{fill:none;stroke:var(--border-strong);stroke-width:1.2}.graph-edges .flow-edge{stroke:var(--blue);stroke-width:1.5;stroke-dasharray:4 3}.graph-edges marker path{fill:var(--blue);stroke:none}.graph-node{cursor:pointer;outline:0}.graph-node rect{fill:var(--surface);stroke:var(--border-strong);stroke-width:1}.graph-node:hover rect,.graph-node.active rect{stroke:var(--blue);stroke-width:1.6}.graph-node circle{fill:var(--violet)}.graph-node.execute_tool circle{fill:var(--green)}.graph-node.chat circle{fill:var(--blue)}.graph-node.failed rect{stroke:var(--red)}.graph-node.failed circle{fill:var(--red)}.graph-node text{fill:var(--text);font-size:10px;font-weight:650}.graph-node .graph-meta{fill:var(--muted);font-size:8px;font-weight:500}
.inspector{overflow:auto}.inspector-panel{padding:12px 14px}.inspector-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.inspector-head>div{display:flex;align-items:center;gap:8px;min-width:0}.inspector-head h2{font-size:13px;line-height:1.25;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kind-kicker{font-size:8px;font-weight:750;letter-spacing:.07em;text-transform:uppercase;color:var(--violet)}.kind-kicker.execute_tool{color:var(--green)}.kind-kicker.chat{color:var(--blue)}.status-pill{display:inline-flex;align-items:center;gap:3px;border-radius:99px;padding:2px 6px;background:var(--green-soft);color:var(--green);font-size:8px;font-weight:700;text-transform:uppercase}.status-pill .svg-icon{width:10px;height:10px}.status-pill.failed{background:var(--red-soft);color:var(--red)}.breadcrumb{margin:8px 0 10px;color:var(--muted);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.breadcrumb span{padding:0 4px;color:var(--soft)}.breadcrumb strong{color:var(--text)}.properties{display:grid;grid-template-columns:1fr 1fr;margin:0;border-top:1px solid var(--border);border-left:1px solid var(--border)}.properties div{padding:7px 8px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}.properties dt{color:var(--muted);font-size:8px}.properties dd{display:flex;align-items:baseline;gap:5px;margin:2px 0 0;font-size:10px;font-weight:650}.properties dd small{color:var(--soft);font-size:7px;font-weight:500;text-transform:uppercase}.error-detail{margin-top:10px;padding:8px;border:1px solid color-mix(in srgb,var(--red) 28%,var(--border));border-radius:7px;background:var(--red-soft)}.error-detail h3{display:flex;align-items:center;gap:5px;margin:0 0 5px;color:var(--red);font-size:8px;text-transform:uppercase}.error-detail h3 .svg-icon{width:11px;height:11px}.error-detail pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);font-size:9px;line-height:1.45}.section-title{display:flex;align-items:center;justify-content:space-between;margin:14px 0 7px;color:var(--soft);font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.section-title small{font-size:8px;font-weight:500;letter-spacing:0;text-transform:none}.cost-groups{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cost-groups h3{margin:0 0 5px;color:var(--muted);font-size:9px}.cost-row{margin-bottom:8px}.cost-row-head{display:flex;justify-content:space-between;gap:8px;font-size:9px}.cost-row-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cost-row-head span{color:var(--amber);font-family:"SFMono-Regular",Consolas,monospace}.cost-meter{height:3px;margin:3px 0;background:var(--surface-soft);border-radius:9px;overflow:hidden}.cost-meter i{display:block;height:100%;background:var(--blue);border-radius:inherit}.cost-row small{display:block;color:var(--soft);font-size:7px}.related{margin-top:13px}.related h3{display:flex;align-items:center;gap:4px;margin:0 0 5px;color:var(--soft);font-size:8px;letter-spacing:.07em;text-transform:uppercase}.related h3 .svg-icon{width:10px;height:10px}.related>div{display:grid;gap:3px}.related button{display:grid;grid-template-columns:42px 1fr;border:0;border-radius:6px;background:var(--surface-soft);padding:6px 7px;text-align:left;cursor:pointer;font-size:9px}.related button:hover{background:var(--surface-hover)}.related button span{color:var(--soft);font-size:7px;text-transform:uppercase}.relation-overflow{padding:4px 7px;color:var(--soft);font-size:8px}.payload{margin-top:13px;display:grid;gap:5px}.payload details{border:1px solid var(--border);border-radius:7px;background:var(--surface-soft);overflow:hidden}.payload summary{padding:7px 8px;cursor:pointer;font-size:9px;font-weight:650}.payload summary>.svg-icon{width:11px;height:11px;margin-right:5px}.payload summary span{float:right;color:var(--soft);font-weight:400}.payload pre{max-height:260px;overflow:auto;margin:0;padding:9px;border-top:1px solid var(--border);background:var(--surface);white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted);font-size:9px;line-height:1.55}
.capture-graph{width:max-content;height:max-content;overflow:hidden}.capture-graph .app,.capture-graph .workspace,.capture-graph .main,.capture-graph .canvas,.capture-graph .map-view{width:max-content;height:auto;min-height:0;overflow:hidden}.capture-graph .workspace,.capture-graph .main{display:block}.capture-graph .commandbar,.capture-graph .trace-view,.capture-graph .inspector,.capture-graph .graph-context{display:none}.capture-graph .graph-wrap{width:max-content;min-width:0;min-height:0;padding:12px}
@media(max-width:1180px){.workspace{grid-template-columns:minmax(520px,1fr) 300px}.trace-meta span:nth-child(4),.trace-meta span:nth-child(5){display:none}.axis,.span-row{grid-template-columns:255px minmax(200px,1fr) 60px 60px 20px}}
@media(max-width:850px){body{overflow:auto}.app{height:auto;min-height:100%}.workspace{display:block;height:auto}.main{min-height:620px}.inspector{border-top:1px solid var(--border)}.trace-meta{display:none}.focus button:not(.active){display:none}.axis,.span-row{grid-template-columns:230px minmax(180px,1fr) 58px 20px}.span-cost,.axis .cost-axis{display:none}}
</style>
</head>
<body>
<div class="app">
  <div class="workspace">
    <main class="main">
      <div class="commandbar">
        <div class="mode" role="tablist" aria-label="Trace views">
          <button class="active" type="button" role="tab" aria-selected="true" data-mode="trace">${icon("waterfall")}Trace</button>
          <button type="button" role="tab" aria-selected="false" data-mode="dependencies">${icon("map")}Dependencies</button>
        </div>
        <div class="search-wrap">
          ${icon("search")}
          <input id="span-search" class="search" type="search" placeholder="Find agent, model, tool, or status" aria-label="Search spans">
        </div>
        <div class="focus" aria-label="Filter trace">
          <button class="active" type="button" data-focus="all">All <span>${events.length}</span></button>
          <button type="button" data-focus="errors">Errors <span>${failed.length}</span></button>
          <button type="button" data-focus="models">Models <span>${counts.chats}</span></button>
          <button type="button" data-focus="tools">Tools <span>${counts.tools}</span></button>
        </div>
        <div class="trace-meta">
          <span><strong>${formatDuration(duration)}</strong></span>
          <span><strong>${counts.peak}</strong> peak concurrency</span>
          <span><strong>${counts.inputTokens.toLocaleString()} / ${counts.outputTokens.toLocaleString()}</strong> tokens</span>
          <span><strong class="cost">${formatCost(counts.totalCost)}</strong> ${costLabel.toLowerCase()} cost</span>
        </div>
        <button class="icon-button export-control" id="download-svg" type="button" title="Download SVG" aria-label="Download SVG" hidden>${icon("download")}SVG</button>
        <button class="icon-button export-control" id="download-png" type="button" title="Download PNG" aria-label="Download PNG" hidden>${icon("download")}PNG</button>
      </div>
      <div class="canvas">
        <section class="trace-view" id="waterfall-view">
          <div class="axis"><span class="axis-label">Operation</span><div class="ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><span class="axis-label">Duration</span><span class="axis-label cost-axis">Cost</span><span></span></div>
          <div class="span-list">${rows}</div>
        </section>
        <section class="map-view" id="map-view" hidden>${pattern ? `<div class="graph-context">${escapeHtml(pattern === "parallel-delegation" ? "Parallel delegation · concurrent branches" : pattern === "sequential-pipeline" ? "Sequential pipeline · ordered dependent stages" : pattern === "critic-reviser-loop" ? "Critic-reviser · critique informs revision" : "Direct execution · no delegation")}</div>` : ""}<div class="graph-wrap">${graph}</div></section>
      </div>
    </main>
    <aside class="inspector">${detailPanels}</aside>
  </div>
</div>
<script>
(() => {
  const rows = [...document.querySelectorAll(".span-row")];
  const inspectors = [...document.querySelectorAll(".inspector-panel")];
  const graphNodes = [...document.querySelectorAll(".graph-node[data-event-id]")];
  const focusButtons = [...document.querySelectorAll("[data-focus]")];
  let focus = "all";
  let selectedId = ${JSON.stringify(selectedEvent.id)};
  const replaceLocation = ({ span, tab } = {}) => {
    const url = new URL(location.href);
    if (span !== undefined) url.hash = span ? "#span=" + encodeURIComponent(span) : "";
    if (tab !== undefined) {
      if (tab) url.searchParams.set("tab", tab);
      else url.searchParams.delete("tab");
    }
    history.replaceState(null, "", url);
  };

  const relatedIds = (id) => {
    const row = rows.find((candidate) => candidate.dataset.id === id);
    if (!row) return new Set();
    return new Set(rows.filter((candidate) => candidate.dataset.parent === id || candidate.dataset.id === row.dataset.parent).map((candidate) => candidate.dataset.id));
  };
  const applyFilters = () => {
    const query = document.querySelector("#span-search").value.trim().toLowerCase();
    rows.forEach((row) => {
      const focusMatch = focus === "all"
        || (focus === "errors" && row.dataset.failed === "true")
        || (focus === "models" && row.dataset.kind === "chat")
        || (focus === "tools" && row.dataset.kind === "execute_tool");
      row.classList.toggle("filtered", !focusMatch || (query && !row.dataset.filter.includes(query)));
    });
  };
  const selectSpan = (id, scroll = false) => {
    const selected = rows.find((row) => row.dataset.id === id);
    if (!selected) return;
    selectedId = id;
    const related = selected.dataset.parent || selected.dataset.owner ? relatedIds(id) : new Set();
    rows.forEach((row) => {
      row.classList.toggle("active", row.dataset.id === id);
      row.classList.toggle("relation-highlight", related.has(row.dataset.id));
      row.classList.toggle("branch-context", Boolean(selected.dataset.owner && row.dataset.owner === selected.dataset.owner));
      row.classList.toggle("dimmed", row.dataset.id !== id && !related.has(row.dataset.id) && selected.dataset.owner && row.dataset.owner !== selected.dataset.owner);
    });
    inspectors.forEach((panel) => panel.hidden = panel.dataset.inspector !== id);
    graphNodes.forEach((node) => node.classList.toggle("active", node.dataset.eventId === id));
    if (scroll) selected.scrollIntoView({block:"center",behavior:"smooth"});
    replaceLocation({ span: id });
  };
  rows.forEach((row) => {
    row.addEventListener("click", () => selectSpan(row.dataset.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSpan(row.dataset.id); }
    });
  });
  document.querySelectorAll("[data-select]").forEach((button) => button.addEventListener("click", () => selectSpan(button.dataset.select, true)));
  graphNodes.forEach((node) => {
    node.addEventListener("click", () => selectSpan(node.dataset.eventId));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSpan(node.dataset.eventId); }
    });
  });
  focusButtons.forEach((button) => button.addEventListener("click", () => {
    focus = button.dataset.focus;
    focusButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    applyFilters();
    const selected = rows.find((row) => row.dataset.id === selectedId);
    if (selected?.classList.contains("filtered")) {
      const firstVisible = rows.find((row) => !row.classList.contains("filtered") && !row.classList.contains("collapsed"));
      if (firstVisible) selectSpan(firstVisible.dataset.id);
    }
  }));
  document.querySelector("#span-search").addEventListener("input", applyFilters);

  const descendants = (id) => {
    const direct = rows.filter((row) => row.dataset.parent === id);
    return direct.flatMap((row) => [row, ...descendants(row.dataset.id)]);
  };
  document.querySelectorAll("[data-collapse]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const closed = button.classList.toggle("closed");
    descendants(button.dataset.collapse).forEach((row) => row.classList.toggle("collapsed", closed));
  }));

  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    const map = button.dataset.mode === "dependencies";
    document.querySelectorAll("[data-mode]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    document.querySelectorAll("[data-mode]").forEach((candidate) => candidate.setAttribute("aria-selected", String(candidate === button)));
    document.querySelector("#waterfall-view").hidden = map;
    document.querySelector("#map-view").hidden = !map;
    document.querySelectorAll(".export-control").forEach((control) => control.hidden = !map);
    document.querySelector(".search-wrap").hidden = map;
    document.querySelector(".focus").hidden = map;
    document.querySelector(".trace-meta").style.marginLeft = map ? "auto" : "";
    replaceLocation({ tab: map ? "dependencies" : "trace" });
  }));

  const serializeGraph = () => {
    const svg = document.querySelector("#dependency-graph").cloneNode(true);
    const styles = getComputedStyle(document.documentElement);
    const dark = document.documentElement.dataset.theme === "dark";
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.insertAdjacentHTML("afterbegin", "<style>.graph-edges path{fill:none;stroke:" + styles.getPropertyValue("--border-strong") + ";stroke-width:1.2}.graph-node rect{fill:" + styles.getPropertyValue("--surface") + ";stroke:" + styles.getPropertyValue("--border-strong") + "}.graph-node circle{fill:" + styles.getPropertyValue("--violet") + "}.graph-node.execute_tool circle{fill:" + styles.getPropertyValue("--green") + "}.graph-node.chat circle{fill:" + styles.getPropertyValue("--blue") + "}.graph-node.failed rect{stroke:" + styles.getPropertyValue("--red") + "}.graph-node.failed circle{fill:" + styles.getPropertyValue("--red") + "}.graph-node text{fill:" + styles.getPropertyValue("--text") + ";font:650 10px sans-serif}.graph-node .graph-meta{fill:" + styles.getPropertyValue("--muted") + ";font-size:8px;font-weight:500}</style><rect width='100%' height='100%' fill='" + (dark ? "#0b0f17" : "#ffffff") + "'/>");
    return new XMLSerializer().serializeToString(svg);
  };
  const download = (blob, name) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  document.querySelector("#download-svg").addEventListener("click", () => download(new Blob([serializeGraph()], {type:"image/svg+xml"}), "copilot-trace-dependency-graph.svg"));
  document.querySelector("#download-png").addEventListener("click", () => {
    const box = document.querySelector("#dependency-graph").viewBox.baseVal;
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(2, 4096 / Math.max(box.width, box.height));
      const canvas = document.createElement("canvas"); canvas.width = box.width * scale; canvas.height = box.height * scale;
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob && download(blob, "copilot-trace-dependency-graph.png"), "image/png");
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(new Blob([serializeGraph()], {type:"image/svg+xml"}));
  });

  const requested = decodeURIComponent((location.hash.match(/^#span=(.+)$/) || [])[1] || "");
  selectSpan(rows.some((row) => row.dataset.id === requested) ? requested : selectedId);
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("capture") === "graph") document.body.classList.add("capture-graph");
  const requestedTab = searchParams.get("tab");
  if (requestedTab === "dependencies" || new URLSearchParams(location.search).get("view") === "map") {
    const mapButton = document.querySelector('[data-mode="dependencies"]');
    mapButton.click();
  }
})();
</script>
</body>
</html>`;
}
