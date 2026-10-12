import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { execute } from "../brownfield-demo/common.mjs";

const label = "io.github.engineering-demo.run";
const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
const containerIdPattern = /^[a-f0-9]{64}$/;
const outputLimit = 1024 * 1024;
const cleanupBudgetMs = 10_000;

export function immutableImage(image) {
  if (typeof image !== "string" || (!imageIdPattern.test(image) &&
      !/^(?:[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[0-9]+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*@sha256:[a-f0-9]{64}$/.test(image))) {
    throw new Error("Use an immutable sha256 image ID or untagged repository@sha256 digest.");
  }
  return image;
}

function directory(path) {
  if (typeof path !== "string" || !isAbsolute(path) || /[\\,:\x00-\x1f\x7f]/.test(path) ||
      resolve(path) === "/" || realpathSync(path) !== resolve(path) || !lstatSync(path).isDirectory()) {
    throw new Error("Sandbox mounts must be canonical absolute directories without mount delimiters.");
  }
  return resolve(path);
}

function argumentsForNode(args) {
  if (!Array.isArray(args) || !args.length || args.length > 64 ||
      args.some((arg) => typeof arg !== "string" || arg.length > 1024)) {
    throw new Error("Supply bounded allowlisted Node arguments.");
  }
  if (args[0] === "/oracle/oracle.mjs" && args.length === 1) return [...args];
  if (args[0] === "/oracle/oracle.mjs" && args.length === 3 &&
      /^[a-z][a-z0-9-]{0,63}$/.test(args[1]) && args[2] === "/work") return [...args];
  const testPaths = args[1] === "--test-reporter=tap" ? args.slice(2) : args.slice(1);
  if (args[0] !== "--test" || testPaths.some((arg) =>
    !/^(?:\.\/|\/work\/)?[a-zA-Z0-9_*][a-zA-Z0-9_.* /-]*$/.test(arg) ||
    arg.replace(/^\/work\//, "").split("/").some((part) => part === ".." || part === "") ||
    (arg.startsWith("/") && !arg.startsWith("/work/")))) {
    throw new Error("Only --test with workspace paths or /oracle/oracle.mjs is allowed.");
  }
  return [
    "--test", ...(args[1] === "--test-reporter=tap" ? [args[1]] : []),
    ...(testPaths.length ? testPaths.map((path) => path.startsWith("/work/")
      ? path : `/work/${path.replace(/^\.\//, "")}`) : ["/work"]),
  ];
}

function output(error, name) {
  return String(error?.[name] ?? "").slice(0, outputLimit);
}

export function runSandbox({ image, workspace, oracleRoot, args, timeoutMs = 30_000 },
  { run = execute, now = () => performance.now() } = {}) {
  const started = now();
  immutableImage(image);
  workspace = directory(workspace);
  oracleRoot = directory(oracleRoot);
  const related = (left, right) => {
    const part = relative(left, right);
    return part === "" || (!part.startsWith("../") && part !== ".." && !isAbsolute(part));
  };
  if (related(workspace, oracleRoot) || related(oracleRoot, workspace)) {
    throw new Error("Workspace and oracle mounts must be separate directories.");
  }
  const nodeArgs = argumentsForNode(args);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 180_000) {
    throw new Error("Sandbox timeout must be between 1 and 180000 milliseconds.");
  }
  const token = randomUUID();
  const name = `engineering-demo-${token}`;
  const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C" };
  let deadline = started + timeoutMs;
  const result = {
    exitCode: null, stdout: "", stderr: "", wallMs: 0, timedOut: false,
    imageId: null, cleaned: true, status: "infrastructure-error", failure: null,
    containerName: name, containerId: null,
    executionBudgetMs: timeoutMs, executionWallMs: 0,
    cleanupBudgetMs, cleanupWallMs: 0, cleanupTimedOut: false,
  };
  let attempted = false;
  let phase = "image-inspect";
  const deadlineError = (response) => Object.assign(new Error("Sandbox operation deadline exceeded."), {
    code: "ETIMEDOUT", stdout: typeof response === "string" ? response : response?.stdout ?? "",
    stderr: response?.stderr ?? "",
  });
  const invoke = (commandArgs, limit = 10_000, capture = false) => {
    const remaining = Math.floor(deadline - now());
    if (remaining <= 0) throw deadlineError();
    const options = { timeout: Math.min(remaining, limit), maxBuffer: outputLimit, killSignal: "SIGKILL", env };
    let response;
    try {
      response = capture && run === execute
        ? spawnSync("docker", commandArgs, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
        : run("docker", commandArgs, options);
    } catch (error) {
      if (now() >= deadline) throw deadlineError(error);
      throw error;
    }
    if (now() >= deadline) throw deadlineError(response);
    return response;
  };
  const start = () => {
    const response = invoke(["start", "--attach", result.containerId], Infinity, true);
    if (typeof response === "string" || Buffer.isBuffer(response)) return { stdout: String(response), stderr: "" };
    if (response?.error || response?.signal || response?.status !== 0) {
      throw Object.assign(response?.error ?? new Error("Docker start failed."), {
        status: response?.status ?? null, signal: response?.signal ?? null,
        stdout: response?.stdout ?? "", stderr: response?.stderr ?? "",
      });
    }
    return response;
  };
  const inspect = (kind, target) => {
    const values = JSON.parse(invoke([kind, "inspect", target]));
    if (!Array.isArray(values) || values.length !== 1) throw new Error("Invalid Docker inspection.");
    return values[0];
  };
  const missing = (error, target) => [
    `Error: No such container: ${target}`,
    `Error response from daemon: No such container: ${target}`,
  ].includes(String(error.stderr ?? "").trim());
  const owned = () => {
    const target = result.containerId ?? name;
    let info;
    try { info = inspect("container", target); } catch (error) {
      if (missing(error, target)) return null;
      throw error;
    }
    const binds = info.Mounts?.filter((mount) => mount.Type === "bind") ?? [];
    const other = info.Mounts?.filter((mount) => mount.Type !== "bind") ?? [];
    if (!containerIdPattern.test(info.Id ?? "") || (result.containerId && info.Id !== result.containerId) ||
        info.Name !== `/${name}` || info.Image !== result.imageId || info.Config?.Image !== result.imageId ||
        info.Config?.Labels?.[label] !== token || binds.length !== 2 ||
        !binds.some((mount) => mount.Source === workspace && mount.Destination === "/work" && mount.RW === false) ||
        !binds.some((mount) => mount.Source === oracleRoot && mount.Destination === "/oracle" && mount.RW === false) ||
        other.length > 1 || other.some((mount) => mount.Type !== "tmpfs" || mount.Destination !== "/tmp")) {
      throw Object.assign(new Error("Refusing mismatched container identity, label, image or mounts."), { code: "OWNERSHIP_MISMATCH" });
    }
    result.containerId = info.Id;
    return info;
  };
  const failure = (error, failedPhase) => ({
    phase: failedPhase,
    code: typeof error.code === "string" ? error.code : "DOCKER_ERROR",
    clientExitCode: Number.isInteger(error.status) ? error.status : null,
    signal: typeof error.signal === "string" ? error.signal : null,
  });
  try {
    const inspectedImage = inspect("image", image);
    if (!imageIdPattern.test(inspectedImage.Id ?? "") ||
        (imageIdPattern.test(image) && inspectedImage.Id !== image)) throw new Error("Docker did not resolve the exact immutable image.");
    if (Object.keys(inspectedImage.Config?.Volumes ?? {}).length) {
      throw new Error("Sandbox images cannot declare additional volumes.");
    }
    result.imageId = inspectedImage.Id;
    phase = "create";
    attempted = true;
    result.cleaned = false;
    const created = String(invoke([
      "create", "--pull", "never", "--name", name, "--label", `${label}=${token}`,
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--pids-limit", "64", "--memory", "256m", "--cpus", "1", "--user", "65534:65534",
      "--mount", `type=bind,source=${workspace},target=/work,readonly`,
      "--mount", `type=bind,source=${oracleRoot},target=/oracle,readonly`,
      "--tmpfs", "/tmp:rw,nosuid,noexec,size=64m,mode=1777",
      "--workdir", "/tmp", "--entrypoint", "node", result.imageId, ...nodeArgs,
    ])).trim();
    if (!containerIdPattern.test(created)) throw new Error("Invalid created container ID.");
    result.containerId = created;
    phase = "inspect-created";
    if (!owned()) throw new Error("Created container is missing.");
    phase = "start";
    let startError;
    try {
      const response = start();
      result.stdout = String(response.stdout ?? "");
      result.stderr = String(response.stderr ?? "");
      if (Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > outputLimit) {
        throw Object.assign(new Error("Sandbox output limit exceeded."), { code: "ENOBUFS" });
      }
    } catch (error) {
      result.stdout = output(error, "stdout");
      result.stderr = output(error, "stderr");
      if (error.code === "ETIMEDOUT" || error.code === "ENOBUFS" || !Number.isInteger(error.status)) throw error;
      startError = error;
    }
    phase = "inspect-exit";
    const finished = owned();
    if (!finished || finished.State?.Running !== false || finished.State?.Status !== "exited" ||
        finished.State?.Error || finished.State?.OOMKilled || !Number.isInteger(finished.State?.ExitCode) ||
        finished.State.ExitCode < 0 || finished.State.ExitCode > 255 ||
        (startError && startError.status !== finished.State.ExitCode)) {
      throw startError ?? new Error("Container exit could not be verified.");
    }
    result.exitCode = finished.State.ExitCode;
    result.status = result.exitCode === 0 ? "passed" : "failed";
  } catch (error) {
    result.timedOut = error.code === "ETIMEDOUT";
    result.status = result.timedOut ? "timeout" : "infrastructure-error";
    result.failure = failure(error, phase);
    if (!result.stdout) result.stdout = output(error, "stdout");
    if (!result.stderr) result.stderr = output(error, "stderr");
  } finally {
    const cleanupStarted = now();
    result.executionWallMs = Math.max(0, Math.round(cleanupStarted - started));
    deadline = cleanupStarted + cleanupBudgetMs;
    if (attempted) {
      try {
        if (owned()) {
          invoke(["container", "rm", "--force", result.containerId]);
          if (owned()) throw new Error("Removed container is still present.");
        }
        // Reconcile the attempted name as well, including create-client timeouts.
        try {
          inspect("container", name);
          throw new Error("Attempted container name remains occupied.");
        } catch (error) {
          if (!missing(error, name)) throw error;
        }
        result.cleaned = true;
      } catch (error) {
        result.cleaned = false;
        result.cleanupTimedOut = error.code === "ETIMEDOUT";
        result.cleanupFailure = failure(error, "cleanup");
        result.status = "infrastructure-error";
      }
      result.cleanupWallMs = Math.max(0, Math.round(now() - cleanupStarted));
    }
    result.wallMs = Math.max(0, Math.round(now() - started));
  }
  return result;
}
