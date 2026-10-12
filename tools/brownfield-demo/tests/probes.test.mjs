import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loopbackUrl, probeService, requireHealthy, requireUnavailable } from "../probes.mjs";

function fetcher(overrides = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (overrides[path]) return overrides[path]();
    if (path === "/api/health") return Response.json({ status: "ok" });
    if (path === "/api/ready") return Response.json({ status: "ready" }, { headers: { "cache-control": "no-store" } });
    return new Response(path === "/" ? '<main data-testid="service-desk-dashboard"><a href="/tickets/1">INC-0001</a>' : "INC-0001 Ticket details");
  };
}

test("probes require exact readiness, live health and a real ticket read journey", async () => {
  const result = await probeService("http://127.0.0.1:1234", { fetcher: fetcher() });
  assert.equal(requireHealthy(result), result);
  assert.equal(JSON.stringify(result).includes("Ticket details"), false);
});

test("unavailability is distinct from transport failure and incorrect contracts", async () => {
  const fault = await probeService("http://127.0.0.1:1234", { fetcher: fetcher({
    "/api/ready": () => Response.json({ status: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } }),
  }) });
  requireUnavailable(fault);
  assert.throws(() => requireHealthy(fault));
  for (const response of [
    () => Response.json({ status: "unavailable" }, { status: 503 }),
    () => Response.json({ status: "unavailable", secret: "private" }, { status: 503, headers: { "cache-control": "no-store" } }),
    () => { throw new Error("private path"); },
  ]) {
    const result = await probeService("http://127.0.0.1:1234", { fetcher: fetcher({ "/api/ready": response }) });
    assert.throws(() => requireUnavailable(result));
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("passing readiness without ticket data cannot pass the journey", async () => {
  const result = await probeService("http://127.0.0.1:1234", { fetcher: fetcher({ "/tickets/1": () => new Response("generic 200") }) });
  assert.equal(result.journey.failure, "detail-contract");
  assert.throws(() => requireHealthy(result));
});

test("baseline mode is explicit and does not pretend readiness was tested", async () => {
  const result = await probeService("http://127.0.0.1:1234", { readinessRequired: false, fetcher: fetcher({
    "/api/ready": () => { throw new Error("must not request readiness"); },
  }) });
  assert.equal(result.ok, true);
  assert.equal(result.readiness.omitted, "baseline-without-readiness");
});

test("probes reject unsafe origins and oversized bodies", async () => {
  for (const value of ["https://127.0.0.1:1234", "http://example.com:1234", "http://127.0.0.1:1234/?secret=x",
    "http://a:b@127.0.0.1:1234", "http://127.0.0.1:1234/path"]) assert.throws(() => loopbackUrl(value));
  const result = await probeService("http://127.0.0.1:1234", { fetcher: fetcher({ "/api/health": () => new Response("x".repeat(1_000_001)) }) });
  assert.equal(result.health.failure, "transport");
  assert.equal(result.ok, false);
});
