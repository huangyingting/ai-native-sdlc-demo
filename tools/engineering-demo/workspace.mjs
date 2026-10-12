import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execute, fullSha, newDestination, safePath, sha256 } from "../brownfield-demo/common.mjs";
import { archiveFiles } from "../brownfield-demo/prepare.mjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
const project = "demos/engineering-lab";

export function exportFixture(source, commit) {
  source = realpathSync(source);
  if (!fullSha(commit)) throw new Error("Use a full immutable 40-hex --source-ref.");
  const git = (args, options = {}) => execute("git", ["-C", source, ...args], {
    ...options, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
  });
  if (git(["rev-parse", "--show-toplevel"]).trim() !== source ||
      git(["rev-parse", "--verify", `${commit}^{commit}`]).trim() !== commit) {
    throw new Error("Source must be the exact repository root and immutable commit.");
  }
  const files = archiveFiles(git(["archive", "--format=tar", commit, "--", project], {
    encoding: null, maxBuffer: 8 * 1024 * 1024,
  }));
  const tracked = new Map();
  for (const entry of git(["ls-tree", "-rz", commit, "--", project]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
    if (!match) throw new Error("Fixture must not contain symlinks or submodules.");
    tracked.set(match[3], match[2]);
  }
  if (tracked.size !== files.size || !files.size) throw new Error("Incomplete committed fixture export.");
  const result = {};
  for (const [path, entry] of files) {
    if (!path.startsWith(`${project}/`) || tracked.get(path) !==
        createHash("sha1").update(`blob ${entry.data.length}\0`).update(entry.data).digest("hex")) {
      throw new Error("Fixture archive differs from committed content.");
    }
    const key = safePath(path.slice(project.length + 1));
    if (/node_modules|\.env|\.db$/.test(key)) throw new Error("Unexpected fixture dependency or local data.");
    result[key] = entry.data.toString("utf8");
  }
  return result;
}

export function newRun(dest, source) {
  if (source) newDestination(dest, realpathSync(source));
  const path = newDestination(dest, root);
  mkdirSync(path, { mode: 0o700 });
  return path;
}

export function writeJson(path, value, { exclusive = false } = {}) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: exclusive ? "wx" : "w" });
}

export function readJson(path) {
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) throw new Error("Expected a regular evidence file.");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function treeHash(files) {
  return sha256(JSON.stringify(Object.entries(files).sort(([left], [right]) => left.localeCompare(right))));
}

export function writeTree(path, files) {
  mkdirSync(path, { mode: 0o755 });
  for (const [key, content] of Object.entries(files)) {
    const dest = join(path, safePath(key));
    mkdirSync(dirname(dest), { recursive: true, mode: 0o755 });
    writeFileSync(dest, content, { mode: 0o644, flag: "wx" });
  }
  chmodSync(path, 0o755);
}

export function readTree(path) {
  const result = {};
  function walk(directory) {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error("Candidate tree contains a symlink.");
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) result[safePath(relative(path, full))] = readFileSync(full, "utf8");
      else throw new Error("Unsupported candidate file.");
    }
  }
  walk(path);
  return result;
}

export function overlay(files, overlays) {
  const result = { ...files };
  for (const item of overlays) {
    const text = result[item.path];
    if (typeof text !== "string" || !item.before || text.split(item.before).length !== 2) {
      throw new Error(`Fault overlay needs exactly one anchor: ${item.path}`);
    }
    result[item.path] = text.replace(item.before, () => item.after);
  }
  return result;
}

export function applyProposal(files, answer, allowedPaths) {
  if (!Array.isArray(answer?.files) || !answer.files.length || answer.files.length > allowedPaths.length) {
    throw new Error("Candidate must supply a nonempty bounded files array.");
  }
  const updated = { ...files };
  const seen = new Set();
  for (const item of answer.files) {
    const path = safePath(item?.path);
    if (!allowedPaths.includes(path) || !Object.hasOwn(files, path) || seen.has(path) ||
        typeof item.content !== "string" || Buffer.byteLength(item.content) > 40_000) {
      throw new Error("Candidate changes a forbidden, duplicate, missing or oversized file.");
    }
    seen.add(path);
    updated[path] = item.content;
  }
  return updated;
}

export function requireRunPath(value) {
  const path = realpathSync(value);
  if (path !== resolve(value) || !lstatSync(path).isDirectory()) throw new Error("Use the original regular experiment directory.");
  return path;
}
