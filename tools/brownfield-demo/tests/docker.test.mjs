import test from "node:test";
import assert from "node:assert/strict";
import { exactImage, localPort, resources, runImage, stopImage } from "../docker.mjs";
import { seedProbe, verifySeededDataset } from "../dataset.mjs";
import { loadManifest } from "../scenarios.mjs";
import { image } from "./helpers.mjs";

const options = { repo: "example/demo", intent: "42", image, port: "3100" };
const resource = resources(options.repo, options.intent);
const id = "c".repeat(64);
const label = "io.github.brownfield-demo";
const labels = {
  [`${label}.managed`]: "v1", [`${label}.repository`]: "example/demo",
  [`${label}.intent`]: "42", [`${label}.image`]: image,
};
const volumeInfo = () => ({ Name: resource.volume, Labels: { ...labels } });
const containerInfo = () => ({
  Id: id, Name: `/${resource.container}`, Config: { Image: image, Labels: { ...labels } },
  Mounts: [{ Type: "volume", Name: resource.volume, Destination: "/app/data" }],
  State: { Running: true }, NetworkSettings: { Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3100" }] } },
});
const dataset = () => ({
  count: 4, rows: loadManifest().fixtures.map(({ reference, owner, ...fields }, index) => ({ id: index + 1, ...fields })),
});
function dockerMock({ container = null, volume = null, daemonError = false, legacyVolumeError = false, seed = dataset() } = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    assert.equal(command, "docker");
    if (daemonError) throw new Error("Cannot connect to daemon");
    if (args[1] === "inspect") {
      const data = args[0] === "container" ? container : volume;
      if (!data) throw Object.assign(new Error("absent"), {
        stderr: args[0] === "volume" && !legacyVolumeError
          ? `Error response from daemon: get ${args[2]}: no such volume`
          : `Error response from daemon: No such ${args[0]}: ${args[2]}`,
      });
      return JSON.stringify([data]);
    }
    if (args[0] === "pull") return "pulled";
    if (args[0] === "volume" && args[1] === "create") { volume = volumeInfo(); return resource.volume; }
    if (args[0] === "run") { container = containerInfo(); return id; }
    if (args[0] === "exec") {
      assert.deepEqual(args, ["exec", id, "node", "--input-type=module", "-e", seedProbe]);
      return JSON.stringify(seed);
    }
    if (args[0] === "stop") { container.State.Running = false; return id; }
    if (args[0] === "container" && args[1] === "rm") { container = null; return id; }
    if (args[0] === "volume" && args[1] === "rm") { volume = null; return resource.volume; }
    throw new Error("Unexpected Docker command");
  };
  return { run, calls };
}

test("only exact GHCR digests and bounded unprivileged ports are accepted", () => {
  assert.equal(exactImage(image), image);
  for (const value of ["nginx:latest", "ghcr.io/example/demo:main", `${image}:latest`, image.replace("sha256:", "sha512:"), image.replace(/b$/, "B"), `${image} --privileged`, "https://" + image]) {
    assert.throws(() => exactImage(value), /exact/);
  }
  assert.equal(localPort("1024"), 1024);
  assert.equal(localPort(65535), 65535);
  for (const value of [0, 80, -1, 65536, "3000:3000", "3e3", "3000.0", "03000", "3000\n"]) assert.throws(() => localPort(value));
  assert.notDeepEqual(resources("example/demo", 42), resources("example/other", 42));
  assert.throws(() => resources("https://github.com/example/demo", 42));
  assert.throws(() => resources("example/demo", "../42"));
});

test("run uses isolated named volume, loopback and exact digest; verifies both endpoints", async () => {
  const docker = dockerMock();
  const urls = [];
  const result = await runImage(options, {
    run: docker.run,
    fetcher: async (url, settings) => {
      urls.push(url);
      assert.equal(settings.redirect, "error");
      return new Response(url.endsWith("/api/health") ? '{"status":"ok"}' : '<main data-testid="service-desk-dashboard">');
    },
  });
  assert.equal(result.healthVerified, true);
  assert.equal(result.dashboardVerified, true);
  assert.equal(result.accepted, false);
  assert.equal(result.dataset.verified, true);
  assert.equal(result.dataset.ticketCount, 4);
  assert.equal(result.dataset.ownershipVerified, false);
  assert.ok(docker.calls.some((call) => call[1] === "exec" && call[2] === id));
  assert.deepEqual(urls, ["http://127.0.0.1:3100/api/health", "http://127.0.0.1:3100/"]);
  const run = docker.calls.find((call) => call[1] === "run");
  assert.equal(run.at(-1), image);
  assert.ok(run.includes("127.0.0.1:3100:3000"));
  assert.ok(run.includes(`type=volume,source=${resource.volume},target=/app/data`));
  assert.ok(run.includes("SERVICE_DESK_DB_PATH=/app/data/service-desk.db"));
  assert.ok(!run.some((arg) => ["--privileged", "--network=host", "--rm"].includes(arg)));
  assert.ok(docker.calls.every((call) => !call.includes("prune")));
});

test("deterministic seed verification checks IDs, complete original fields and exact fixed dates", () => {
  assert.equal(verifySeededDataset(dataset()).verified, true);
  for (const change of [
    (value) => { value.count = 5; },
    (value) => { value.rows[0].id = 99; },
    (value) => { value.rows[0].createdAt = new Date().toISOString(); },
    (value) => { value.rows[1].requesterEmail = "different@example.com"; },
    (value) => { value.rows[2].description = "different seed"; },
    (value) => { value.rows[3].status = "closed"; },
  ]) {
    const value = dataset();
    change(value);
    assert.throws(() => verifySeededDataset(value), /seeded|seed differs/);
  }
  assert.match(seedProbe, /readOnly: true/);
  assert.doesNotMatch(seedProbe, /\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/);
});

