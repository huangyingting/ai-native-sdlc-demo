import test from "node:test";
import assert from "node:assert/strict";
import {
  documentEvidence, parseIntents, readiness, readinessGate, recoveryEvidence, runTargets, scenarioEvidence,
} from "../readiness.mjs";
import { parseOptions } from "../cli.mjs";
import { provenancePath, sha256 } from "../common.mjs";
import { baselineFiles, commit, config, encoded, fixtureManifest, image } from "./helpers.mjs";

const hash = (number) => number.toString(16).padStart(40, "0");
const date = (time) => `2026-09-26T${time}:00Z`;
const policyHash = (stage) => sha256(JSON.stringify({
  minimumApprovals: config.stages[stage].minimumApprovals, reviewers: config.stages[stage].reviewers,
}));

function runEvidence(intent) {
  const docCommit = hash(500 + intent);
  const merge = hash(600 + intent);
  const digest = image.split("@")[1];
  const runId = String(100 + intent);
  const runAttempt = intent === 3 ? 2 : 1;
  const texts = { spec: `Ownership Spec for Intent ${intent}`, plan: `Ownership Plan for Intent ${intent}` };
  const user = { id: 10, login: "reviewer", type: "User" };
  const comments = [];
  const makeComment = (id, body, createdAt) => ({ id, user, body, createdAt, updatedAt: createdAt, authorAssociation: "OWNER" });
  const state = {
    version: 1, intent, baseline: commit, sealed: true, pending: null,
    counters: { spec: intent === 2 ? 2 : 1, plan: 1 },
    receipts: [], documents: {}, lastCommentId: 0,
    intentSnapshot: { title: "Clarify ownership", body: "The fixed ownership feature." },
  };
  for (const [stage, time] of [["spec", "00:20"], ["plan", "00:30"]]) {
    const version = state.counters[stage];
    const comment = makeComment(intent * 1000 + comments.length + 1, `/sdlc approve ${stage} v${version}`, date(time));
    const document = { version, hash: sha256(texts[stage]), policyHash: policyHash(stage) };
    document.approvals = [{
      user, commentId: comment.id, commentBody: comment.body,
      approvedAt: comment.createdAt, hash: document.hash, version,
    }];
    state.documents[stage] = document;
    comments.push(comment);
  }
  state.documents.plan.specHash = state.documents.spec.hash;
  if (intent === 2) {
    const comment = makeComment(intent * 1000 + 3, "/sdlc revise spec\nClarify migration and owner filter intersections.", date("00:10"));
    comments.push(comment);
    state.receipts.push({ id: comment.id, message: `Command #${comment.id} recorded: revise spec.` });
  }
  const notes = `Observed the fixed ownership acceptance checklist against ${digest}.`;
  const decision = makeComment(intent * 1000 + 4, `/sdlc accept ${digest}\n${notes}`, date("02:00"));
  comments.push(decision);
  const record = {
    version: 1, intent, repository: "example/demo", baseline: commit, mode: "live", status: "accepted",
    failure: null, lastCommentId: decision.id,
    delivery: {
      runId, runAttempt, image: image.split("@")[0], digest, mergeSha: merge, pullNumber: 200 + intent,
      runUrl: `https://github.com/example/demo/actions/runs/${runId}`, verified: true,
      policyHash: policyHash("implementation"), rejection: null,
      acceptances: [{
        user: { id: user.id, login: user.login }, commentId: decision.id, commentBody: decision.body,
        notes, at: decision.createdAt, digest, runId, runAttempt,
      }],
    },
    events: [
      ...(intent === 3 ? [
        { type: "verification-failed", runId, runAttempt: 1, at: date("01:00") },
        { type: "verification-passed", runId, runAttempt: 2, at: date("01:30") },
      ] : []),
      { type: "accept", at: decision.createdAt, commentId: decision.id },
    ],
  };
  const pull = {
    number: 200 + intent, merged: true, merge_commit_sha: merge,
    body: `Delivery Intent: #${intent}\nDelivery Stage: implementation\n`,
    base: { ref: "main", repo: { full_name: "example/demo" } }, head: { sha: hash(700 + intent) },
  };
  const workflow = {
    id: Number(runId), run_attempt: runAttempt, status: "completed", conclusion: "success",
    head_sha: merge, path: ".github/workflows/brownfield-human-gated-delivery-publish.yml",
    repository: { full_name: "example/demo" }, updated_at: date("01:59"),
  };
  const failed = { ...workflow, run_attempt: 1, conclusion: "failure", updated_at: date("01:05") };
  const statePath = `docs/delivery-runs/brownfield-human-gated-delivery/${intent}/document-review.json`;
  const raw = JSON.stringify(state);
  const ledger = {
    id: 9000 + intent, nodeId: `ledger-${intent}`, user: { id: 1, type: "Bot", login: "github-actions[bot]" },
    body: `<!-- brownfield-human-gated-delivery-document-ledger -->\n${docCommit} ${sha256(raw)}`,
  };
  comments.push(ledger);
  const evidence = {
    record, issues: [{ number: intent, comments }], config,
    pulls: [pull], workflows: [workflow],
    summary: {
      intent, recordTrusted: true, capturedAt: date("03:00"),
      recordUrl: `https://github.com/example/demo/blob/${hash(800 + intent)}/run-state.json`,
      documents: [{ path: statePath, commit: docCommit }],
    },
  };
  return { evidence, state, texts, raw, ledger, failed, statePath, docCommit };
}

