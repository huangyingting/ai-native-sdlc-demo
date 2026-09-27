import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acceptanceEvidence, escapeHtml, replay, validateRunRecord } from "../replay.mjs";
import { configPath, sha256 } from "../common.mjs";
import { absent, artifacts, commit, config, encoded, image } from "./helpers.mjs";

const merge = "c".repeat(40);
const recordCommit = "d".repeat(40);
const documentCommit = "e".repeat(40);
const head = "f".repeat(40);
const digest = image.split("@")[1];
const at = "2026-09-26T03:00:00Z";
const notes = `Tested ${digest}: AC-1 through AC-5 passed on the isolated artifact.`;
const commentBody = `/sdlc accept ${digest}\n${notes}`;
function evidence() {
  const record = {
    version: 1, intent: 42, repository: "example/demo", baseline: commit, mode: "live", status: "accepted",
    lastCommentId: 100, events: [{ type: "accept", at }],
    delivery: {
      runId: "99", runAttempt: 2, image: image.split("@")[0], digest, mergeSha: merge, pullNumber: 44,
      runUrl: "https://github.com/example/demo/actions/runs/99", verified: true, rejection: null,
      policyHash: sha256(JSON.stringify({
        minimumApprovals: config.stages.implementation.minimumApprovals,
        reviewers: config.stages.implementation.reviewers,
      })),
      acceptances: [{ user: { id: 10, login: "reviewer" }, commentId: 100, notes, at, digest, runId: "99", runAttempt: 2 }],
    },
  };
  const human = {
    id: 100, node_id: "comment-100", user: { id: 10, login: "reviewer", type: "User" },
    body: commentBody, author_association: "COLLABORATOR", created_at: at, updated_at: at,
  };
  const pull = {
    number: 44, title: "Ownership implementation", merged: true, merge_commit_sha: merge,
    body: "Delivery Intent: #42\nDelivery Stage: implementation\n",
    base: { ref: "main", repo: { full_name: "example/demo" } }, head: { sha: head },
  };
  const workflow = {
    id: 99, run_attempt: 2, status: "completed", conclusion: "success", head_sha: merge,
    path: ".github/workflows/brownfield-human-gated-delivery-publish.yml",
    repository: { full_name: "example/demo" }, updated_at: "2026-09-26T02:00:00Z",
  };
  const issues = [{
    number: 42, comments: [{ id: human.id, user: human.user, body: human.body,
      authorAssociation: human.author_association, createdAt: human.created_at, updatedAt: human.updated_at }],
  }];
  return { record, human, pull, workflow, issues };
}

test("scripted development approvals cannot qualify as genuine Human acceptance", () => {
  const data = evidence();
  data.record.mode = "development-test";
  validateRunRecord(data.record, "example/demo", 42);
  const result = acceptanceEvidence(data.record, data.issues, [data.pull], [data.workflow], config, true);
  assert.equal(result.complete, false);
  assert.match(result.reasons.join("\n"), /Automated development tests/);
});

