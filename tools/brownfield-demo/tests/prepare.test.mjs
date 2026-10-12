import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  configPath, execute, newDestination, provenancePath, safePath,
  substituteReviewer, validateProvenance,
} from "../common.mjs";
import { archiveFiles, baselineProblems, omitPath, prepare } from "../prepare.mjs";
import { loadManifest, scenario, validateManifest } from "../scenarios.mjs";
import { artifacts, baselineFiles, commit, config, fakeGit, fixtureManifest, repositoryRoot, tarEntry } from "./helpers.mjs";

test("scenario manifest has three fixed variants with shared deterministic criteria", () => {
  const manifest = loadManifest();
  assert.equal(manifest.variants.length, 3);
  assert.deepEqual(scenario("ownership-standard").acceptance, scenario("ownership-spec-revision").acceptance);
  assert.throws(() => scenario("invented-feature"), /Unknown scenario/);
  for (const mutate of [
    (value) => { value.version = 2; },
    (value) => { value.baseline.files["../../outside"] = "a".repeat(64); },
    (value) => { delete value.baseline.files["src/lib/ticket.ts"]; },
    (value) => { value.variants[1].id = value.variants[0].id; },
    (value) => { value.owners[0].id = "someone-else"; },
    (value) => { value.fixtures[0].owner = "avery-stone"; },
    (value) => { value.acceptance[0].criterion = ""; },
  ]) {
    const value = structuredClone(manifest);
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});

test("path validation rejects traversal, Git internals and platform-specific paths", () => {
  for (const path of ["../outside", "/etc/passwd", "a/../b", "a\\b", "C:/x", ".git/config", "a/.GiT/x", "a//b", "./a", "a\0b", ".git /config", "CON.txt", "a/../NUL"]) {
    assert.throws(() => safePath(path), /Unsafe/);
  }
  assert.equal(safePath("demos/it-service-desk/src/app/tickets/[id]/page.tsx"), "demos/it-service-desk/src/app/tickets/[id]/page.tsx");
});

test("new destination rejects existing directories, files, broken links and source aliases", (t) => {
  const directory = artifacts(t);
  const source = join(directory, "source");
  mkdirSync(source);
  const alias = join(directory, "alias");
  symlinkSync(source, alias);
  const existing = join(directory, "existing");
  writeFileSync(existing, "preserved");
  const broken = join(directory, "broken");
  symlinkSync(join(directory, "absent"), broken);
  for (const path of [source, existing, broken]) assert.throws(() => newDestination(path, source), /already exists/);
  for (const path of [join(source, "child"), join(alias, "child")]) assert.throws(() => newDestination(path, source), /outside/);
  assert.equal(newDestination(join(directory, "safe"), source), join(directory, "safe"));
  assert.equal(readFileSync(existing, "utf8"), "preserved");
});

test("archive parser refuses traversal, symlinks, hardlinks, duplicates and corruption", () => {
  const archive = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);
  for (const path of ["../outside", "/absolute", ".git/config", "C:/file", "a\\b"]) {
    assert.throws(() => archiveFiles(archive(tarEntry(path, "bad"))), /Unsafe/);
  }
  for (const type of ["1", "2", "3", "4", "6"]) {
    assert.throws(() => archiveFiles(archive(tarEntry("link", "", type))), /not allowed/);
  }
  assert.throws(() => archiveFiles(archive(tarEntry("x"), tarEntry("x"))), /Duplicate/);
  assert.throws(() => archiveFiles(archive(tarEntry("x"), tarEntry("x/y"))), /collision/);
  const corrupt = archive(tarEntry("safe", "payload"));
  corrupt[0] ^= 1;
  assert.throws(() => archiveFiles(corrupt), /checksum/);
  assert.throws(() => archiveFiles(tarEntry("safe", "payload")), /Incomplete/);
});

test("real git archive of current immutable commit parses without extracting or changing Git", () => {
  const head = execute("git", ["-C", repositoryRoot, "rev-parse", "HEAD"]).trim();
  const archive = execute("git", ["-C", repositoryRoot, "archive", "--format=tar", head], { encoding: null, maxBuffer: 128 * 1024 * 1024 });
  const files = archiveFiles(archive);
  assert.ok(files.has("AGENTS.md"));
  assert.ok(!files.has(".git/config"));
});

test("PAX long paths are validated before extraction and unsupported metadata is rejected", () => {
  const pax = (key, value) => {
    const body = ` ${key}=${value}\n`;
    let size = Buffer.byteLength(body) + 1;
    while (size !== Buffer.byteLength(String(size) + body)) size = Buffer.byteLength(String(size) + body);
    return `${size}${body}`;
  };
  const archive = (path, extra = "") => Buffer.concat([
    tarEntry("pax-header", pax("path", path) + extra, "x"),
    tarEntry("placeholder", "content"), Buffer.alloc(1024),
  ]);
  const path = `docs/${"long-".repeat(30)}name.md`;
  assert.equal(archiveFiles(archive(path)).get(path).data.toString(), "content");
  assert.throws(() => archiveFiles(archive("../escape")), /Unsafe/);
  assert.throws(() => archiveFiles(archive("safe", pax("linkpath", "/outside"))), /Unsupported/);
});

test("synthetic baselines require the test-only manifest, never production fingerprints", () => {
  const files = baselineFiles();
  assert.deepEqual(baselineProblems(files, fixtureManifest), []);
  assert.equal(baselineProblems(files).filter((item) => item.includes("fingerprint")).length, 6);
  files.get("demos/it-service-desk/src/lib/ticket.ts").data.fill(0);
  assert.deepEqual(baselineProblems(baselineFiles(), fixtureManifest), []);
});

