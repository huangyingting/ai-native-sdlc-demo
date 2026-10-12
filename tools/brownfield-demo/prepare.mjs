import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  configPath, execute, fullSha, newDestination, provenancePath, safePath, sha256,
  substituteReviewer, validateHumanConfig, validateProvenance, workflowFiles,
} from "./common.mjs";
import { loadManifest, scenario } from "./scenarios.mjs";

export function omitPath(path) {
  return path.split("/").some((part) =>
    /^(?:node_modules|data|\.next|coverage|\.ssh|\.aws|\.azure|\.copilot)$/i.test(part) ||
    (/^\.env(?:\.|$)/i.test(part) && !/^\.env\.(?:example|sample|template)$/.test(part)) ||
    /^(?:\.npmrc|\.netrc|\.git-credentials|credentials(?:\.json)?|id_(?:rsa|ed25519))$/i.test(part) ||
    /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/i.test(part) ||
    /\.(?:pem|key|p12|pfx|log)$/i.test(part));
}

function paxFields(data) {
  const result = Object.create(null);
  for (let offset = 0; offset < data.length;) {
    const space = data.indexOf(32, offset);
    const size = Number(data.subarray(offset, space).toString());
    if (space < offset || !Number.isSafeInteger(size) || size <= space - offset + 2 ||
        offset + size > data.length || data[offset + size - 1] !== 10) throw new Error("Invalid tar PAX record.");
    const entry = data.subarray(space + 1, offset + size - 1).toString("utf8");
    const equals = entry.indexOf("=");
    if (equals < 1) throw new Error("Invalid tar PAX field.");
    result[entry.slice(0, equals)] = entry.slice(equals + 1);
    offset += size;
  }
  return result;
}

// Decode Git's tar in memory; never ask an external extractor to follow paths or links.
export function archiveFiles(archive) {
  const files = new Map();
  const paths = new Set();
  let pending = {};
  let ended = false;
  const text = (buffer, start, length) => buffer.subarray(start, start + length).toString("utf8").replace(/\0.*$/s, "");
  const octal = (value) => {
    if (!/^[0-7]+$/.test(value.trim())) throw new Error("Unsupported tar numeric field.");
    const number = parseInt(value.trim(), 8);
    if (!Number.isSafeInteger(number)) throw new Error("Oversized tar field.");
    return number;
  };
  for (let offset = 0; offset < archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.length !== 512) throw new Error("Truncated tar header.");
    if (header.every((byte) => byte === 0)) {
      if (Object.keys(pending).length || !archive.subarray(offset).every((byte) => byte === 0)) {
        throw new Error("Unexpected trailing archive data.");
      }
      ended = true;
      break;
    }
    const checksum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (checksum !== octal(text(header, 148, 8))) throw new Error("Invalid tar checksum.");
    const size = octal(text(header, 124, 12));
    const type = text(header, 156, 1);
    offset += 512;
    if (offset + size > archive.length) throw new Error("Truncated tar entry.");
    const data = archive.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type === "g" || type === "x") {
      const fields = paxFields(data);
      const allowed = type === "g" ? ["comment"] : ["path", "mtime"];
      if (Object.keys(fields).some((key) => !allowed.includes(key))) throw new Error("Unsupported tar PAX metadata.");
      if (type === "x") {
        if (Object.keys(pending).length) throw new Error("Repeated tar PAX header.");
        pending = fields;
      }
      continue;
    }
    if (!["", "0", "5"].includes(type)) throw new Error("Archive links, devices, and special entries are not allowed.");
    const prefix = text(header, 345, 155);
    const name = pending.path ?? `${prefix ? `${prefix}/` : ""}${text(header, 0, 100)}`;
    pending = {};
    const path = safePath(type === "5" ? name.replace(/\/$/, "") : name);
    if (paths.has(path)) throw new Error(`Duplicate archive path: ${path}`);
    paths.add(path);
    if (type === "5") {
      if (size) throw new Error("Directory contains archive data.");
    } else {
      files.set(path, { data, mode: octal(text(header, 100, 8)) & 0o111 ? 0o755 : 0o644 });
    }
  }
  if (!ended || !files.size) throw new Error("Incomplete or empty archive.");
  for (const path of files.keys()) {
    const parts = path.split("/");
    while (parts.pop() && parts.length) {
      if (files.has(parts.join("/"))) throw new Error("Archive file/directory path collision.");
    }
  }
  return files;
}