function mockGithub({ missingRecord = false, trusted = true, mutate = () => {} } = {}) {
  const data = evidence();
  mutate(data);
  const text = JSON.stringify(data.record);
  const ledgerBody = `<!-- brownfield-human-gated-delivery-run-ledger -->\n${recordCommit} ${sha256(text)}`;
  const ledger = {
    id: 20, node_id: "ledger-node", user: { id: 1, type: "Bot", login: "github-actions[bot]" },
    body: ledgerBody, created_at: at, updated_at: at,
  };
  const calls = [];
  const api = (method, endpoint, payload) => {
    calls.push({ method, endpoint, payload });
    if (endpoint === "graphql") {
      assert.equal(method, "POST");
      assert.match(payload.query, /^\s*query/);
      assert.doesNotMatch(payload.query, /\bmutation\b/);
      return { data: { node: {
        body: ledgerBody, lastEditedAt: trusted ? null : at,
        author: { __typename: "Bot", login: "github-actions" },
        editor: { __typename: "User", login: "reviewer" },
      } } };
    }
    assert.equal(method, "GET");
    const path = endpoint.replace("repos/example/demo", "");
    if (!path) return { full_name: "example/demo", default_branch: "main" };
    if (path === "/branches/main") return { commit: { sha: commit } };
    if (path === `/contents/${configPath}?ref=${commit}`) return encoded(config);
    if (path === "/issues/42") return {
      number: 42, title: '<img src=x onerror="alert(1)">',
      body: '</pre><script>alert("x")</script><a href="javascript:bad">bad</a>',
      state: "closed", user: { type: "User", login: "reviewer" },
    };
    if (path.startsWith("/issues/42/sub_issues?")) return [];
    if (path.startsWith("/issues/42/comments?")) return [ledger, data.human];
    if (path.startsWith("/issues/42/timeline?")) return [{
      event: "cross-referenced", source: { issue: { number: 44, pull_request: {}, repository_url: "https://api.github.com/repos/example/demo" } },
    }];
    if (path === "/git/ref/heads/brownfield-runs/42") return missingRecord ? absent() : { object: { sha: recordCommit } };
    if (path === `/contents/docs/delivery-runs/brownfield-human-gated-delivery/42/run-state.json?ref=${recordCommit}`) return encoded(text);
    if (path === "/git/ref/heads/brownfield-documents/42") return { object: { sha: documentCommit } };
    if (path === `/git/trees/${documentCommit}?recursive=1`) return { truncated: false, tree: [
      { type: "blob", path: "docs/delivery-runs/brownfield-human-gated-delivery/42/spec.md" },
      { type: "blob", path: "docs/delivery-runs/brownfield-human-gated-delivery/42/plan.md" },
    ] };
    if (path === "/pulls/44") return data.pull;
    if (path.startsWith("/pulls/44/reviews?")) return [{ user: { type: "User", login: "reviewer" }, state: "APPROVED" }];
    if (path.startsWith("/pulls/44/comments?")) return [];
    if (path.startsWith(`/commits/${head}/check-runs?`)) return { check_runs: [{ name: "stage-validation", conclusion: "success" }] };
    if (path.startsWith(`/actions/runs?head_sha=${head}&`)) return { workflow_runs: [] };
    if (path === "/actions/runs/99") return data.workflow;
    throw new Error(`Unexpected API request ${endpoint}`);
  };
  return { api, calls };
}

test("HTML escapes all untrusted text delimiters", () => {
  assert.equal(escapeHtml('&<>"\''), "&amp;&lt;&gt;&quot;&#39;");
});

test("runtime schema accepts planned v1 and rejects repo/intent/ref/image drift", () => {
  const { record } = evidence();
  assert.equal(validateRunRecord(record, "example/demo", 42), record);
  for (const mutate of [
    (value) => { value.version = 2; },
    (value) => { value.repository = "example/other"; },
    (value) => { value.intent = 43; },
    (value) => { value.baseline = "main"; },
    (value) => { value.mode = "replay"; },
    (value) => { value.delivery.digest = "latest"; },
    (value) => { value.delivery.acceptances[0].user.id = "10"; },
    (value) => { value.delivery.acceptances[0].runAttempt = 1; },
  ]) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.throws(() => validateRunRecord(changed, "example/demo", 42));
  }
  const failure = structuredClone(record);
  failure.status = "active";
  failure.delivery.verified = false;
  failure.delivery.image = "";
  failure.delivery.digest = "";
  failure.delivery.acceptances = [];
  assert.doesNotThrow(() => validateRunRecord(failure, "example/demo", 42));
});

