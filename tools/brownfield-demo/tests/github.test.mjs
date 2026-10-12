import test from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "../cli.mjs";
import { readOnlyApi, github } from "../github.mjs";
import { preflight } from "../preflight.mjs";
import { configPath, provenancePath, workflowFiles } from "../common.mjs";
import { baselineFiles, commit, encoded, fixtureManifest, image } from "./helpers.mjs";

test("CLI requires explicit repositories, rejects write switches and defaults solo mode off", () => {
  assert.equal(parseOptions(["preflight", "--repo", "example/demo"]).singleOwner, false);
  assert.equal(parseOptions(["preflight", "--repo", "example/demo", "--single-owner"]).singleOwner, true);
  for (const args of [
    ["preflight"], ["preflight", "--repo", "example/demo", "--apply"],
    ["preflight", "--repo", "example/demo", "--set-token"],
    ["stop", "--repo", "example/demo"], ["replay", "--repo", "example/demo", "--intent", "42"],
    ["prepare", "--source-ref", commit], ["run", "--repo", "example/demo", "--intent", "42", "--image", image],
  ]) assert.throws(() => parseOptions(args));
});

test("GitHub adapter pins github.com, uses GET or query-only GraphQL, and cannot write", () => {
  const calls = [];
  const run = (command, args, options) => { calls.push({ command, args, options }); return "{}"; };
  readOnlyApi("GET", "repos/example/demo", undefined, run);
  readOnlyApi("POST", "graphql", { query: "query { viewer { login } }" }, run);
  assert.equal(calls[0].command, "gh");
  assert.deepEqual(calls[0].args.slice(0, 5), ["api", "--hostname", "github.com", "--method", "GET"]);
  assert.equal(calls[1].args.at(-1), "-");
  assert.equal(JSON.parse(calls[1].options.input).query, "query { viewer { login } }");
  for (const [method, path, body] of [
    ["POST", "repos/example/demo/issues", { title: "bad" }],
    ["DELETE", "repos/example/demo", undefined],
    ["PATCH", "repos/example/demo", {}],
    ["PUT", "repos/example/demo/actions/permissions", {}],
    ["POST", "graphql", { query: "mutation { bad }" }],
    ["POST", "graphql", { query: "query { viewer { login } } mutation { bad }" }],
    ["GET", "https://other.invalid/repos/example/demo", undefined],
    ["GET", "repos/example/demo/../secrets", undefined],
    ["GET", "repos/example/demo", { changes: true }],
  ]) assert.throws(() => readOnlyApi(method, path, body, run), /Read-only|Unsafe/);
  assert.equal(calls.length, 2);
});

test("GitHub pagination is explicit and permission/network failure is not an empty result", () => {
  const calls = [];
  const client = github("example/demo", (method, endpoint) => {
    calls.push([method, endpoint]);
    return endpoint.endsWith("page=1") ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }];
  });
  assert.equal(client.list("issues/42/comments").length, 101);
  assert.deepEqual(calls.map(([method]) => method), ["GET", "GET"]);
  assert.throws(() => github("example/demo", () => { throw new Error("forbidden"); }).optional("git/ref/heads/brownfield-runs/42"), /forbidden/);
});

function fixture({ missingWorkflow = false, sourceRef = commit, changedConfig = false, changedBaseline = false, singleOwner = false } = {}) {
  const files = baselineFiles();
  if (changedBaseline) files.get("demos/it-service-desk/src/lib/ticket.ts").data = Buffer.from("owner: string");
  if (changedConfig) {
    const config = JSON.parse(files.get(configPath).data);
    config.stages.spec.reviewers.users = ["other-human"];
    files.set(configPath, { data: Buffer.from(JSON.stringify(config)) });
  }
  files.set(provenancePath, { data: Buffer.from(JSON.stringify({
    version: 1, kind: "brownfield-demo-export", source: { repository: "/source/demo", commit: sourceRef },
    scenario: "ownership-standard", reviewer: "reviewer", singleOwner, baselineVerified: true,
    exportedAt: "2026-09-26T01:00:00Z", omittedPaths: [],
  })) });
  const requests = [];
  const api = (method, endpoint) => {
    requests.push([method, endpoint]);
    assert.equal(method, "GET");
    const path = endpoint.replace("repos/example/demo", "");
    if (path === "") return { full_name: "example/demo", archived: false, default_branch: "main" };
    if (path === "/branches/main") return { commit: { sha: commit } };
    if (path === `/git/trees/${commit}?recursive=1`) return { truncated: false, tree: [...files.keys()].map((path) => ({ type: "blob", path })) };
    if (path.startsWith("/contents/")) return encoded(files.get(path.slice(10).split("?")[0]).data);
    if (path.startsWith("/actions/workflows?")) return { workflows: workflowFiles.filter((file) =>
      !missingWorkflow || !file.endsWith("-documents.yml")).map((file) => ({ path: `.github/workflows/${file}`, state: "active" })) };
    throw new Error(`Unexpected request: ${endpoint}`);
  };
  return { api, requests };
}
const local = (command) => command === "node" ? "v24.18.1" : `${command} installed`;