function fixtures() {
  const data = [1, 2, 3].map(runEvidence);
  const files = baselineFiles();
  files.set(provenancePath, { data: Buffer.from(JSON.stringify({
    version: 1, kind: "brownfield-demo-export", source: { repository: "/source/demo", commit },
    scenario: "ownership-standard", reviewer: "reviewer", singleOwner: false, baselineVerified: true,
    exportedAt: date("00:00"), omittedPaths: [],
  })) });
  const calls = [];
  const collect = async ({ intent }) => structuredClone(data[intent - 1].evidence);
  const api = (method, endpoint, input) => {
    calls.push({ method, endpoint });
    if (endpoint === "graphql") {
      assert.equal(method, "POST");
      assert.match(input.query, /^\s*query/);
      const run = data.find((item) => item.ledger.nodeId === input.variables.id);
      return { data: { node: {
        body: run.ledger.body, author: { __typename: "Bot", login: "github-actions" },
        lastEditedAt: run.untrusted ? date("03:00") : null,
        editor: { __typename: "User", login: "reviewer" },
      } } };
    }
    assert.equal(method, "GET");
    assert.ok(endpoint.startsWith("repos/example/demo/"));
    const path = endpoint.slice("repos/example/demo/".length);
    if (path === `git/trees/${commit}?recursive=1`) return { truncated: false, tree: [...files.keys()].map((path) => ({ type: "blob", path })) };
    for (const run of data) {
      if (path === `contents/${run.statePath}?ref=${run.docCommit}`) return encoded(run.raw);
      for (const stage of ["spec", "plan"]) {
        if (path === `contents/${run.statePath.replace("document-review.json", `${stage}.md`)}?ref=${run.docCommit}`) return encoded(run.texts[stage]);
      }
      if (path === `actions/runs/${run.evidence.record.delivery.runId}`) return run.evidence.workflows[0];
      if (path === `actions/runs/${run.evidence.record.delivery.runId}/attempts/1`) return run.failed;
    }
    if (path.startsWith("contents/") && path.endsWith(`?ref=${commit}`)) {
      const entry = files.get(path.slice("contents/".length).split("?")[0]);
      if (entry) return encoded(entry.data);
    }
    throw new Error(`Unexpected API request ${endpoint}`);
  };
  return { data, files, api, collect, calls, manifest: fixtureManifest };
}

test("readiness requires exactly three distinct explicit Intent numbers and no completion switches", () => {
  assert.deepEqual(parseIntents("1,2,3"), [1, 2, 3]);
  assert.equal(parseOptions(["readiness", "--repo", "example/demo", "--intents", "1,2,3"]).command, "readiness");
  for (const value of ["", "1", "1,2", "1,2,2", "1,2,3,4", "1,2, 3", "1,2,-3", "1,2,3\n", "1,2,9007199254740992"]) {
    assert.throws(() => parseIntents(value));
  }
  assert.throws(() => parseOptions(["readiness", "--repo", "example/demo", "--intents", "1,2,3", "--accepted"]));
  assert.deepEqual(runTargets({ repos: "example/normal,example/revision,example/recovery", intents: "1,1,1" }),
    [{ repo: "example/normal", intent: 1 }, { repo: "example/revision", intent: 1 }, { repo: "example/recovery", intent: 1 }]);
  assert.throws(() => runTargets({ repo: "example/demo", intents: "1,1,1" }), /distinct/);
  assert.throws(() => runTargets({ repo: "example/demo", repos: "example/other", intents: "1,2,3" }), /either/);
  assert.throws(() => runTargets({ repos: "example/demo,example/other", intents: "1,2,3" }), /exactly three/);
});

test("document counters need trusted, sealed artifacts and actual version-specific Human comments", () => {
  const run = runEvidence(2);
  assert.equal(documentEvidence(run.evidence, run.state, run.texts, true).verified, true);
  assert.equal(documentEvidence(run.evidence, run.state, run.texts, false).verified, false);
  for (const mutate of [
    (item) => { item.state.sealed = false; },
    (item) => { item.state.baseline = hash(777); },
    (item) => { item.texts.spec += " changed"; },
    (item) => { item.state.receipts = []; },
    (item) => { item.evidence.issues[0].comments[0].body = "/sdlc approve spec v1"; },
    (item) => { item.evidence.issues[0].comments[0].user.type = "Bot"; },
    (item) => { item.evidence.issues[0].comments[0].updatedAt = date("02:00"); },
    (item) => { item.state.documents.plan.specHash = "0".repeat(64); },
  ]) {
    const changed = structuredClone(run);
    mutate(changed);
    assert.equal(documentEvidence(changed.evidence, changed.state, changed.texts, true).verified, false);
  }
});

