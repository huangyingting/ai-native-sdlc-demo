import { mkdirSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configPath, sha256, workflowFiles } from "../common.mjs";
import { loadManifest } from "../scenarios.mjs";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const commit = "a".repeat(40);
export const image = `ghcr.io/example/demo-it-service-desk@sha256:${"b".repeat(64)}`;
export const config = {
  version: 1, mergeMethod: "squash",
  project: { path: "demos/it-service-desk", testCommand: "npm test", lintCommand: "npm run lint", buildCommand: "npm run build" },
  stages: Object.fromEntries(["spec", "plan", "tests", "implementation"].map((stage) => [stage, {
    prompt: `.github/brownfield-human-gated-delivery/prompts/${stage}.md`,
    minimumApprovals: 1, reviewers: { users: ["reviewer"], teams: [] },
  }])),
};
export const encoded = (value) => ({
  encoding: "base64",
  content: Buffer.from(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).toString("base64"),
});
export const absent = () => { throw Object.assign(new Error("Not found"), { notFound: true }); };

export const fixtureManifest = loadManifest();
const baselineData = new Map(Object.keys(fixtureManifest.baseline.files).map((path) => [
  path, Buffer.from(`// Synthetic baseline fixture: ${path}\n`),
]));
for (const [path, data] of baselineData) fixtureManifest.baseline.files[path] = sha256(data);

export function artifacts(test) {
  const parent = fileURLToPath(new URL("../test-artifacts/", import.meta.url));
  const directory = join(parent, randomUUID());
  mkdirSync(directory, { recursive: true });
  test.after(() => {
    rmSync(directory, { recursive: true });
    try { rmdirSync(parent); } catch (error) { if (!["ENOTEMPTY", "ENOENT"].includes(error.code)) throw error; }
  });
  return directory;
}

export function baselineFiles() {
  const files = new Map();
  for (const [path, data] of baselineData) {
    files.set(`${fixtureManifest.project}/${path}`, { data: Buffer.from(data), mode: 0o644 });
  }
  files.set(`${fixtureManifest.project}/Dockerfile`, { data: readFileSync(join(repositoryRoot, fixtureManifest.project, "Dockerfile")), mode: 0o644 });
  files.set(configPath, { data: Buffer.from(JSON.stringify(config)), mode: 0o644 });
  for (const name of ["setup", "run-core", "runs", "state-store"]) {
    files.set(`.github/brownfield-human-gated-delivery/scripts/${name}.mjs`, { data: Buffer.from("// fixture\n"), mode: 0o644 });
  }
  for (const file of workflowFiles) files.set(`.github/workflows/${file}`, { data: Buffer.from("name: fixture\n"), mode: 0o644 });
  return files;
}

export function tarEntry(path, data = Buffer.alloc(0), type = "0") {
  data = Buffer.from(data);
  const header = Buffer.alloc(512);
  const field = (text, offset, length) => header.write(text, offset, length, "utf8");
  field(path, 0, 100);
  field("0000644\0", 100, 8);
  field("0000000\0", 108, 8);
  field("0000000\0", 116, 8);
  field(`${data.length.toString(8).padStart(11, "0")}\0`, 124, 12);
  field("00000000000\0", 136, 12);
  header.fill(32, 148, 156);
  field(type, 156, 1);
  field("ustar\0", 257, 6);
  field("00", 263, 2);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  field(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}

export function tar(files) {
  return Buffer.concat([...files].map(([path, entry]) => tarEntry(path, entry.data)).concat(Buffer.alloc(1024)));
}

export function fakeGit(source, files, calls = []) {
  return (command, args) => {
    calls.push([command, ...args]);
    if (command !== "git" || args[0] !== "-C" || args[1] !== source) throw new Error("Unexpected command.");
    if (args[2] === "rev-parse") return args.includes("--show-toplevel") ? `${source}\n` : `${commit}\n`;
    if (args[2] === "ls-tree") return [...files].map(([path]) => `100644 blob ${"c".repeat(40)}\t${path}\0`).join("");
    if (args[2] === "archive") return tar(files);
    throw new Error(`Unexpected git mutation: ${args.join(" ")}`);
  };
}