test("preflight reuses only setup preview, distinguishes manual checks, and pins all baseline content", async () => {
  const { api, requests } = fixture();
  let setupOptions;
  const result = await preflight({ repo: "example/demo", image }, {
    api, run: local, manifest: fixtureManifest,
    setupPreview: (options) => {
      setupOptions = options;
      return { ready: true, changes: [], blockers: [], notes: [] };
    },
  });
  assert.equal(result.automatedReady, true);
  assert.equal(result.readyForLiveRun, false);
  assert.equal(result.singleOwner, false);
  assert.ok(result.manualChecks.length > 0);
  assert.equal(setupOptions.apply, false);
  assert.equal(setupOptions["set-token"], false);
  assert.equal(setupOptions["single-owner"], false);
  assert.ok(requests.filter(([, path]) => path.includes("/contents/")).every(([, path]) => path.endsWith(`?ref=${commit}`)));
  assert.match(result.imageNote, /not verified/);
});

test("preflight refuses incomplete setup, missing workflows, mutable baseline and reviewer drift", async () => {
  for (const settings of [
    { missingWorkflow: true }, { sourceRef: "main" }, { changedConfig: true }, { changedBaseline: true }, { singleOwner: true },
  ]) {
    const result = await preflight({ repo: "example/demo" }, {
      api: fixture(settings).api, run: local, manifest: fixtureManifest, setupPreview: () => ({ ready: true }),
    });
    assert.equal(result.automatedReady, false);
    assert.ok(result.blockers.length);
    if (settings.changedBaseline) assert.ok(result.blockers.some((item) => item.includes("fingerprint")));
  }
  for (const setupPreview of [
    () => ({ ready: false, changes: [{ method: "PUT" }], blockers: [] }),
    () => { throw new Error("missing administrator access"); },
    () => ({ ready: true, blockers: ["secret missing"] }),
  ]) {
    const result = await preflight({ repo: "example/demo" }, { api: fixture().api, run: local, manifest: fixtureManifest, setupPreview });
    assert.equal(result.automatedReady, false);
  }
});

test("preflight does not interpret missing CLI or explicit solo mode as readiness", async () => {
  const result = await preflight({ repo: "example/demo", singleOwner: true }, {
    api: fixture({ singleOwner: true }).api,
    manifest: fixtureManifest,
    run: (command) => { if (command === "docker") throw new Error("missing"); return local(command); },
    setupPreview: (options) => {
      assert.equal(options["single-owner"], true);
      return { ready: true };
    },
  });
  assert.equal(result.automatedReady, false);
  assert.ok(result.blockers.some((item) => item.includes("docker")));
});

test("preflight rejects main changing while setup reads mutable settings", async () => {
  const original = fixture().api;
  let reads = 0;
  const result = await preflight({ repo: "example/demo" }, {
    api: (method, endpoint) => endpoint.endsWith("/branches/main") && ++reads > 1 ?
      { commit: { sha: "f".repeat(40) } } : original(method, endpoint),
    run: local, manifest: fixtureManifest, setupPreview: () => ({ ready: true }),
  });
  assert.equal(result.automatedReady, false);
  assert.ok(result.blockers.some((item) => item.includes("Main changed")));
});
