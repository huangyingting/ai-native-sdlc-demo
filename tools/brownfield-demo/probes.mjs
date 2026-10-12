import { performance } from "node:perf_hooks";

export function loopbackUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use an explicit http://127.0.0.1:PORT origin without credentials, path or query.");
  }
  return url.origin;
}

export async function boundedBody(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("HTTP response exceeds the demo probe limit.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function exactStatus(body, status) {
  try {
    const value = JSON.parse(body);
    return value !== null && Object.keys(value).length === 1 && value.status === status;
  } catch { return false; }
}

export async function probeService(value, {
  fetcher = fetch, timeoutMs = 1500, readinessRequired = true,
} = {}) {
  const url = loopbackUrl(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) {
    throw new Error("Probe timeout must be an integer from 50 to 30000 milliseconds.");
  }
  async function request(path, contract) {
    const start = performance.now();
    let status = null;
    try {
      const response = await fetcher(`${url}${path}`, {
        signal: AbortSignal.timeout(timeoutMs), redirect: "error",
      });
      status = response.status;
      const body = await boundedBody(response);
      const failure = contract(response, body);
      return {
        ok: failure === null, status, latencyMs: Math.round(performance.now() - start),
        ...(failure === null ? {} : { failure }),
      };
    } catch {
      return { ok: false, status, latencyMs: Math.round(performance.now() - start), failure: "transport" };
    }
  }
  const json = (response) => /^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "");
  const health = await request("/api/health", (response, body) =>
    response.status === 200 && json(response) && exactStatus(body, "ok") ? null : "health-contract");
  const readiness = readinessRequired
    ? await request("/api/ready", (response, body) => {
      if (!json(response) || response.headers.get("cache-control") !== "no-store") return "readiness-contract";
      if (response.status === 200 && exactStatus(body, "ready")) return null;
      if (response.status === 503 && exactStatus(body, "unavailable")) return "unavailable";
      return "readiness-contract";
    })
    : { ok: true, status: null, latencyMs: 0, omitted: "baseline-without-readiness" };
  let journey = { ok: false, status: null, latencyMs: 0, failure: "not-ready" };
  if (health.ok && readiness.ok) {
    const dashboard = await request("/?q=INC-0001", (response, body) =>
      response.status === 200 && body.includes('data-testid="service-desk-dashboard"') &&
      body.includes("INC-0001") && body.includes('href="/tickets/1"') ? null : "dashboard-contract");
    const detail = await request("/tickets/1", (response, body) =>
      response.status === 200 && body.includes("INC-0001") && body.includes("Ticket details")
        ? null : "detail-contract");
    journey = {
      ok: dashboard.ok && detail.ok,
      status: !dashboard.ok ? dashboard.status : detail.status,
      latencyMs: dashboard.latencyMs + detail.latencyMs,
      ...(!dashboard.ok || !detail.ok ? { failure: dashboard.failure ?? detail.failure } : {}),
    };
  }
  return {
    at: new Date().toISOString(), ok: health.ok && readiness.ok && journey.ok,
    health, readiness, journey,
  };
}

export function requireHealthy(probe) {
  if (probe?.ok !== true || !probe.health?.ok || !probe.readiness?.ok || !probe.journey?.ok) {
    throw new Error("Health, readiness and the ticket read journey must all pass.");
  }
  return probe;
}

export function requireUnavailable(probe) {
  if (probe?.ok !== false || probe.health?.ok !== true || probe.readiness?.status !== 503 ||
      probe.readiness.failure !== "unavailable") {
    throw new Error("Fault control must remain live and return exact 503/no-store/unavailable readiness.");
  }
  return probe;
}