export function baselineProblems(files, manifest = loadManifest()) {
  const problems = [];
  for (const [path, expected] of Object.entries(manifest.baseline.files)) {
    const entry = files.get(`${manifest.project}/${path}`);
    if (!entry || sha256(entry.data) !== expected) problems.push(`Absent-ownership baseline fingerprint differs: ${path}`);
  }
  const required = [
    configPath, ".github/brownfield-human-gated-delivery/scripts/setup.mjs",
    ...["run-core", "runs", "state-store"].map((name) => `.github/brownfield-human-gated-delivery/scripts/${name}.mjs`),
    ...workflowFiles.map((file) => `.github/workflows/${file}`),
    `${manifest.project}/Dockerfile`,
  ];
  for (const path of required) if (!files.has(path)) problems.push(`Required orchestration file missing: ${path}`);
  if (files.has(configPath)) {
    try { validateHumanConfig(JSON.parse(files.get(configPath).data.toString("utf8"))); }
    catch (error) { problems.push(error.message); }
  }
  const dockerfile = files.get(`${manifest.project}/Dockerfile`)?.data.toString("utf8") ?? "";
  if (!dockerfile.includes("SERVICE_DESK_DB_PATH=/app/data/service-desk.db") ||
      !/^EXPOSE 3000$/m.test(dockerfile)) problems.push("Docker runtime/data-path contract differs.");
  return problems;
}

export function prepare(options, { run = execute, manifest = loadManifest(), now = () => new Date() } = {}) {
  scenario(options.scenario, manifest);
  if (!fullSha(options.sourceRef)) throw new Error("--source-ref must be a full lowercase immutable 40-hex Git commit, not a branch/tag.");
  const source = realpathSync(options.source);
  const git = (args, extra = {}) => run("git", ["-C", source, ...args], {
    ...extra, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
  });
  if (realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) !== source) throw new Error("--source must be the repository root.");
  const destination = newDestination(options.dest, source);
  const resolved = git(["rev-parse", "--verify", `${options.sourceRef}^{commit}`]).trim();
  if (resolved !== options.sourceRef) throw new Error("Source commit did not resolve exactly.");
  const tree = git(["ls-tree", "-rz", options.sourceRef]);
  const tracked = new Set();
  for (const entry of tree.split("\0").filter(Boolean)) {
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    if (!match || !["100644", "100755"].includes(match[1]) || match[2] !== "blob") {
      throw new Error("Source contains a symlink, submodule, or unsupported tree entry; export refused.");
    }
    tracked.add(safePath(match[4]));
  }
  const files = archiveFiles(git(["archive", "--format=tar", options.sourceRef], {
    encoding: null, maxBuffer: 128 * 1024 * 1024,
  }));
  for (const path of files.keys()) if (!tracked.has(path)) throw new Error(`Archive has an untracked path: ${path}`);
  const omittedPaths = [...tracked].filter((path) => !files.has(path) || omitPath(path)).sort();
  for (const path of omittedPaths) files.delete(path);
  if (tracked.has(provenancePath)) throw new Error("Source is already a prepared demo export. Use the original source repository.");
  const problems = baselineProblems(files, manifest);
  if (problems.length) throw new Error(`Source is not a ready absent-ownership baseline:\n${problems.join("\n")}`);
  const config = substituteReviewer(JSON.parse(files.get(configPath).data.toString()), options.reviewer);
  files.set(configPath, { data: Buffer.from(`${JSON.stringify(config, null, 2)}\n`), mode: 0o644 });
  const provenance = validateProvenance({
    version: 1, kind: "brownfield-demo-export",
    source: { repository: source, commit: options.sourceRef },
    scenario: options.scenario, reviewer: options.reviewer,
    singleOwner: options.singleOwner === true, baselineVerified: true,
    exportedAt: now().toISOString(), omittedPaths,
  });
  mkdirSync(destination, { mode: 0o700 });
  for (const [path, entry] of files) {
    const target = join(destination, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.data, { flag: "wx", mode: entry.mode });
  }
  writeFileSync(join(destination, provenancePath), `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
  return {
    destination, provenance, exportedFiles: files.size,
    status: "baseline-exported-not-published",
    next: [
      "Inspect the exported tree and provenance for committed sensitive data before publishing.",
      "No git init, commit, remote creation, or push was performed. Publish separately in a new isolated GitHub repository.",
      "Run preflight with that explicit repository; automated success still requires manual checks and real Human gates.",
    ],
  };
}