test("baseline fails closed if feature differs or orchestration is missing", () => {
  const files = baselineFiles();
  assert.deepEqual(baselineProblems(files, fixtureManifest), []);
  for (const name of ["run-core", "runs", "state-store"]) {
    const missing = new Map(files);
    missing.delete(`.github/brownfield-human-gated-delivery/scripts/${name}.mjs`);
    assert.ok(baselineProblems(missing, fixtureManifest).some((item) => item.includes(`${name}.mjs`)));
  }
  files.delete(".github/workflows/brownfield-human-gated-delivery-documents.yml");
  files.get("demos/it-service-desk/src/lib/ticket.ts").data = Buffer.from("owner: string");
  const problems = baselineProblems(files, fixtureManifest);
  assert.ok(problems.some((item) => item.includes("fingerprint")));
  assert.ok(problems.some((item) => item.includes("documents.yml")));
});

test("reviewer replacement changes only declared policy fields and preserves other text", () => {
  const original = structuredClone(config);
  original.project.buildCommand = "echo reviewer";
  const updated = substituteReviewer(original, "new-human");
  assert.equal(updated.project.buildCommand, "echo reviewer");
  assert.deepEqual(updated.stages.spec.reviewers, { users: ["new-human"], teams: [] });
  assert.equal(original.stages.spec.reviewers.users[0], "reviewer");
  original.stages.spec.minimumApprovals = 2;
  original.stages.spec.reviewers.users.push("second-human");
  assert.throws(() => substituteReviewer(original, "new-human"), /minimumApprovals/);
  assert.throws(() => substituteReviewer(config, "bot[bot]"), /Human/);
});

test("prepare exports only pinned archived files, omits local data, and never initializes Git", (t) => {
  const directory = artifacts(t);
  const source = join(directory, "source");
  mkdirSync(source);
  writeFileSync(join(source, "untracked-secret"), "never exported");
  const files = baselineFiles();
  for (const path of [".env.local", "data/demo.db", ".npmrc", "id_rsa", "demos/it-service-desk/data/service-desk.db-wal"]) {
    files.set(path, { data: Buffer.from("do not export"), mode: 0o644 });
  }
  files.set(".env.example", { data: Buffer.from("EXAMPLE=placeholder"), mode: 0o644 });
  const calls = [];
  const dest = join(directory, "prepared");
  const result = prepare({
    source, sourceRef: commit, dest, reviewer: "new-human",
    scenario: "ownership-standard", singleOwner: false,
  }, { manifest: fixtureManifest, run: (command, args, settings) => {
    assert.equal(settings.env.GIT_NO_REPLACE_OBJECTS, "1");
    return fakeGit(source, files, calls)(command, args);
  } });
  assert.equal(result.status, "baseline-exported-not-published");
  assert.equal(result.provenance.source.commit, commit);
  assert.equal(result.provenance.singleOwner, false);
  assert.equal(existsSync(join(dest, ".git")), false);
  assert.equal(existsSync(join(dest, "untracked-secret")), false);
  assert.equal(existsSync(join(dest, ".env.local")), false);
  assert.equal(existsSync(join(dest, ".env.example")), true);
  assert.ok(calls.every((call) => ["rev-parse", "ls-tree", "archive"].includes(call[3])));
  const saved = validateProvenance(JSON.parse(readFileSync(join(dest, provenancePath), "utf8")));
  assert.equal(saved.reviewer, "new-human");
  assert.equal(JSON.parse(readFileSync(join(dest, configPath))).stages.spec.reviewers.users[0], "new-human");
  assert.throws(() => prepare({ source, sourceRef: commit, dest, reviewer: "new-human", scenario: "ownership-standard" },
    { manifest: fixtureManifest, run: fakeGit(source, files) }), /already exists/);
});

test("prepare rejects mutable refs, unsupported tree entries, already-prepared trees and unready baselines", (t) => {
  const directory = artifacts(t);
  const source = join(directory, "source");
  mkdirSync(source);
  const dest = join(directory, "export");
  const files = baselineFiles();
  const options = { source, sourceRef: commit, dest, reviewer: "reviewer", scenario: "ownership-standard" };
  for (const sourceRef of ["HEAD", "main", commit.slice(0, 12), `${commit}~1`, commit.toUpperCase()]) {
    assert.throws(() => prepare({ ...options, sourceRef }, { manifest: fixtureManifest, run: fakeGit(source, files) }), /immutable/);
  }
  const symlinkGit = (command, args) => args[2] === "ls-tree" ? `120000 blob ${commit}\tlink\0` : fakeGit(source, files)(command, args);
  assert.throws(() => prepare(options, { manifest: fixtureManifest, run: symlinkGit }), /symlink/);
  files.set(provenancePath, { data: Buffer.from("{}") });
  assert.throws(() => prepare(options, { manifest: fixtureManifest, run: fakeGit(source, files) }), /already a prepared/);
  files.delete(provenancePath);
  files.delete(".github/brownfield-human-gated-delivery/scripts/runs.mjs");
  assert.throws(() => prepare(options, { manifest: fixtureManifest, run: fakeGit(source, files) }), /not a ready/);
  assert.equal(existsSync(dest), false);
});

test("provenance cannot silently omit immutable baseline or reviewer identity", () => {
  assert.throws(() => validateProvenance({ version: 1 }), /Invalid/);
  for (const path of ["some/.env", "data/a.sqlite", ".ssh/id_ed25519", "demo.log"]) assert.equal(omitPath(path), true);
  assert.equal(omitPath("src/database.ts"), false);
});
