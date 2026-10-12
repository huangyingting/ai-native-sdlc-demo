import { execute, intentNumber, repository, sha256 } from "./common.mjs";
import { seedProbe, verifySeededDataset } from "./dataset.mjs";

const labelPrefix = "io.github.brownfield-demo";

export function exactImage(value) {
  if (typeof value !== "string" || /\s/.test(value) ||
      !/^ghcr\.io\/[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error("--image must be an exact ghcr.io/owner/image@sha256:<64 lowercase hex> reference, without a tag.");
  }
  return value;
}

export function localPort(value) {
  if (String(Number(value)) !== String(value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) ||
      Number(value) < 1024 || Number(value) > 65535) throw new Error("--port must be an integer from 1024 to 65535.");
  return Number(value);
}

export function resources(repo, intent) {
  repo = repository(repo);
  intent = intentNumber(intent);
  const name = `brownfield-demo-${sha256(`${repo}#${intent}`).slice(0, 24)}`;
  return { repo, intent, container: name, volume: `${name}-data` };
}

function labels(resource, image) {
  return {
    [`${labelPrefix}.managed`]: "v1",
    [`${labelPrefix}.repository`]: resource.repo,
    [`${labelPrefix}.intent`]: String(resource.intent),
    [`${labelPrefix}.image`]: exactImage(image),
  };
}

function inspect(run, kind, name) {
  try {
    const result = JSON.parse(run("docker", [kind, "inspect", name]));
    if (!Array.isArray(result) || result.length !== 1) throw new Error("Unexpected Docker inspect result.");
    return result[0];
  } catch (error) {
    const message = String(error.stderr ?? "").trim();
    if (new RegExp(`No such ${kind}(?: object)?:`, "i").test(message) ||
        (kind === "volume" && message === `Error response from daemon: get ${name}: no such volume`)) return null;
    throw error;
  }
}

function assertManaged(info, resource, kind, expectedImage) {
  const actual = kind === "container" ? info.Config?.Labels : info.Labels;
  const image = expectedImage ?? actual?.[`${labelPrefix}.image`];
  for (const [key, value] of Object.entries(labels(resource, image))) {
    if (actual?.[key] !== value) throw new Error(`Refusing ${kind}: managed repository/intent/image labels do not match.`);
  }
  const name = kind === "container" ? info.Name?.replace(/^\//, "") : info.Name;
  if (name !== resource[kind]) throw new Error(`Refusing ${kind}: name does not match.`);
  if (kind === "container" && (!/^[a-f0-9]{64}$/.test(info.Id ?? "") ||
      info.Config?.Image !== image || !Array.isArray(info.Mounts) ||
      !info.Mounts.some((mount) => mount.Type === "volume" && mount.Name === resource.volume &&
        mount.Destination === "/app/data") ||
      info.Mounts.some((mount) => mount.Name !== resource.volume || mount.Type !== "volume" || mount.Destination !== "/app/data"))) {
    throw new Error("Refusing container: unexpected image, ID, or data mount.");
  }
  return image;
}

async function body(response) {
  if (!response.ok) throw new Error("HTTP probe failed.");
  let text = "";
  for await (const chunk of response.body) {
    text += Buffer.from(chunk).toString("utf8");
    if (text.length > 1_000_000) throw new Error("Oversized HTTP probe response.");
  }
  return text;
}

export async function runImage(options, {
  run = execute, fetcher = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)), attempts = 30,
} = {}) {
  const resource = resources(options.repo, options.intent);
  const image = exactImage(options.image);
  const port = localPort(options.port);
  if (inspect(run, "container", resource.container) || inspect(run, "volume", resource.volume)) {
    throw new Error("A container or data volume already exists for this repository/Intent. Inspect it; use stop --cleanup explicitly for a fresh dataset. Nothing was changed.");
  }
  const labelArgs = Object.entries(labels(resource, image)).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
  run("docker", ["pull", image], { timeout: 180_000 });
  run("docker", ["volume", "create", ...labelArgs, resource.volume]);
  const volume = inspect(run, "volume", resource.volume);
  if (!volume) throw new Error("Created volume could not be inspected.");
  assertManaged(volume, resource, "volume", image);
  try {
    run("docker", [
      "run", "--detach", "--name", resource.container, ...labelArgs,
      "--publish", `127.0.0.1:${port}:3000`,
      "--env", "SERVICE_DESK_DB_PATH=/app/data/service-desk.db",
      "--mount", `type=volume,source=${resource.volume},target=/app/data`,
      image,
    ], { timeout: 60_000 });
    const started = inspect(run, "container", resource.container);
    assertManaged(started, resource, "container", image);
    const bindings = started.NetworkSettings?.Ports?.["3000/tcp"];
    if (started.State?.Running !== true || bindings?.length !== 1 ||
        bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== String(port)) {
      throw new Error("Container is not running on the requested loopback port.");
    }
    let healthy = false;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const health = JSON.parse(await body(await fetcher(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(3000), redirect: "error",
        })));
        const dashboard = await body(await fetcher(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(3000), redirect: "error",
        }));
        if (health.status === "ok" && dashboard.includes('data-testid="service-desk-dashboard"')) {
          healthy = true;
          break;
        }
      } catch { /* Readiness can lag container startup; both probes must pass. */ }
      if (attempt + 1 < attempts) await sleep(2000);
    }
    if (!healthy) throw new Error("Health and dashboard checks did not both pass.");
    const current = inspect(run, "container", resource.container);
    assertManaged(current, resource, "container", image);
    if (current.Id !== started.Id || current.State?.Running !== true) throw new Error("Container changed or exited during verification.");
    const dataset = verifySeededDataset(JSON.parse(run("docker", [
      "exec", current.Id, "node", "--input-type=module", "-e", seedProbe,
    ])));
    return {
      ...resource, image, port, url: `http://127.0.0.1:${port}`,
      healthVerified: true, dashboardVerified: true, dataset, accepted: false,
      note: "Local smoke verification only. Execute the Human acceptance checklist; no GitHub state was changed.",
    };
  } catch (error) {
    throw new Error(`${error.message} Managed resources may remain for diagnosis. Use stop --repo ${resource.repo} --intent ${resource.intent} [--cleanup] after inspection.`);
  }
}

export function stopImage(options, { run = execute } = {}) {
  const resource = resources(options.repo, options.intent);
  const container = inspect(run, "container", resource.container);
  const volume = inspect(run, "volume", resource.volume);
  const image = container ? assertManaged(container, resource, "container") : undefined;
  if (volume) assertManaged(volume, resource, "volume", image);
  if (container) {
    if (!volume) throw new Error("Expected managed data volume is missing; inspect manually.");
    if (container.State?.Running) run("docker", ["stop", "--time", "10", container.Id]);
    if (options.cleanup) run("docker", ["container", "rm", container.Id]);
  }
  if (volume && options.cleanup) run("docker", ["volume", "rm", resource.volume]);
  return { ...resource, stopped: Boolean(container), cleaned: options.cleanup === true, dataRetained: Boolean(volume && !options.cleanup) };
}