test("completion needs attested record, actual matching merge/run, and matching unedited configured Human decision", () => {
  const data = evidence();
  const evaluate = (value, trusted = true) => acceptanceEvidence(value.record, value.issues, [value.pull], [value.workflow], config, trusted);
  assert.equal(evaluate(data).complete, true);
  assert.equal(evaluate(data, false).complete, false);
  const pullRequestRun = structuredClone(data);
  pullRequestRun.workflow.head_sha = head;
  pullRequestRun.workflow.event = "pull_request";
  pullRequestRun.workflow.pull_requests = [{ number: 44 }];
  assert.equal(evaluate(pullRequestRun).complete, true);
  pullRequestRun.workflow.pull_requests = [{ number: 900 }];
  assert.equal(evaluate(pullRequestRun).complete, false);
  for (const mutate of [
    (value) => { value.record.status = "active"; },
    (value) => { value.record.delivery.verified = false; },
    (value) => { value.record.delivery.rejection = {}; },
    (value) => { value.issues[0].comments = []; },
    (value) => { value.issues[0].comments[0].user.type = "Bot"; },
    (value) => { value.issues[0].comments[0].user.id = 999; },
    (value) => { value.issues[0].comments[0].body = "Looks good!"; },
    (value) => { value.record.delivery.acceptances[0].commentBody = "Different historical comment"; },
    (value) => { value.issues[0].comments[0].updatedAt = "2026-09-26T04:00:00Z"; },
    (value) => { value.issues[0].comments[0].authorAssociation = "NONE"; },
    (value) => { value.pull.merged = false; },
    (value) => { value.pull.merge_commit_sha = commit; },
    (value) => { value.pull.body = "Delivery Intent: #900\nDelivery Stage: implementation"; },
    (value) => { value.workflow.conclusion = "failure"; },
    (value) => { value.workflow.head_sha = commit; },
    (value) => { value.workflow.run_attempt = 3; },
    (value) => { value.workflow.repository.full_name = "example/other"; },
    (value) => { value.workflow.path = ".github/workflows/unrelated.yml"; },
    (value) => { value.record.delivery.policyHash = "0".repeat(64); },
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.equal(evaluate(changed).complete, false);
  }
});

test("replay exports escaped real evidence, current state, and only existing immutable doc links", async (t) => {
  const dest = join(artifacts(t), "replay");
  const mock = mockGithub();
  const result = await replay({ repo: "example/demo", intent: "42", dest }, { api: mock.api });
  assert.equal(result.summary.mode, "read-only-replay");
  assert.equal(result.summary.live, false);
  assert.equal(result.summary.currentGitHubIssueState, "closed");
  assert.equal(result.summary.acceptance.complete, true);
  assert.equal(result.summary.documents.length, 2);
  assert.ok(result.summary.documents.every((document) => document.url.includes(`/blob/${documentCommit}/`)));
  const html = readFileSync(join(dest, "index.html"), "utf8");
  assert.match(html, /NOT LIVE/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /Content-Security-Policy/);
  const exported = JSON.parse(readFileSync(join(dest, "evidence.json"), "utf8"));
  assert.equal(exported.record.delivery.digest, digest);
  assert.equal(exported.pulls[0].reviews[0].state, "APPROVED");
  assert.match(result.summary.scenarioRunsCompleted, /Not assessed/);
  assert.ok(mock.calls.every((call) => call.method === "GET" || call.endpoint === "graphql"));
  await assert.rejects(replay({ repo: "example/demo", intent: "42", dest }, { api: mock.api }), /already exists/);
});

test("closed issues, missing records and tampered ledgers never invent acceptance", async (t) => {
  const directory = artifacts(t);
  for (const [name, settings] of [["legacy", { missingRecord: true }], ["tampered", { trusted: false }]]) {
    const result = await replay({ repo: "example/demo", intent: "42", dest: join(directory, name) }, { api: mockGithub(settings).api });
    assert.equal(result.summary.acceptance.complete, false);
    assert.equal(result.summary.currentGitHubIssueState, "closed");
    assert.ok(result.summary.warnings.length);
  }
});

test("API failures do not create a misleading partial replay", async (t) => {
  const dest = join(artifacts(t), "failed");
  await assert.rejects(replay({ repo: "example/demo", intent: "42", dest }, {
    api: () => { throw new Error("permission denied"); },
  }), /permission denied/);
  assert.equal(existsSync(dest), false);
});
