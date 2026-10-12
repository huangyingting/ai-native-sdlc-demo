import { createServer } from "node:http";
import { exactImage } from "./docker.mjs";
import { boundedBody, loopbackUrl, probeService, requireHealthy } from "./probes.mjs";

const paths = new Set(["/", "/?q=INC-0001", "/api/health", "/api/ready", "/tickets/1"]);

export async function createGateway({ probe = probeService, timeoutMs = 2000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) {
    throw new Error("Invalid gateway timeout.");
  }
  let active = null;
  let previous = null;
  let switching = false;
  const events = [];
  const server = createServer(async (request, response) => {
    const selected = active;
    if (request.method !== "GET" || !paths.has(request.url)) {
      response.writeHead(405, { "content-type": "text/plain" }).end("Read-only demonstration gateway");
      return;
    }
    if (!selected) {
      response.writeHead(503, { "content-type": "text/plain" }).end("No admitted release");
      return;
    }
    try {
      const upstream = await fetch(`${selected.url}${request.url}`, {
        signal: AbortSignal.timeout(timeoutMs), redirect: "error",
      });
      const body = await boundedBody(upstream);
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "text/plain",
        "cache-control": "no-store", "x-demo-release": selected.release,
      }).end(body);
    } catch {
      response.writeHead(502, {
        "content-type": "text/plain", "cache-control": "no-store", "x-demo-release": selected.release,
      }).end("Upstream unavailable");
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  async function switchTo(target, rollback) {
    if (switching) throw new Error("Another release transition is in progress.");
    if (!target || !/^[a-z][a-z0-9-]{0,39}$/.test(target.release)) throw new Error("Invalid release identity.");
    const candidate = { url: loopbackUrl(target.url), image: exactImage(target.image), release: target.release };
    switching = true;
    try {
      requireHealthy(await probe(candidate.url));
      const old = active;
      active = candidate;
      previous = old;
      events.push({ at: new Date().toISOString(), action: rollback ? "rollback" : "promote", release: candidate.release });
      return { ...candidate };
    } catch (error) {
      events.push({ at: new Date().toISOString(), action: "rejected", release: candidate.release });
      throw error;
    } finally {
      switching = false;
    }
  }
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get active() { return active ? { ...active } : null; },
    get events() { return events.map((event) => ({ ...event })); },
    promote: (target) => switchTo(target, false),
    rollback: () => switchTo(previous, true),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}
