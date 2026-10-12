import { randomUUID } from "node:crypto";
import { execute } from "./common.mjs";
import { exactImage } from "./docker.mjs";

const label = "io.github.brownfield-reliability.run";

export function immutableImage(value) {
  if (/^sha256:[a-f0-9]{64}$/.test(value ?? "")) return value;
  return exactImage(value);
}

export function createLab(image, { run = execute } = {}) {
  immutableImage(image);
  const id = randomUUID().replaceAll("-", "");
  const prefix = `brownfield-reliability-${id.slice(0, 16)}`;
  const volume = `${prefix}-data`;
  const containers = [];
  let volumeCreated = false;
  let imageId;
  let revision;
  function inspect(kind, name) {
    const entries = JSON.parse(run("docker", [kind, "inspect", name]));
    if (!Array.isArray(entries) || entries.length !== 1) throw new Error("Unexpected Docker inspection.");
    return entries[0];
  }
  function checkVolume({ allowMissing = false } = {}) {
    let info;
    try {
      info = inspect("volume", volume);
    } catch (error) {
      if (allowMissing && String(error.stderr ?? "").trim() ===
          `Error response from daemon: get ${volume}: no such volume`) return null;
      throw error;
    }
    if (info.Name !== volume || info.Labels?.[label] !== id) throw new Error("Refusing unmanaged volume.");
    return info;
  }
  function checkContainer(container) {
    let info;
    try {
      info = inspect("container", container.id ?? container.name);
    } catch (error) {
      const stderr = String(error.stderr ?? "").trim();
      if (container.id === null && [
        `Error: No such container: ${container.name}`,
        `Error response from daemon: No such container: ${container.name}`,
      ].includes(stderr)) return null;
      throw error;
    }
    const mounts = info.Mounts ?? [];
    if (!/^[a-f0-9]{64}$/.test(info.Id ?? "") ||
        (container.id !== null && info.Id !== container.id) || info.Name !== `/${container.name}` ||
        info.Config?.Labels?.[label] !== id || info.Config?.Image !== image || info.Image !== imageId ||
        mounts.length !== (container.fault ? 0 : 1) ||
        mounts.some((mount) => mount.Type !== "volume" || mount.Name !== volume || mount.Destination !== "/app/data")) {
      throw new Error("Refusing container with mismatched identity, image, label or mounts.");
    }
    container.id = info.Id;
    return info;
  }
  return {
    id, volume,
    get revision() { return revision; },
    get containers() { return containers.map((container) => ({ ...container })); },
    initialize() {
      if (imageId) throw new Error("Lab is already initialized.");
      if (image.startsWith("ghcr.io/")) run("docker", ["pull", image], { timeout: 180_000 });
      const imageInfo = inspect("image", image);
      imageId = imageInfo.Id;
      revision = imageInfo.Config?.Labels?.["org.opencontainers.image.revision"] ?? null;
      if (!/^sha256:[a-f0-9]{64}$/.test(imageId ?? "")) throw new Error("Invalid immutable Docker image ID.");
      if (run("docker", ["volume", "ls", "--filter", `name=^${volume}$`, "--format", "{{.Name}}"]).trim()) {
        throw new Error("Fresh lab volume already exists; nothing was changed.");
      }
      volumeCreated = true;
      run("docker", ["volume", "create", "--label", `${label}=${id}`, volume]);
      checkVolume();
    },
    start(role, { fault = false } = {}) {
      if (!imageId || !volumeCreated) throw new Error("Initialize the lab first.");
      if (!/^[a-z][a-z0-9-]{0,20}$/.test(role) || containers.some((entry) => entry.role === role)) {
        throw new Error("Invalid or reused lab role.");
      }
      checkVolume();
      const container = { id: null, name: `${prefix}-${role}`, role, fault };
      containers.push(container);
      const containerId = run("docker", [
        "run", "--detach", "--name", container.name, "--label", `${label}=${id}`,
        "--publish", "127.0.0.1::3000",
        "--env", `SERVICE_DESK_DB_PATH=${fault ? "/dev/null/service-desk.db" : "/app/data/service-desk.db"}`,
        ...(!fault ? ["--mount", `type=volume,source=${volume},target=/app/data`] : []), image,
      ], { timeout: 60_000 }).trim();
      if (!/^[a-f0-9]{64}$/.test(containerId)) throw new Error("Invalid created container ID.");
      container.id = containerId;
      const info = checkContainer(container);
      const ports = info.NetworkSettings?.Ports?.["3000/tcp"];
      if (!info.State?.Running || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" ||
          !/^\d+$/.test(ports[0].HostPort)) throw new Error("Lab must bind only an allocated loopback port.");
      container.url = `http://127.0.0.1:${ports[0].HostPort}`;
      return { ...container };
    },
    exec(container, script) {
      checkContainer(container);
      return run("docker", ["exec", container.id, "node", "--input-type=module", "-e", script]);
    },
    pause(container) {
      checkContainer(container);
      run("docker", ["pause", container.id]);
      if (checkContainer(container).State?.Paused !== true) throw new Error("Fault injection did not pause the intended container.");
    },
    unpause(container) {
      checkContainer(container);
      run("docker", ["unpause", container.id]);
      if (checkContainer(container).State?.Paused !== false) throw new Error("Container remained paused.");
    },
    cleanup() {
      const errors = [];
      for (const container of [...containers].reverse()) {
        try {
          const info = checkContainer(container);
          if (!info) continue;
          if (info.State?.Paused) run("docker", ["unpause", container.id]);
          run("docker", ["container", "rm", "--force", container.id]);
        } catch (error) { errors.push(error); }
      }
      if (volumeCreated && errors.length === 0) {
        try {
          if (checkVolume({ allowMissing: true })) run("docker", ["volume", "rm", volume]);
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Lab cleanup failed; inspect the recorded exact resource IDs.");
    },
  };
}