test("recovery uses actual failed Actions attempts and later trusted recovery, not event names alone", () => {
  const { evidence, failed } = runEvidence(3);
  const event = evidence.record.events[0];
  const attempts = [{ event, workflow: failed, runId: failed.id, attempt: 1 }];
  assert.equal(recoveryEvidence(evidence.record, attempts).verified, true);
  assert.equal(recoveryEvidence(evidence.record, []).verified, false);
  for (const changed of [
    { ...failed, conclusion: "success" }, { ...failed, conclusion: "cancelled" },
    { ...failed, id: 999 }, { ...failed, run_attempt: 2 },
    { ...failed, repository: { full_name: "other/repo" } },
    { ...failed, path: ".github/workflows/unrelated.yml" },
  ]) assert.equal(recoveryEvidence(evidence.record, [{ ...attempts[0], workflow: changed }]).verified, false);
  evidence.record.events.splice(1, 1);
  assert.equal(recoveryEvidence(evidence.record, attempts).verified, false);
});

test("three distinct real-shaped accepted runs cover the three variants; retries do not inflate counts", async () => {
  const fixture = fixtures();
  const result = await readiness({ repo: "example/demo", intents: "1,2,3" }, fixture);
  assert.equal(result.ready, true);
  assert.equal(result.progress, "3/3");
  assert.equal(result.completedScenarios, 3);
  assert.deepEqual(result.runs.map((run) => run.variant), [
    "ownership-standard", "ownership-spec-revision", "ownership-failure-recovery",
  ]);
  assert.ok(fixture.calls.some((call) => call.endpoint.endsWith("/actions/runs/103/attempts/1")));
  assert.ok(fixture.calls.every((call) => call.method === "GET" || call.endpoint === "graphql"));
  assert.ok(!fixture.calls.some((call) => /actions\/runs\?|\/search/.test(call.endpoint)));
  assert.equal(fixture.calls.filter((call) => call.endpoint.includes(`/git/trees/${commit}?`)).length, 1);
  const duplicated = structuredClone(result.runs);
  duplicated[2].deliveryRunId = duplicated[1].deliveryRunId;
  assert.equal(readinessGate("example/demo", [1, 2, 3], duplicated).progress, "0/3");
});

test("unsigned runtime/doc state, failures without actual failure, missing acceptance and failed reads stay 0/3", async () => {
  for (const mutate of [
    (fixture) => { fixture.data[0].evidence.summary.recordTrusted = false; },
    (fixture) => { fixture.data[1].untrusted = true; },
    (fixture) => { fixture.data[2].failed.conclusion = "success"; },
    (fixture) => { fixture.data[2].evidence.record.delivery.acceptances = []; },
    (fixture) => { fixture.data[0].evidence.record.failure = { stage: "documents" }; },
    (fixture) => { fixture.files.delete(".github/brownfield-human-gated-delivery/scripts/runs.mjs"); },
    (fixture) => { fixture.files.get("demos/it-service-desk/src/lib/ticket.ts").data = Buffer.from("owner: string"); },
    (fixture) => { fixture.collect = async () => { throw new Error("permission denied"); }; },
  ]) {
    const fixture = fixtures();
    mutate(fixture);
    const result = await readiness({ repo: "example/demo", intents: "1,2,3" }, fixture);
    assert.equal(result.ready, false);
    assert.equal(result.completedScenarios, 0);
    assert.equal(result.progress, "0/3");
    assert.ok(result.reasons.length);
  }
});

test("three accepted standard runs or unrelated source commits do not satisfy the evidence gate", async () => {
  const fixture = fixtures();
  const result = await readiness({ repo: "example/demo", intents: "1,2,3" }, fixture);
  const runs = structuredClone(result.runs);
  runs[1].variant = "ownership-standard";
  assert.equal(readinessGate("example/demo", [1, 2, 3], runs).ready, false);
  runs[1].variant = "ownership-spec-revision";
  runs[1].sourceCommit = hash(888);
  assert.equal(readinessGate("example/demo", [1, 2, 3], runs).ready, false);
});

test("separate isolated repositories can share source provenance, not necessarily initial repository commit IDs", async () => {
  const result = await readiness({ repo: "example/demo", intents: "1,2,3" }, fixtures());
  const repos = ["example/normal", "example/revision", "example/recovery"];
  const runs = result.runs.map((run, index) => ({
    ...run, repository: repos[index], intent: 1, implementationPull: 2, baseline: hash(900 + index),
  }));
  assert.equal(readinessGate(repos, [1, 1, 1], runs).ready, true);
});

test("a claimed complete summary or declared variant cannot override actual evidence", () => {
  const { evidence, state, texts } = runEvidence(1);
  evidence.summary.acceptance = { complete: true };
  evidence.summary.variant = "ownership-failure-recovery";
  evidence.record.status = "active";
  const result = scenarioEvidence(evidence, documentEvidence(evidence, state, texts, true),
    { verified: false, recordedFailures: 0, corroborated: [] }, { verified: true, commit, reasons: [] });
  assert.equal(result.accepted, false);
  assert.equal(result.eligible, false);
  assert.equal(result.variant, null);
});
