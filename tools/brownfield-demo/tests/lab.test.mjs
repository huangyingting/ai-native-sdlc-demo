import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createLab, immutableImage } from "../lab.mjs";

const image = `ghcr.io/test/service@sha256:${"a".repeat(64)}`;
const imageId = `sha256:${"b".repeat(64)}`;

function fixture() {
  const calls = [];
  const entries = new Map();
  let volume;
  let labels;
  const run = (command, args) => {
    assert.equal(command, "docker");
    calls.push(args);
    if (args[0] === "pull") return "";
    if (args[0] === "image") return JSON.stringify([{ Id: imageId }]);
    if (args[0] === "volume") {
      if (args[1] === "ls") return "";
      if (args[1] === "create") {
        volume = args.at(-1);
        const [key, value] = args[3].split("=");
        labels = { [key]: value };
        return volume;
      }
      if (args[1] === "inspect") return JSON.stringify([{ Name: volume, Labels: labels }]);
      return "";
    }
    if (args[0] === "run") {
      const id = String(entries.size + 1).repeat(64);
      const fault = !args.includes("--mount");
      entries.set(id, {
        Id: id, Image: imageId, Name: `/${args[args.indexOf("--name") + 1]}`,
        Config: { Image: image, Labels: labels }, State: { Running: true, Paused: false },
        NetworkSettings: { Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "32000" }] } },
        Mounts: fault ? [] : [{ Type: "volume", Name: volume, Destination: "/app/data" }],
      });
      return id;
    }
    if (args[0] === "container" && args[1] === "inspect") {
      const entry = entries.get(args[2]) ?? [...entries.values()].find((value) => value.Name === `/${args[2]}`);
      if (!entry) throw Object.assign(new Error("Docker inspect failed"), { stderr: `Error: No such container: ${args[2]}` });
      return JSON.stringify([entry]);
    }
    if (args[0] === "pause" || args[0] === "unpause") {
      entries.get(args[1]).State.Paused = args[0] === "pause";
      return "";
    }
    return "";
  };
  return { run, calls, entries };
}

test("lab owns only fresh labelled resources and faults have no data volume", () => {
  const fake = fixture();
  const lab = createLab(image, fake);
  lab.initialize();
  const stable = lab.start("stable");
  const fault = lab.start("fault", { fault: true });
  assert.equal(stable.url, "http://127.0.0.1:32000");
  assert.equal(fake.entries.get(fault.id).Mounts.length, 0);
  lab.pause(stable);
  lab.unpause(stable);
  lab.cleanup();
  assert.deepEqual(fake.calls.filter((args) => args[0] === "container" && args[1] === "rm"), [
    ["container", "rm", "--force", fault.id], ["container", "rm", "--force", stable.id],
  ]);
  assert.deepEqual(fake.calls.at(-1), ["volume", "rm", lab.volume]);
});

test("cleanup refuses substituted resources and preserves volume for diagnosis", () => {
  const fake = fixture();
  const lab = createLab(image, fake);
  lab.initialize();
  const stable = lab.start("stable");
  fake.entries.get(stable.id).Config = { Image: image, Labels: {} };
  assert.throws(() => lab.cleanup(), /cleanup failed/);
  assert.equal(fake.calls.some((args) => args.includes("rm")), false);
});

test("immutable image validation refuses tags and roles cannot be reused", () => {
  for (const invalid of ["it-service-desk:latest", "ghcr.io/test/service:main", "sha256:no", "--privileged"]) {
    assert.throws(() => immutableImage(invalid));
  }
  assert.equal(immutableImage(imageId), imageId);
  const fake = fixture();
  const lab = createLab(image, fake);
  assert.throws(() => lab.start("stable"), /Initialize/);
  lab.initialize();
  lab.start("stable");
  assert.throws(() => lab.start("stable"), /reused/);
  assert.throws(() => lab.start("../other"), /Invalid/);
});

test("failed daemon-side starts are reconciled by exact name and cleaned by verified ID", () => {
  const fake = fixture();
  const lab = createLab(image, {
    run(command, args) {
      const value = fake.run(command, args);
      if (args[0] === "run") throw Object.assign(new Error("client timed out after daemon creation"), { code: "ETIMEDOUT" });
      return value;
    },
  });
  lab.initialize();
  assert.throws(() => lab.start("bad-config", { fault: true }), /timed out/);
  assert.equal(lab.containers[0].id, null);
  lab.cleanup();
  assert.equal(lab.containers[0].id, "1".repeat(64));
  assert.ok(fake.calls.some((args) => args.join(" ") === `container rm --force ${"1".repeat(64)}`));
});

test("a failed command before creation permits cleanup only after exact absence is confirmed", () => {
  const fake = fixture();
  const lab = createLab(image, {
    run(command, args) {
      if (args[0] === "run") throw new Error("creation failed");
      return fake.run(command, args);
    },
  });

  lab.initialize();
  assert.throws(() => lab.start("stable"), /creation failed/);
  lab.cleanup();
  assert.equal(fake.calls.some((args) => args[0] === "container" && args[1] === "rm"), false);
  assert.deepEqual(fake.calls.at(-1), ["volume", "rm", lab.volume]);
});

test("a volume created before a client timeout remains in cleanup scope", () => {
  const fake = fixture();
  const lab = createLab(image, {
    run(command, args) {
      const value = fake.run(command, args);
      if (args[0] === "volume" && args[1] === "create") throw new Error("volume creation timed out");
      return value;
    },
  });
  assert.throws(() => lab.initialize(), /timed out/);
  lab.cleanup();
  assert.deepEqual(fake.calls.at(-1), ["volume", "rm", lab.volume]);
});
