import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { test } from "node:test";
import { createGateway } from "../gateway.mjs";

const image = `ghcr.io/test/service@sha256:${"a".repeat(64)}`;
const healthy = () => ({ ok: true, health: { ok: true }, readiness: { ok: true }, journey: { ok: true } });

test("gateway rejects bad admission, serves selected release and rechecks rollback", async (t) => {
  const upstream = createServer((request, response) => response.end("real upstream"));
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  t.after(() => { upstream.closeAllConnections(); return new Promise((resolve) => upstream.close(resolve)); });
  const url = `http://127.0.0.1:${upstream.address().port}`;
  let pass = true;
  const gateway = await createGateway({ probe: async () => pass ? healthy() : { ok: false } });
  t.after(() => gateway.close());
  assert.equal((await fetch(gateway.url)).status, 503);
  await gateway.promote({ url, image, release: "stable" });
  pass = false;
  await assert.rejects(gateway.promote({ url, image, release: "bad" }));
  assert.equal(gateway.active.release, "stable");
  pass = true;
  await gateway.promote({ url, image, release: "candidate" });
  const response = await fetch(gateway.url);
  assert.equal(await response.text(), "real upstream");
  assert.equal(response.headers.get("x-demo-release"), "candidate");
  pass = false;
  await assert.rejects(gateway.rollback());
  assert.equal(gateway.active.release, "candidate");
  pass = true;
  await gateway.rollback();
  assert.equal((await fetch(gateway.url)).headers.get("x-demo-release"), "stable");
  assert.equal((await fetch(gateway.url, { method: "POST", body: "no mutation allowed" })).status, 405);
  assert.equal((await fetch(`${gateway.url}/admin`)).status, 405);
  assert.deepEqual(gateway.events.map((event) => event.action), ["promote", "rejected", "promote", "rejected", "rollback"]);
});

test("concurrent admission cannot overwrite a newer transition", async (t) => {
  let release;
  const gateway = await createGateway({ probe: () => new Promise((resolve) => { release = resolve; }) });
  t.after(() => gateway.close());
  const pending = gateway.promote({ url: "http://127.0.0.1:1234", image, release: "one" });
  await assert.rejects(gateway.promote({ url: "http://127.0.0.1:1235", image, release: "two" }), /in progress/);
  release(healthy());
  await pending;
  assert.equal(gateway.active.release, "one");
});