test("run never claims seeded readiness from dashboard HTML alone or resets a mismatched dataset", async () => {
  const docker = dockerMock({ seed: { count: 0, rows: [] } });
  await assert.rejects(runImage(options, {
    run: docker.run,
    fetcher: async (url) => new Response(url.endsWith("/api/health") ? '{"status":"ok"}' : 'data-testid="service-desk-dashboard"'),
  }), /exactly four seeded tickets/);
  assert.ok(!docker.calls.some((call) => call.includes("rm") || call.includes("prune")));
});

test("existing resources and unavailable daemon are not treated as permission to overwrite", async () => {
  for (const state of [{ container: containerInfo() }, { volume: volumeInfo() }, { daemonError: true }]) {
    const docker = dockerMock(state);
    await assert.rejects(runImage(options, { run: docker.run }), /already exists|daemon/);
    assert.ok(!docker.calls.some((call) => ["run", "pull", "stop"].includes(call[1]) || call.includes("create")));
  }
});

test("volume inspection recognizes current and legacy absence but propagates other daemon errors", async () => {
  for (const legacyVolumeError of [false, true]) {
    const docker = dockerMock({ legacyVolumeError });
    const result = stopImage(options, { run: docker.run });
    assert.equal(result.stopped, false);
    assert.equal(result.dataRetained, false);
    assert.ok(docker.calls.every((call) => call[2] === "inspect"));
  }
  for (const stderr of [
    `Error response from daemon: get ${resource.volume}: permission denied`,
    `Error response from daemon: get ${resource.volume}-different: no such volume`,
  ]) {
    const docker = dockerMock();
    const error = Object.assign(new Error(stderr), { stderr });
    await assert.rejects(runImage(options, {
      run: (command, args) => {
        if (args[0] === "volume" && args[1] === "inspect") throw error;
        return docker.run(command, args);
      },
    }), (actual) => actual === error);
    assert.ok(!docker.calls.some((call) => call[1] === "pull"));
  }
});

test("failed or misleading HTTP smoke checks leave diagnostic resources, never claim acceptance", async () => {
  for (const fetcher of [
    async () => new Response('{"status":"ok"}'),
    async () => { throw new Error("unreachable"); },
    async (url) => new Response(url.endsWith("/api/health") ? '{"status":"bad"}' : 'data-testid="service-desk-dashboard"'),
  ]) {
    const docker = dockerMock();
    await assert.rejects(runImage(options, { run: docker.run, fetcher, attempts: 1 }), /Managed resources may remain/);
    assert.ok(!docker.calls.some((call) => call.includes("rm") || call.includes("prune")));
  }
});

test("stop defaults to retaining container/data; cleanup targets exact IDs and labeled volume", () => {
  const retained = dockerMock({ container: containerInfo(), volume: volumeInfo() });
  const result = stopImage(options, { run: retained.run });
  assert.equal(result.dataRetained, true);
  assert.ok(retained.calls.some((call) => call[1] === "stop" && call.at(-1) === id));
  assert.ok(!retained.calls.some((call) => call.includes("rm")));
  const cleaned = dockerMock({ container: containerInfo(), volume: volumeInfo() });
  stopImage({ ...options, cleanup: true }, { run: cleaned.run });
  assert.deepEqual(cleaned.calls.filter((call) => call.includes("rm")), [
    ["docker", "container", "rm", id], ["docker", "volume", "rm", resource.volume],
  ]);
});

test("stop refuses wrong repository, intent, manager, image, mount, or volume labels before any deletion", () => {
  for (const mutate of [
    (container) => { container.Config.Labels[`${label}.repository`] = "example/other"; },
    (container) => { container.Config.Labels[`${label}.intent`] = "99"; },
    (container) => { delete container.Config.Labels[`${label}.managed`]; },
    (container) => { container.Config.Image = "nginx:latest"; },
    (container) => { container.Mounts[0].Name = "production-db"; },
    (container) => { container.Mounts.push({ Type: "bind", Source: "/", Destination: "/host" }); },
    (_, volume) => { volume.Labels[`${label}.repository`] = "example/other"; },
  ]) {
    const container = containerInfo();
    const volume = volumeInfo();
    mutate(container, volume);
    const docker = dockerMock({ container, volume });
    assert.throws(() => stopImage({ ...options, cleanup: true }, { run: docker.run }), /Refusing/);
    assert.ok(docker.calls.every((call) => call[2] === "inspect"));
  }
});

test("cleanup can remove only a matching orphaned managed volume", () => {
  const docker = dockerMock({ volume: volumeInfo() });
  stopImage({ ...options, cleanup: true }, { run: docker.run });
  assert.deepEqual(docker.calls.at(-1), ["docker", "volume", "rm", resource.volume]);
  const other = volumeInfo();
  delete other.Labels[`${label}.managed`];
  const unowned = dockerMock({ volume: other });
  assert.throws(() => stopImage({ ...options, cleanup: true }, { run: unowned.run }), /Refusing/);
  assert.ok(!unowned.calls.some((call) => call.includes("rm")));
});
