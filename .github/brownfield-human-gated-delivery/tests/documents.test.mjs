import { afterEach, test } from "node:test";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactPaths, lifecycleBranch, loadConfig, validateStageFiles } from "../scripts/core.mjs";
import {
  approveDocument, contentHash, discoveryBlockers, discoveryContextHash, documentBranch, documentMode, documentStatePath,
  hasDocumentApproval, initialDocumentState, parseDocumentCommand, publishDocumentRevision,
  latestDecisions, recordDiscoveryDecision, requestDocumentRevision, validateDiscoveryDocument,
  validateDocumentHandoff, validateDocumentState, validateGeneratedDocument,
} from "../scripts/document-core.mjs";
import { discoveryPacket, DocumentReview, renderDocumentRevision, routeDocumentKickoff } from "../scripts/documents.mjs";
import { RunControl } from "../scripts/runs.mjs";
import { applyRunCommand, newRun, parseRunCommand, recordDelivery, runBranch, runStatePath, validateRun } from "../scripts/run-core.mjs";
import { advance, delivery, verify } from "../scripts/github.mjs";

const config = { ...loadConfig(), specReadiness: "structural" };
const discoveryConfig = { ...config, specReadiness: "decisions-v1" };

test("actual CLI entrypoints finish module evaluation before loading mutually dependent helpers", () => {
  const directory = mkdtempSync(join(tmpdir(), "sdlc-cli-imports-"));
  try {
    const preload = join(directory, "network.mjs");
    const event = join(directory, "event.json");
    writeFileSync(preload, 'globalThis.fetch = async () => { throw new Error("CLI_MODULE_GRAPH_READY"); };\n');
    writeFileSync(event, JSON.stringify({ issue: { number: 42 } }));
    for (const [file, command] of [["github.mjs", "route-kickoff"], ["documents.mjs", "prepare"]]) {
      const result = spawnSync(process.execPath, ["--import", preload, new URL(`../scripts/${file}`, import.meta.url).pathname, command], {
        encoding: "utf8", timeout: 10000,
        env: { ...process.env, GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "example/repo",
          INTENT_ISSUE_NUMBER: "42", GITHUB_EVENT_PATH: event },
      });
      assert.equal(result.status, 1, `${file}: ${result.stderr}`);
      assert.match(result.stderr, /CLI_MODULE_GRAPH_READY/);
      assert.doesNotMatch(result.stderr, /unsettled top-level await/);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
const human = { id: 123, login: "huangyingting", type: "User" };
const spec = `# Specification

## Intent
Clarify ticket ownership.
## Scope
Optional owner names.
## Non-goals
No user directory.
## Actors
Support agents.
## Constraints
Preserve existing tickets.
## Acceptance scenarios
### AC-1: Assign an owner
**Given** a ticket
**When** an agent assigns an owner
**Then** the owner is persisted
## Revision summary
Initial proposal.
## Open questions
None.
`;
const plan = `# Implementation plan

## Acceptance mapping
TASK-1 covers AC-1.
## Tasks
### TASK-1: Persist ticket ownership
Depends on: none
Acceptance: AC-1
Surfaces: ticket store and UI
Validation: store and UI tests
## Risks and migrations
Add nullable column and preserve existing data.
## Validation
Controlled Red tests followed by Green tests, lint, build and container smoke.
## Revision summary
Initial plan.
## Open questions
None.
`;
const sha = (text) => createHash("sha1").update(text).digest("hex");
const blob = (text) => sha(`blob ${Buffer.byteLength(text)}\0${text}`);
const baseline = sha("baseline");
const parent = {
  number: 42, id: 42, title: "[Brownfield delivery] Ownership", body: "Clarify ticket ownership.",
  state: "open", author_association: "OWNER", labels: [{ name: "brownfield-human-gated-delivery:intent" }],
};
function command(body, id = 100) {
  return { id, body, user: human, author_association: "OWNER", created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z" };
}
function pureSpec() {
  const state = initialDocumentState(parent, baseline);
  requestDocumentRevision(state, "spec", "Initial proposal", config);
  publishDocumentRevision(state, spec, null, config);
  return state;
}
function sealedState() {
  const state = pureSpec();
  approveDocument(state, parseDocumentCommand("/sdlc approve spec v1"), command("/sdlc approve spec v1"), config);
  requestDocumentRevision(state, "plan", "Initial plan", config);
  publishDocumentRevision(state, plan, spec, config);
  approveDocument(state, parseDocumentCommand("/sdlc approve plan v1"), command("/sdlc approve plan v1", 101), config);
  return state;
}

const ownershipQuestion = { id: "Q-1", question: "May a ticket remain unassigned?", options: "Optional owner / mandatory owner" };
function discoverySpec(discovery = { questions: [ownershipQuestion], decisions: [] }, changes = {}) {
  const brief = {
    problem: "Agents cannot identify responsibility during handoffs.",
    evidence: "Human Intent; user research baseline is unknown.",
    successMeasure: "Owner is visible and persists; business improvement is not measured.",
    alternatives: "Keep current process, optional owner, or mandatory owner.",
    questions: discovery.questions,
    decisionMapping: latestDecisions(discovery).map((decision) => ({
      questionId: decision.questionId, commentId: decision.commentId, acceptanceIds: ["AC-1"],
      explanation: decision.disposition === "deferred" ? "Risk remains explicitly deferred." : "AC-1 permits an unassigned ticket.",
    })),
    ...changes,
  };
  return spec.replace("## Open questions\nNone.", `## Open questions\nSee the discovery register; deferments remain risks.
## Discovery
\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\``);
}
const answer = (version = 1, id = "Q-1") => `/sdlc decide spec v${version} ${id}\nOutcome: A ticket may remain unassigned.\nRationale: New work arrives before triage.`;
const defer = (version = 1) => `/sdlc defer spec v${version} Q-1\nRationale: Bounded rehearsal only.\nOwner: huangyingting\nFollow-up: Before production use in a linked Intent.\nRisk: No validated customer ownership policy.`;
function discoveryDraft() {
  const state = initialDocumentState(parent, baseline, discoveryConfig);
  requestDocumentRevision(state, "spec", "Initial discovery", discoveryConfig);
  publishDocumentRevision(state, discoverySpec(), null, discoveryConfig);
  return state;
}

test("new-run discovery enrollment is explicit and persisted without migrating legacy states", () => {
  assert.equal(loadConfig().specReadiness, "decisions-v1");
  const legacy = initialDocumentState(parent, baseline);
  assert.equal(legacy.version, 1);
  assert.equal(initialDocumentState(parent, baseline, config).version, 1);
  const state = discoveryDraft();
  assert.equal(state.version, 2);
  assert.equal(state.reviewProfile, "decisions-v1");
  validateDocumentState(state, 42);
  assert.throws(() => initialDocumentState(parent, baseline, { specReadiness: "future" }), /Unsupported/);
  assert.throws(() => validateDocumentState({ ...legacy, reviewProfile: "decisions-v1" }, 42), /cannot enroll/);
  assert.throws(() => validateDocumentState({ ...state, reviewProfile: "future" }, 42), /Unsupported/);
  assert.throws(() => recordDiscoveryDecision(pureSpec(), parseDocumentCommand(answer()), command(answer()), discoveryConfig), /not migrated/);
});

test("discovery commands require version, question, and complete bounded decision or deferment fields", () => {
  assert.equal(parseDocumentCommand(answer()).fields.Outcome, "A ticket may remain unassigned.");
  assert.equal(parseDocumentCommand(defer()).fields.Owner, human.login);
  for (const body of [answer().replace("v1", "v0"), answer().replace("Q-1", "Q-0"),
    answer().replace("spec", "plan"), answer().replace("\nRationale:", "\nExtra:"),
    answer().replace("Outcome: ", "Outcome:").replace("A ticket may remain unassigned.", ""),
    answer() + "\nRationale: duplicate", defer().replace("Owner: huangyingting", "Owner: @invalid"),
    defer().replace("\nRisk: No validated customer ownership policy.", ""), answer() + "x".repeat(4001)]) {
    assert.throws(() => parseDocumentCommand(body));
  }
});

test("all unanswered discovery questions block approval; ordinary prose cannot resolve them", () => {
  const state = discoveryDraft();
  assert.equal(discoveryBlockers(state).length, 1);
  assert.throws(() => approveDocument(state, parseDocumentCommand("/sdlc approve spec v1"),
    command("/sdlc approve spec v1"), discoveryConfig), /Unresolved discovery blockers: Q-1/);
  assert.throws(() => requestDocumentRevision(state, "plan", "Bypass", discoveryConfig), /Approve/);
  assert.equal(state.documents.spec.approvals.length, 0);
});

test("generation cannot remove questions, forge decisions, or substitute stale decision mappings", () => {
  const state = discoveryDraft();
  for (const changes of [
    { questions: [] }, { questions: [{ ...ownershipQuestion, question: "A different question" }] },
    { questions: [{ ...ownershipQuestion, options: "Always assigned" }] },
    { questions: [{ ...ownershipQuestion, status: "resolved" }] },
    { decisionMapping: [{ questionId: "Q-1", commentId: 123, acceptanceIds: ["AC-1"], explanation: "Invented Human answer" }] },
  ]) assert.throws(() => validateDiscoveryDocument(discoverySpec(state.discovery, changes), state.discovery));
  recordDiscoveryDecision(state, parseDocumentCommand(answer()), command(answer()), discoveryConfig);
  assert.throws(() => validateDiscoveryDocument(discoverySpec(state.discovery, { decisionMapping: [] }), state.discovery), /every latest/);
  const mapping = { questionId: "Q-1", commentId: 99, acceptanceIds: ["AC-1"], explanation: "Ignored actual answer" };
  assert.throws(() => validateDiscoveryDocument(discoverySpec(state.discovery, { decisionMapping: [mapping] }), state.discovery), /stale/);
  assert.throws(() => validateDiscoveryDocument(discoverySpec(state.discovery, { decisionMapping: [{ ...mapping, commentId: 100, acceptanceIds: ["AC-9"] }] }), state.discovery), /acceptance IDs/);
  assert.throws(() => validateDiscoveryDocument(discoverySpec(state.discovery) + "\n## Discovery\nNone", state.discovery), /exactly one/);
});

test("Human decisions trigger a new Spec, bind context, retain deferred risk, and require fresh approval", () => {
  const state = discoveryDraft();
  const oldContext = state.documents.spec.contextHash;
  recordDiscoveryDecision(state, parseDocumentCommand(defer()), command(defer()), discoveryConfig);
  assert.equal(state.pending.version, 2);
  assert.equal(state.discovery.decisions[0].disposition, "deferred");
  assert.equal(state.discovery.decisions[0].commentBody, defer());
  assert.equal(state.discovery.decisions[0].contextHash, oldContext);
  assert.equal(discoveryBlockers(state).length, 0);
  assert.throws(() => approveDocument(state, parseDocumentCommand("/sdlc approve spec v1"), command(""), config), /pending/);
  const revised = discoverySpec(state.discovery);
  publishDocumentRevision(state, revised, null, config);
  assert.notEqual(state.documents.spec.contextHash, oldContext);
  assert.equal(state.documents.spec.approvals.length, 0);
  approveDocument(state, parseDocumentCommand("/sdlc approve spec v2"), command("/sdlc approve spec v2", 101), config);
  assert.equal(state.documents.spec.approvals[0].contextHash, discoveryContextHash(state.discovery));
  requestDocumentRevision(state, "plan", "Draft", config);
  publishDocumentRevision(state, plan, revised, config);
  approveDocument(state, parseDocumentCommand("/sdlc approve plan v1"), command("/sdlc approve plan v1", 102), config);
  validateDocumentHandoff(state, { spec: revised, plan }, config);
  const packet = discoveryPacket(state, revised);
  assert.match(packet, /Explicitly deferred risks: \*\*1\*\*/);
  assert.match(packet, /Follow-up: Before production use/);
  const broken = structuredClone(state);
  broken.documents.plan.approvals[0].contextHash = oldContext;
  assert.throws(() => validateDocumentHandoff(broken, { spec: revised, plan }, config), /discovery binding/);
  assert.throws(() => recordDiscoveryDecision(state, parseDocumentCommand(answer(2)), command(answer(2), 104), config), /handed off/);
});

test("changed decisions invalidate an approved Spec and Plan while retaining superseded receipts", () => {
  const state = discoveryDraft();
  recordDiscoveryDecision(state, parseDocumentCommand(answer()), command(answer()), discoveryConfig);
  const revised = discoverySpec(state.discovery);
  publishDocumentRevision(state, revised, null, discoveryConfig);
  approveDocument(state, parseDocumentCommand("/sdlc approve spec v2"), command("/sdlc approve spec v2", 101), discoveryConfig);
  requestDocumentRevision(state, "plan", "Draft", discoveryConfig);
  publishDocumentRevision(state, plan, revised, discoveryConfig);
  recordDiscoveryDecision(state, parseDocumentCommand(defer(2)), command(defer(2), 102), discoveryConfig);
  assert.equal(state.documents.plan, null);
  assert.deepEqual(state.documents.spec.approvals, []);
  assert.equal(state.pending.version, 3);
  assert.equal(state.discovery.decisions.length, 2);
  assert.equal(latestDecisions(state.discovery)[0].commentId, 102);
  assert.throws(() => publishDocumentRevision(state, revised, null, discoveryConfig), /stale/);
  validateDocumentState(state, 42);
});

test("decision state rejects tampered receipts, missing bindings and unsupported fields", () => {
  const state = discoveryDraft();
  recordDiscoveryDecision(state, parseDocumentCommand(answer()), command(answer()), discoveryConfig);
  publishDocumentRevision(state, discoverySpec(state.discovery), null, discoveryConfig);
  for (const mutate of [
    (copy) => { copy.discovery.decisions[0].fields.Outcome = "Tampered"; },
    (copy) => { copy.discovery.decisions[0].commentBody = "Not a command"; },
    (copy) => { copy.discovery.decisions[0].user.type = "Bot"; },
    (copy) => { copy.discovery.decisions.push(copy.discovery.decisions[0]); },
    (copy) => { copy.discovery.decisions[0].questionId = "Q-9"; },
    (copy) => { delete copy.documents.spec.contextHash; },
    (copy) => { copy.discovery.questions = []; },
    (copy) => { copy.version = 99; },
  ]) {
    const copy = structuredClone(state);
    mutate(copy);
    assert.throws(() => validateDocumentState(copy, 42));
  }
});

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function repository(reviewConfig = config) {
  let counter = 1000;
  const initialTree = sha("initial-tree");
  const commits = new Map([[baseline, { tree: { sha: initialTree }, parents: [] }]]);
  const trees = new Map([[initialTree, { "README.md": "Existing application" }]]);
  const refs = new Map([["main", baseline]]);
  const issues = [structuredClone(parent)];
  const comments = [];
  const calls = [];
  const labels = [];
  const state = {
    comments, issues, refs, commits, trees, calls, assignments: [], dispatches: 0,
    permissions: new Map([[human.login, "admin"]]),
    teamMembers: [], fail: null, onCall: null, pulls: [],
  };
  const reply = (body, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });
  const notFound = () => reply({ message: "Not Found" }, 404);
  const treeAt = (ref) => trees.get(commits.get(refs.get(ref) ?? ref)?.tree.sha);
  const listPage = (items, url) => {
    const page = Number(url.searchParams.get("page") ?? 1);
    return items.slice((page - 1) * 100, page * 100);
  };
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method ?? "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    const path = url.pathname.replace("/repos/example/repo", "");
    const call = { path, method, body };
    calls.push(call);
    state.onCall?.(call);
    if (state.fail?.(call)) return reply({ message: "Injected failure" }, 503);
    if (path === "/graphql") {
      if (body.query.includes("DocumentLedger") || body.query.includes("VerificationReceipt")) {
        const comment = comments.find((item) => item.node_id === body.variables.id);
        return reply({ data: { node: {
          body: comment.body, lastEditedAt: comment.lastEditedAt ?? null,
          author: { __typename: "Bot", login: "github-actions" },
          editor: comment.editor ?? { __typename: "Bot", login: "github-actions" },
        } } });
      }
      if (body.query.includes("DisableAutoMerge")) {
        state.pulls.find((pr) => pr.node_id === body.variables.pullRequestId).auto_merge = null;
        return reply({ data: {} });
      }
      if (body.query.includes("CopilotActor")) {
        return reply({ data: { repository: { id: "REPO", suggestedActors: { nodes: [{ __typename: "Bot", login: "Copilot", id: "BOT" }] } } } });
      }
      if (body.query.includes("AssignCopilot")) {
        state.assignments.push(body.variables);
        const issue = issues.find((item) => item.node_id === body.variables.assignableId);
        issue.assignees = [{ login: "Copilot", type: "Bot" }];
        return reply({ data: {} });
      }
    }
    if (path === "/orgs/example/teams/approvers/members") return reply(state.teamMembers);
    if (path === "") return reply({ default_branch: "main" });
    if (path === "/pulls") return reply(state.pulls.filter((pr) => pr.state === "open"));
    if (path.startsWith("/pulls/")) {
      const pr = state.pulls.find((pr) => pr.number === Number(path.split("/")[2]));
      return reply({ ...pr, merge_commit_sha: undefined, timeline: undefined });
    }
    if (/^\/issues\/\d+\/timeline$/.test(path)) {
      const pr = state.pulls.find((pr) => pr.number === Number(path.split("/")[2]));
      return reply(listPage(pr.timeline, url));
    }
    if (path.startsWith("/statuses/") && method === "POST") return reply(body);
    if (/^\/issues\/\d+\/parent$/.test(path)) return reply(issues[0]);
    if (path.startsWith("/collaborators/")) return reply({ permission: state.permissions.get(path.split("/")[2]) ?? "read" });
    if (path.startsWith("/git/ref/heads/")) {
      const ref = path.slice("/git/ref/heads/".length);
      return refs.has(ref) ? reply({ object: { sha: refs.get(ref) } }) : notFound();
    }
    if (path.startsWith("/git/refs/heads/") && method === "PATCH") {
      const ref = path.slice("/git/refs/heads/".length);
      if (body.force !== false || commits.get(body.sha).parents[0] !== refs.get(ref)) {
        return reply({ message: "Non-fast-forward" }, 422);
      }
      refs.set(ref, body.sha);
      return reply({});
    }
    if (path.startsWith("/git/refs/heads/") && method === "DELETE") {
      const ref = path.slice("/git/refs/heads/".length);
      return refs.delete(ref) ? reply(null, 204) : notFound();
    }
    if (path === "/git/refs" && method === "POST") {
      const ref = body.ref.replace("refs/heads/", "");
      if (refs.has(ref)) return reply({ message: "Reference exists" }, 422);
      refs.set(ref, body.sha);
      return reply({});
    }
    if (path.startsWith("/git/commits/")) return reply(commits.get(path.split("/").at(-1)));
    if (path === "/git/trees" && method === "POST") {
      const tree = { ...trees.get(body.base_tree) };
      for (const file of body.tree) {
        if (file.sha === null) delete tree[file.path];
        else tree[file.path] = file.content;
      }
      const id = sha(JSON.stringify(tree));
      trees.set(id, tree);
      return reply({ sha: id });
    }
    if (path === "/git/commits" && method === "POST") {
      const id = sha(String(++counter));
      commits.set(id, { tree: { sha: body.tree }, parents: body.parents });
      return reply({ sha: id });
    }
    if (path.startsWith("/contents/")) {
      const text = treeAt(url.searchParams.get("ref"))?.[path.slice("/contents/".length)];
      return text === undefined ? notFound() : reply({ type: "file", encoding: "base64", sha: blob(text), content: Buffer.from(text).toString("base64") });
    }
    if (path.startsWith("/compare/")) {
      const [base, head] = path.slice("/compare/".length).split("...");
      const before = treeAt(base);
      const after = treeAt(head);
      const files = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((name) => before[name] !== after[name])
        .map((filename) => ({ filename, status: before[filename] === undefined ? "added" : "modified" }));
      return reply({ merge_base_commit: { sha: base }, files });
    }
    if (path === "/labels" && method === "POST") { labels.push(body); return reply(body); }
    if (path.startsWith("/labels/")) {
      const label = labels.find((item) => item.name === decodeURIComponent(path.slice("/labels/".length)));
      return label ? reply(label) : notFound();
    }
    if (path === "/issues" && method === "GET") return reply(listPage(issues.slice(1), url));
    if (path === "/issues" && method === "POST") {
      const number = issues.length + 42;
      const issue = { ...body, number, id: number, node_id: `ISSUE_${number}`, state: "open", assignees: [],
        labels: body.labels.map((name) => ({ name })), html_url: `https://github.com/example/repo/issues/${number}` };
      issues.push(issue);
      return reply(issue);
    }
    if (path === "/issues/42/sub_issues") return reply(method === "GET" ? issues.slice(1) : {});
    if (path === "/issues/42/comments") {
      if (method === "GET") return reply(listPage(comments, url));
      const comment = { id: ++counter, node_id: `COMMENT_${counter}`, body: body.body, user: { login: "github-actions[bot]", type: "Bot" } };
      comments.push(comment);
      return reply(comment);
    }
    if (path.startsWith("/issues/comments/")) {
      const comment = comments.find((item) => item.id === Number(path.split("/").at(-1)));
      if (!comment) return notFound();
      if (method === "PATCH") Object.assign(comment, body);
      return reply(comment);
    }
    if (/^\/issues\/\d+$/.test(path)) {
      const issue = issues.find((item) => item.number === Number(path.split("/").at(-1)));
      if (method === "PATCH") Object.assign(issue, body);
      return reply(issue);
    }
    if (path === "/actions/workflows/brownfield-human-gated-delivery-documents.yml/dispatches") {
      state.dispatches++;
      assert.equal(body.ref, "main");
      assert.equal(body.inputs.issue_number, "42");
      return reply(null, 204);
    }
    if (path === "/actions/workflows/brownfield-human-gated-delivery-pr-coordinator.yml/dispatches") return reply(null, 204);
    throw new Error(`Unexpected document API request: ${method} ${path}`);
  };
  const review = new DocumentReview({ token: "test-workflow", copilotToken: "test-assignment", owner: "example", repo: "repo", config: structuredClone(reviewConfig) });
  return {
    ...state, state, review, treeAt,
    add(body, overrides = {}) {
      const comment = { ...command(body, ++counter), ...overrides };
      comments.push(comment);
      return comment;
    },
    async draft(stage = "spec") {
      const snapshot = await review.process(42);
      assert.equal(snapshot.state.pending.stage, stage);
      return review.publish(42, snapshot.sha, stage === "spec" ? spec : plan);
    },
  };
}

test("Issue commands require exact submitted syntax and explicit document versions", () => {
  assert.equal(parseDocumentCommand("Looks good!"), null);
  assert.equal(parseDocumentCommand("> /sdlc approve spec v1"), null);
  assert.deepEqual(parseDocumentCommand("/sdlc revise spec\nPlease preserve unassigned tickets."), { action: "revise", stage: "spec", feedback: "Please preserve unassigned tickets." });
  assert.deepEqual(parseDocumentCommand("/sdlc approve plan v2"), { action: "approve", stage: "plan", version: 2 });
  assert.deepEqual(parseDocumentCommand("/sdlc retry"), { action: "retry" });
  for (const text of ["/sdlc approve spec", "/sdlc approve plan v0", "/sdlc revise spec", "/sdlc approve plan v2\nAlso change code", "/sdlc approve spec v9007199254740992"]) {
    assert.throws(() => parseDocumentCommand(text), /Use \/sdlc/);
  }
});

async function publishDiscovery(mock) {
  const pending = await mock.review.process(42);
  return mock.review.publish(42, pending.sha, discoverySpec({
    questions: pending.state.discovery.questions.length ? pending.state.discovery.questions : [ownershipQuestion],
    decisions: pending.state.discovery.decisions,
  }));
}

test("discovery run completes blocked draft -> Human decision -> revised Spec -> approved Plan -> Tests only", async () => {
  const mock = repository(discoveryConfig);
  let snapshot = await publishDiscovery(mock);
  assert.equal(snapshot.state.reviewProfile, "decisions-v1");
  assert.ok(mock.comments.some((item) => item.body.includes("Q-1 - BLOCKING")));
  mock.add("Optional ownership is fine. Continue.");
  mock.add("/sdlc approve spec v1");
  snapshot = await mock.review.process(42);
  assert.match(snapshot.state.receipts.at(-1).message, /Unresolved discovery blockers/);
  assert.equal(snapshot.state.pending, null);
  assert.equal(mock.state.assignments.length, 0);
  const decision = mock.add(answer());
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending.version, 2);
  assert.equal(snapshot.state.discovery.decisions[0].commentId, decision.id);
  assert.match(await mock.review.prompt(snapshot), /latestDecisions/);
  mock.review.config.specReadiness = "structural";
  const revised = discoverySpec(snapshot.state.discovery);
  snapshot = await mock.review.publish(42, snapshot.sha, revised);
  assert.equal(snapshot.state.version, 2);
  const duplicateRun = await mock.review.process(42);
  assert.equal(duplicateRun.state.discovery.decisions.length, 1);
  mock.add("/sdlc approve spec v1");
  snapshot = await mock.review.process(42);
  assert.match(snapshot.state.receipts.at(-1).message, /Stale/);
  mock.add("/sdlc approve spec v2");
  snapshot = await mock.draft("plan");
  assert.match(mock.comments.find((item) => item.body.startsWith("<!-- sdlc-document:plan:")).body, /Human receipt/);
  mock.add("/sdlc approve plan v1");
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.sealed, true);
  assert.equal(mock.state.assignments.length, 1);
  assert.equal(mock.state.assignments[0].assignableId, "ISSUE_45");
  await mock.review.verifyPullRequest(42, "tests", { head: { sha: snapshot.sha } });
  validateDocumentHandoff(snapshot.state, { spec: revised, plan }, discoveryConfig);
});

test("new configuration never enrolls an existing structural run", async () => {
  const mock = repository();
  await mock.draft();
  mock.review.config.specReadiness = "decisions-v1";
  mock.add(answer());
  let snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.version, 1);
  assert.match(snapshot.state.receipts.at(-1).message, /not migrated/);
  mock.add("/sdlc approve spec v1");
  snapshot = await mock.draft("plan");
  assert.equal(snapshot.state.version, 1);
});

test("discovery rejects decisions before publication, from non-reviewers, or against stale contexts", async () => {
  const mock = repository(discoveryConfig);
  let snapshot = await mock.review.process(42);
  mock.add(answer());
  await mock.review.publish(42, snapshot.sha, discoverySpec());
  snapshot = await mock.review.process(42);
  assert.match(snapshot.state.receipts.at(-1).message, /predates publication/);
  mock.state.permissions.set("writer", "write");
  mock.add(answer(), { user: { id: 55, login: "writer", type: "User" } });
  mock.add(answer(), { updated_at: "2026-09-27T00:00:00Z" });
  mock.add(answer(), { user: { id: 55, login: "github-actions[bot]", type: "Bot" } });
  mock.add(answer(2));
  mock.add(answer(1, "Q-9"));
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.discovery.decisions.length, 0);
  assert.equal(snapshot.state.receipts.filter((receipt) => receipt.message.includes("rejected")).length, 5);
  mock.review.config.stages.spec.reviewers.teams = ["approvers"];
  mock.add(answer());
  snapshot = await mock.review.process(42);
  assert.match(snapshot.state.receipts.at(-1).message, /policy changed/);
});

test("team reviewers can decide, with final approval quorum unchanged", async () => {
  const multi = structuredClone(discoveryConfig);
  multi.stages.spec.reviewers.teams = ["approvers"];
  multi.stages.spec.minimumApprovals = 2;
  const mock = repository(multi);
  await publishDiscovery(mock);
  const teammate = { id: 55, login: "teammate", type: "User" };
  mock.state.teamMembers = [teammate];
  mock.state.permissions.set(teammate.login, "write");
  mock.add(answer(), { user: teammate });
  let snapshot = await publishDiscovery(mock);
  assert.equal(snapshot.state.discovery.decisions[0].user.id, teammate.id);
  mock.add("/sdlc approve spec v2", { user: teammate });
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending, null);
  assert.equal(snapshot.state.documents.spec.approvals.length, 1);
  mock.add("/sdlc approve spec v2");
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending.stage, "plan");
});

test("decision persistence and publication failures recover without duplicate decisions or premature approval", async () => {
  const mock = repository(discoveryConfig);
  await publishDiscovery(mock);
  const decision = mock.add(answer());
  mock.state.fail = (call) => call.method === "POST" && call.body?.body?.startsWith(`<!-- sdlc-command:${decision.id} -->`);
  await assert.rejects(() => mock.review.process(42), /503/);
  let snapshot = await mock.review.load(42);
  assert.equal(snapshot.state.discovery.decisions.length, 1);
  assert.equal(snapshot.state.pending.version, 2);
  mock.state.fail = null;
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.discovery.decisions.length, 1);
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, discoverySpec()), /every latest/);
  mock.state.fail = (call) => call.method === "POST" && call.body?.body?.startsWith("<!-- sdlc-document:spec:v2:");
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, discoverySpec(snapshot.state.discovery)), /503/);
  mock.add("/sdlc approve spec v2");
  mock.state.fail = null;
  snapshot = await mock.review.process(42);
  assert.match(snapshot.state.receipts.at(-1).message, /predates publication/);
  assert.equal(snapshot.state.documents.spec.approvals.length, 0);
  assert.equal(snapshot.state.discovery.decisions.length, 1);
  assert.equal(mock.comments.filter((item) => item.body.startsWith("<!-- sdlc-document:spec:v2:")).length, 1);
  assert.equal(mock.state.assignments.length, 0);
});

test("decision retries after a ledger failure leave state untouched, and queued old answers are rejected", async () => {
  const mock = repository(discoveryConfig);
  const original = await publishDiscovery(mock);
  mock.add(answer());
  mock.add(defer());
  mock.state.fail = (call) => call.method === "PATCH" && call.body?.body?.includes("document-ledger");
  await assert.rejects(() => mock.review.process(42), /503/);
  assert.equal(mock.refs.get(documentBranch(42)), original.sha);
  assert.equal((await mock.review.load(42)).state.discovery.decisions.length, 0);
  mock.state.fail = null;
  let snapshot = await mock.review.process(42);
  await mock.review.publish(42, snapshot.sha, discoverySpec(snapshot.state.discovery));
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.discovery.decisions.length, 1);
  assert.match(snapshot.state.receipts.at(-1).message, /Stale/);
});

test("a missing invalidated revision comment cannot block pending decision-revision recovery", async () => {
  const mock = repository(discoveryConfig);
  const original = await publishDiscovery(mock);
  mock.add(answer());
  let snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending.version, 2);
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, discoverySpec()), /every latest/);
  const oldComment = mock.comments.findIndex((item) => item.body.startsWith("<!-- sdlc-document:spec:v1:"));
  assert.notEqual(oldComment, -1);
  mock.comments.splice(oldComment, 1);
  const retry = mock.add("/sdlc retry");
  snapshot = await mock.review.process(42);
  assert.ok(snapshot.state.receipts.some((receipt) => receipt.id === retry.id && receipt.message.includes("recorded")));
  assert.equal(snapshot.state.pending.version, 2);
  assert.equal(snapshot.state.discovery.decisions.length, 1);
  assert.equal(snapshot.documents.spec, original.documents.spec);
  assert.equal(mock.comments.some((item) => item.body.startsWith("<!-- sdlc-document:spec:v1:")), false);
  snapshot = await mock.review.process(42);
  snapshot = await mock.review.publish(42, snapshot.sha, discoverySpec(snapshot.state.discovery));
  assert.ok(mock.comments.some((item) => item.body.startsWith("<!-- sdlc-document:spec:v2:")));
  mock.add("/sdlc approve spec v2");
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending.stage, "plan");
});

test("empty discovery questions are allowed, while newly found questions block subsequent approval", () => {
  const state = initialDocumentState(parent, baseline, discoveryConfig);
  requestDocumentRevision(state, "spec", "Fully specified Intent", discoveryConfig);
  publishDocumentRevision(state, discoverySpec({ questions: [], decisions: [] }), null, discoveryConfig);
  approveDocument(state, parseDocumentCommand("/sdlc approve spec v1"), command("/sdlc approve spec v1"), discoveryConfig);
  requestDocumentRevision(state, "spec", "Discovered ambiguity", discoveryConfig);
  publishDocumentRevision(state, discoverySpec(), null, discoveryConfig);
  assert.throws(() => approveDocument(state, parseDocumentCommand("/sdlc approve spec v2"), command("/sdlc approve spec v2"), discoveryConfig), /blockers/);
});

test("discovery bounds and rendered packets retain all blockers without unbounded comment growth", () => {
  const questions = Array.from({ length: 20 }, (_, i) => ({
    id: `Q-${i + 1}`, question: "A".repeat(500), options: "B".repeat(500),
  }));
  const discovery = { questions, decisions: [] };
  const text = discoverySpec(discovery);
  const state = initialDocumentState(parent, baseline, discoveryConfig);
  requestDocumentRevision(state, "spec", "Large bounded brief", discoveryConfig);
  publishDocumentRevision(state, text, null, discoveryConfig);
  const packet = renderDocumentRevision({ sha: baseline, state, documents: { spec: text } }, "spec", "example/repo");
  assert.ok(Buffer.byteLength(packet) <= 60000);
  assert.match(packet, /excerpt; see versioned record/);
  for (const question of questions) assert.ok(packet.includes(`**${question.id} - BLOCKING:**`));
  assert.ok(packet.includes(text));
  assert.throws(() => validateDiscoveryDocument(discoverySpec(discovery, {
    questions: [...questions, { ...ownershipQuestion, id: "Q-21" }],
  }), discovery), /at most 20/);
  const oversized = text.replace("Optional owner names.", "x".repeat(60000));
  assert.throws(() => renderDocumentRevision({ sha: baseline, state, documents: { spec: oversized } }, "spec", "example/repo"), /exceeds 60 KB/);
});

test("document validation enforces existing contracts and complete review presentation", () => {
  validateGeneratedDocument("spec", spec);
  validateGeneratedDocument("plan", plan, spec);
  for (const [stage, document] of [["spec", spec], ["plan", plan]]) {
    for (const heading of ["Revision summary", "Open questions"]) {
      const spaced = document.replace(`## ${heading}\n`, `## ${heading}\n\n \n`);
      validateGeneratedDocument(stage, spaced, spec);
      const empty = spaced.replace(heading === "Revision summary" ? /Initial (proposal|plan)\./ : /None\./, "");
      assert.throws(() => validateGeneratedDocument(stage, empty, spec), /Missing or empty section/);
    }
  }
  assert.throws(() => validateGeneratedDocument("spec", `\`\`\`md\n${spec}\`\`\``), /must start/);
  assert.throws(() => validateGeneratedDocument("spec", spec.replace("## Open questions", "## Questions")), /Open questions/);
  assert.throws(() => validateGeneratedDocument("plan", plan.replace("AC-1", "AC-9").replace("Acceptance: AC-1", "Acceptance: AC-9"), spec), /unknown AC/);
  assert.throws(() => validateGeneratedDocument("spec", spec + "x".repeat(40000)), /40 KB/);
});

test("Human decisions are revision-bound, deduplicated and support configured approval thresholds", () => {
  const state = pureSpec();
  const approve = parseDocumentCommand("/sdlc approve spec v1");
  assert.throws(() => approveDocument(state, { ...approve, version: 2 }, command(""), config), /Stale/);
  assert.throws(() => approveDocument(state, approve, { ...command(""), user: { ...human, type: "Bot" } }, config), /Human/);
  assert.throws(() => approveDocument(state, approve, { ...command(""), user: { ...human, login: "outsider" } }, config), /Human/);
  approveDocument(state, approve, command("/sdlc approve spec v1"), config);
  approveDocument(state, approve, command("/sdlc approve spec v1", 101), config);
  assert.equal(state.documents.spec.approvals.length, 1);
  assert.equal(hasDocumentApproval(state.documents.spec, config.stages.spec), true);
  assert.equal(state.documents.spec.approvals[0].commentBody, "/sdlc approve spec v1");
  const multi = structuredClone(config);
  multi.stages.spec.minimumApprovals = 2;
  multi.stages.spec.reviewers.teams = ["approvers"];
  const second = initialDocumentState(parent, baseline);
  requestDocumentRevision(second, "spec", "Initial", multi);
  publishDocumentRevision(second, spec, null, multi);
  approveDocument(second, approve, command(""), multi);
  assert.equal(hasDocumentApproval(second.documents.spec, multi.stages.spec), false);
  approveDocument(second, approve, { ...command("", 102), user: { id: 456, login: "teammate", type: "User" } }, multi, ["teammate"]);
  assert.equal(hasDocumentApproval(second.documents.spec, multi.stages.spec), true);
});

test("Spec revisions invalidate approvals and Plan without reusing version numbers; handoff freezes documents", () => {
  const state = sealedState();
  validateDocumentHandoff(state, { spec, plan }, config);
  assert.throws(() => requestDocumentRevision(state, "spec", "Change it", config), /frozen/);
  state.sealed = false;
  requestDocumentRevision(state, "spec", "Revise", config);
  assert.equal(state.documents.spec.approvals.length, 0);
  assert.equal(state.documents.plan, null);
  assert.equal(state.counters.plan, 1);
  assert.throws(() => approveDocument(state, parseDocumentCommand("/sdlc approve spec v1"), command(""), config), /pending/);
  publishDocumentRevision(state, spec, null, config);
  assert.equal(state.documents.spec.version, 2);
  assert.throws(() => requestDocumentRevision(state, "plan", "Draft", config), /Approve/);
  approveDocument(state, parseDocumentCommand("/sdlc approve spec v2"), command(""), config);
  requestDocumentRevision(state, "plan", "New plan", config);
  assert.equal(state.pending.version, 2);
  assert.equal(state.pending.specHash, contentHash(spec));
});

test("policy changes and altered content cannot inherit previous document approvals", () => {
  const state = sealedState();
  const changed = structuredClone(config);
  changed.stages.spec.reviewers.users = ["someone-else"];
  assert.throws(() => validateDocumentHandoff(state, { spec, plan }, changed), /Missing approval/);
  assert.throws(() => validateDocumentHandoff(state, { spec: spec + "changed", plan }, config), /changed approved spec/);
  state.documents.plan.specHash = contentHash("different");
  assert.throws(() => validateDocumentHandoff(state, { spec, plan }, config), /different Spec/);
});

test("new Intent goes from rendered Spec through Plan approval to ONLY the Tests assignment", async () => {
  const mock = repository();
  let snapshot = await mock.draft();
  assert.equal(mock.refs.has(lifecycleBranch(42)), false);
  assert.ok(mock.comments.some((comment) => comment.body.includes("# Specification")));
  assert.equal(mock.state.assignments.length, 0);
  mock.add("Looks good, continue!");
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending, null);
  assert.equal(snapshot.state.documents.plan, null);
  mock.add("/sdlc approve spec v1");
  snapshot = await mock.draft("plan");
  assert.equal(mock.refs.has(lifecycleBranch(42)), false);
  assert.ok(mock.comments.some((comment) => comment.body.includes("# Implementation plan")));
  mock.add("/sdlc approve plan v1");
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.sealed, true);
  assert.equal(mock.refs.get(lifecycleBranch(42)), snapshot.sha);
  assert.deepEqual(mock.issues.slice(1).map((issue) => issue.state), ["closed", "closed", "open", "open"]);
  assert.ok(mock.issues.slice(1).every((issue) => issue.body.includes(documentMode)));
  assert.equal(mock.state.assignments.length, 1);
  assert.equal(mock.state.assignments[0].assignableId, "ISSUE_45");
  assert.equal(mock.state.assignments[0].baseRef, lifecycleBranch(42));
  await mock.review.process(42);
  assert.equal(mock.state.assignments.length, 1);
  await mock.review.verifyPullRequest(42, "tests", { head: { sha: snapshot.sha } });
  await assert.rejects(() => mock.review.verifyPullRequest(42, "spec", { head: { sha: snapshot.sha } }), /not through PRs/);
  assert.ok(!mock.calls.some((call) => call.path === "/pulls" || call.body?.force === true));
});

test("queued revision and stale approval are both handled across runs, not lost with workflow coalescing", async () => {
  const mock = repository();
  await mock.draft();
  mock.add("/sdlc revise spec\nKeep unassigned tickets.");
  const stale = mock.add("/sdlc approve spec v1");
  let snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.pending.version, 2);
  snapshot = await mock.review.publish(42, snapshot.sha, spec.replace("Initial proposal.", "Preserve unassigned tickets."));
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.documents.spec.version, 2);
  assert.equal(snapshot.state.documents.spec.approvals.length, 0);
  assert.ok(mock.comments.some((item) => item.body.includes(`Command #${stale.id} rejected: Stale`)));
  assert.equal(mock.comments.filter((item) => item.body.startsWith("<!-- sdlc-document:spec:")).length, 2);
});

test("unauthorized, edited, bot and malformed commands cannot approve documents", async () => {
  const mock = repository();
  await mock.draft();
  mock.add("/sdlc approve spec v1", { user: { id: 9, login: "outsider", type: "User" } });
  mock.add("/sdlc approve spec v1", { updated_at: "2026-09-27T00:00:00Z" });
  mock.add("/sdlc approve spec v1", { user: { id: 9, login: "github-actions[bot]", type: "Bot" } });
  mock.add("/sdlc approve spec");
  const snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.documents.spec.approvals.length, 0);
  assert.equal(snapshot.state.documents.plan, null);
  assert.equal(snapshot.state.receipts.filter((item) => item.message.includes("rejected")).length, 3);
});

test("an approval queued before AI publishes a revision cannot preapprove unseen content", async () => {
  const mock = repository();
  const pending = await mock.review.process(42);
  mock.add("/sdlc approve spec v1");
  await mock.review.publish(42, pending.sha, spec);
  const snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.documents.spec.approvals.length, 0);
  assert.match(snapshot.state.receipts[0].message, /predates publication/);
  mock.add("/sdlc approve spec v1");
  assert.equal((await mock.review.process(42)).state.pending.stage, "plan");
});

test("document source commits need trusted audit receipts, not editable Git approval JSON", async () => {
  const mock = repository();
  const snapshot = await mock.draft();
  const state = structuredClone(snapshot.state);
  state.lastCommentId = 99999;
  const treeId = sha("tampered-review-tree");
  const commitId = sha("tampered-review-commit");
  mock.trees.set(treeId, { ...mock.treeAt(snapshot.sha), [documentStatePath(42)]: JSON.stringify(state) });
  mock.commits.set(commitId, { tree: { sha: treeId }, parents: [snapshot.sha] });
  mock.refs.set(documentBranch(42), commitId);
  mock.add(`<!-- brownfield-human-gated-delivery-document-ledger -->\n${commitId} ${contentHash(JSON.stringify(state))}`);
  await assert.rejects(() => mock.review.load(42), /trusted workflow audit entry/);
});

test("a failed audit receipt leaves the authoritative branch unchanged and retryable", async () => {
  const mock = repository();
  const snapshot = await mock.review.process(42);
  mock.state.fail = (call) => call.method === "PATCH" && call.body?.body?.includes("document-ledger");
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, spec), /503/);
  assert.equal(mock.refs.get(documentBranch(42)), snapshot.sha);
  mock.state.fail = null;
  const published = await mock.review.publish(42, snapshot.sha, spec);
  assert.equal(published.state.documents.spec.version, 1);
});

test("a Human edit of a bot-authored ledger cannot forge workflow approval evidence", async () => {
  const mock = repository();
  await mock.draft();
  const ledger = mock.comments.find((item) => item.body.startsWith("<!-- brownfield-human-gated-delivery-document-ledger"));
  ledger.lastEditedAt = "2026-09-26T01:00:00Z";
  ledger.editor = { __typename: "User", login: human.login };
  await assert.rejects(() => mock.review.load(42), /edited outside trusted workflow/);
});

test("Git update races fail closed without forcing a document ref or losing the new head", async () => {
  const mock = repository();
  const snapshot = await mock.review.process(42);
  const other = sha("concurrent-head");
  mock.commits.set(other, { tree: mock.commits.get(snapshot.sha).tree, parents: [snapshot.sha] });
  mock.state.onCall = (call) => {
    if (call.path === `/git/refs/heads/${documentBranch(42)}` && call.method === "PATCH") {
      mock.refs.set(documentBranch(42), other);
    }
  };
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, spec), /422/);
  assert.equal(mock.refs.get(documentBranch(42)), other);
  assert.ok(!mock.calls.some((call) => call.body?.force === true));
});

test("generation prompt carries Human discussion and previous content but rejects silent truncation", async () => {
  const mock = repository();
  let snapshot = await mock.review.process(42);
  const prompt = await mock.review.prompt(snapshot);
  assert.match(prompt, /Human Intent #42/);
  assert.match(prompt, /Clarify ticket ownership/);
  await mock.review.publish(42, snapshot.sha, spec);
  mock.add("/sdlc revise spec\nPreserve unassigned tickets.");
  snapshot = await mock.review.process(42);
  const revisionPrompt = await mock.review.prompt(snapshot);
  assert.match(revisionPrompt, /previousDocument/);
  assert.match(revisionPrompt, /Preserve unassigned tickets/);
  mock.add("x".repeat(100001));
  await assert.rejects(() => mock.review.prompt(snapshot), /exceeds 100 KB/);
});

test("failed generation and publication can be retried without duplicate revisions or assignments", async () => {
  const mock = repository();
  let snapshot = await mock.review.process(42);
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, "broken output"), /must start/);
  assert.equal((await mock.review.load(42)).state.pending.version, 1);
  snapshot = await mock.review.process(42);
  mock.state.fail = (call) => call.path === "/issues/42/comments" && call.method === "POST";
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, spec), /503/);
  mock.state.fail = null;
  snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.documents.spec.version, 1);
  assert.equal(snapshot.state.pending, null);
  await mock.review.process(42);
  assert.equal(mock.comments.filter((item) => item.body.startsWith("<!-- sdlc-document:spec:")).length, 1);
  assert.equal(mock.state.assignments.length, 0);
});

test("changed branches or Intents reject stale generation instead of overwriting work", async () => {
  const mock = repository();
  const first = await mock.review.process(42);
  mock.add("/sdlc revise spec\nA newer request.");
  const second = await mock.review.process(42);
  assert.notEqual(second.sha, first.sha);
  await assert.rejects(() => mock.review.publish(42, first.sha, spec), /Stale generation/);
  mock.issues[0].body += " changed";
  await assert.rejects(() => mock.review.publish(42, second.sha, spec), /original Intent changed/);
  mock.issues[0].state = "closed";
  await assert.rejects(() => mock.review.process(42), /open, authorized/);
});

test("approved Spec revisions remove the draft Plan and require new approvals for both", async () => {
  const mock = repository();
  await mock.draft();
  mock.add("/sdlc approve spec v1");
  await mock.draft("plan");
  mock.add("/sdlc revise spec\nChange the accepted behavior.");
  let snapshot = await mock.review.process(42);
  assert.equal(snapshot.state.documents.plan, null);
  assert.equal(mock.treeAt(snapshot.sha)[artifactPaths(42).plan], undefined);
  snapshot = await mock.review.publish(42, snapshot.sha, spec);
  mock.add("/sdlc approve spec v2");
  snapshot = await mock.draft("plan");
  assert.equal(snapshot.state.documents.plan.version, 2);
  assert.equal(mock.state.assignments.length, 0);
});

test("handoff retries survive an assignment failure and prohibit application changes in the document branch", async () => {
  const mock = repository();
  await mock.draft();
  mock.add("/sdlc approve spec v1");
  await mock.draft("plan");
  mock.add("/sdlc approve plan v1");
  mock.state.fail = (call) => call.path === "/graphql" && call.body?.query.includes("AssignCopilot");
  await assert.rejects(() => mock.review.process(42), /503/);
  assert.equal((await mock.review.load(42)).state.sealed, true);
  assert.equal(mock.state.assignments.length, 0);
  mock.state.fail = null;
  await mock.review.process(42);
  assert.equal(mock.state.assignments.length, 1);
  const snapshot = await mock.review.load(42);
  mock.treeAt(snapshot.sha)["demos/it-service-desk/src/evil.ts"] = "not a document";
  await assert.rejects(() => mock.review.handoff(mock.issues[0], snapshot, mock.issues.slice(1)), /only the Spec, Plan/);
});

test("engineering PRs must retain exact approved document and evidence blobs", async () => {
  const mock = repository();
  await mock.draft();
  mock.add("/sdlc approve spec v1");
  await mock.draft("plan");
  mock.add("/sdlc approve plan v1");
  const snapshot = await mock.review.process(42);
  const changedTree = sha("changed-tree");
  const changedHead = sha("changed-head");
  for (const path of [artifactPaths(42).spec, artifactPaths(42).plan, documentStatePath(42)]) {
    mock.trees.set(changedTree, { ...mock.treeAt(snapshot.sha), [path]: "changed" });
    mock.commits.set(changedHead, { tree: { sha: changedTree }, parents: [snapshot.sha] });
    await assert.rejects(() => mock.review.verifyPullRequest(42, "implementation", { head: { sha: changedHead } }), /changed an approved/);
  }
  assert.throws(() => validateStageFiles("implementation", ["demos/it-service-desk/src/a.ts", documentStatePath(42)], 42, "demos/it-service-desk"), /out-of-scope/);
  assert.equal(validateStageFiles("implementation", ["demos/it-service-desk/src/a.ts", documentStatePath(42)], 42, "demos/it-service-desk", true).length, 2);
});

test("legacy lifecycles are not migrated and spoofed bot markers cannot replace Human discussion", async () => {
  const mock = repository();
  mock.refs.set(lifecycleBranch(42), baseline);
  await assert.rejects(() => mock.review.process(42), /legacy document PRs/);
  assert.equal(mock.refs.has(documentBranch(42)), false);
  mock.refs.delete(lifecycleBranch(42));
  const spoofed = mock.add("<!-- brownfield-human-gated-delivery-progress -->\nHuman text");
  await mock.draft();
  assert.equal(spoofed.body, "<!-- brownfield-human-gated-delivery-progress -->\nHuman text");
});

test("kickoff dispatches Issue review for new and resumed document runs but preserves legacy PR assignment", async () => {
  const saved = { ...process.env };
  const directory = mkdtempSync(join(tmpdir(), "sdlc-document-routing-"));
  try {
    process.env.GITHUB_TOKEN = "test-workflow";
    process.env.COPILOT_ASSIGN_TOKEN = "test-assignment";
    process.env.GITHUB_REPOSITORY = "example/repo";
    process.env.GITHUB_EVENT_PATH = join(directory, "event.json");
    delete process.env.INTENT_ISSUE_NUMBER;
    writeFileSync(process.env.GITHUB_EVENT_PATH, JSON.stringify({ issue: parent }));
    const fresh = repository();
    await routeDocumentKickoff();
    assert.equal(fresh.state.dispatches, 1);
    assert.equal(fresh.refs.has(lifecycleBranch(42)), false);
    await fresh.draft();
    await routeDocumentKickoff();
    assert.equal(fresh.state.dispatches, 3);
    assert.equal(fresh.state.assignments.length, 0);
    const legacy = repository();
    legacy.refs.set(lifecycleBranch(42), baseline);
    await routeDocumentKickoff();
    assert.equal(legacy.state.dispatches, 0);
    assert.equal(legacy.state.assignments[0].assignableId, "ISSUE_43");
    assert.ok(legacy.issues.slice(1).every((issue) => !issue.body.includes(documentMode)));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(directory, { recursive: true });
  }
});

test("workflow isolates read-only AI generation from trusted publication and routes new Intents", () => {
  const workflow = readFileSync(new URL("../../workflows/brownfield-human-gated-delivery-documents.yml", import.meta.url), "utf8");
  const generation = workflow.split("\n  generate:\n")[1].split("\n  publish:\n")[0];
  assert.match(generation, /contents: read/);
  assert.match(generation, /copilot-requests: write/);
  assert.match(generation, /persist-credentials: false/);
  assert.match(generation, /--available-tools='view,glob,rg'/);
  assert.match(generation, /--deny-tool=write --deny-tool=shell/);
  assert.doesNotMatch(generation, /COPILOT_ASSIGN_TOKEN|issues: write|contents: write|actions: write/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /ref: \$\{\{ needs.prepare.outputs.trusted-sha \}\}/);
  assert.match(workflow, /DOCUMENT_REQUEST_SHA:/);
  assert.match(workflow, /documents\.mjs failure/);
  const kickoff = readFileSync(new URL("../../workflows/brownfield-human-gated-delivery-kickoff.yml", import.meta.url), "utf8");
  assert.match(kickoff, /actions: write/);
  assert.match(kickoff, /github\.mjs route-kickoff/);
});

const digest = `sha256:${"a".repeat(64)}`;
const evidence = {
  runId: "12345", runAttempt: 1, image: "ghcr.io/example/repo-it-service-desk",
  digest, mergeSha: baseline, pullNumber: 50,
  runUrl: "https://github.com/example/repo/actions/runs/12345", verified: true,
};
const acceptancePolicy = config.stages.implementation;
const control = (mock) => new RunControl(mock.review);

test("explicit development-test mode is durable and cannot become a live rehearsal after an Issue edit", async () => {
  const mock = repository();
  mock.issues[0].body += "\nDelivery Execution: development-test\n";
  const run = control(mock);
  const initial = await run.ensure(42, baseline);
  assert.equal(initial.state.mode, "development-test");
  assert.match(await run.summary(42), /AUTOMATED DEVELOPMENT TEST/);
  mock.issues[0].body = parent.body;
  assert.equal((await run.ensure(42, baseline)).state.mode, "development-test");
});

test("run command grammar requires digest and observed acceptance results", () => {
  for (const action of ["help", "status", "pause", "resume", "cancel"]) {
    assert.deepEqual(parseRunCommand(`/sdlc ${action}`), { action });
  }
  assert.equal(parseRunCommand("/sdlc approve spec v1"), null);
  assert.deepEqual(parseRunCommand(`/sdlc accept ${digest}\nAC-1 passed`), { action: "accept", digest, notes: "AC-1 passed" });
  for (const invalid of ["/sdlc accept", `/sdlc accept ${digest}`, "/sdlc accept latest\nOK", "/sdlc pause now"]) {
    assert.throws(() => parseRunCommand(invalid), /Use \/sdlc/);
  }
});

test("verification alone never accepts; exact artifact, policy and distinct Human quorum are required", () => {
  const state = newRun(42, "example/repo", baseline);
  const policy = { ...acceptancePolicy, minimumApprovals: 2 };
  recordDelivery(state, evidence, policy);
  assert.equal(state.status, "active");
  const text = `/sdlc accept ${digest}\nAC-1 passed in isolated container`;
  const accept = parseRunCommand(text);
  assert.throws(() => applyRunCommand(state, { ...accept, digest: `sha256:${"b".repeat(64)}` }, command(text), policy), /latest/);
  assert.throws(() => applyRunCommand(state, accept, command(text), acceptancePolicy), /policy changed/);
  assert.throws(() => applyRunCommand(state, accept, { ...command(text), user: { ...human, type: "Bot" } }, policy), /Human/);
  applyRunCommand(state, accept, command(text), policy);
  applyRunCommand(state, accept, command(text, 101), policy);
  assert.equal(state.delivery.acceptances.length, 1);
  assert.equal(state.status, "active");
  applyRunCommand(state, accept, { ...command(text, 102), user: { id: 234, login: "teammate", type: "User" } }, policy, ["teammate"]);
  assert.equal(state.status, "accepted");
  validateRun(state, 42);
  assert.equal(state.delivery.acceptances[0].commentBody, text);
});

test("delivery retries preserve decisions on duplicates, reject conflicts, ignore old attempts and invalidate on new verification", () => {
  const state = newRun(42, "example/repo", baseline);
  recordDelivery(state, evidence, acceptancePolicy);
  const text = `/sdlc reject ${digest}\nAC-1 failed`;
  applyRunCommand(state, parseRunCommand(text), command(text), acceptancePolicy);
  assert.throws(() => applyRunCommand(state, parseRunCommand(`/sdlc accept ${digest}\npassed`), command(""), acceptancePolicy), /rejected/);
  assert.equal(recordDelivery(state, evidence, acceptancePolicy), false);
  assert.equal(state.delivery.rejection.notes, "AC-1 failed");
  assert.throws(() => recordDelivery(state, { ...evidence, verified: false }, acceptancePolicy), /Conflicting/);
  assert.equal(recordDelivery(state, { ...evidence, runAttempt: 2 }, acceptancePolicy), true);
  assert.equal(state.delivery.rejection, null);
  assert.equal(recordDelivery(state, evidence, acceptancePolicy), false);
  assert.equal(state.delivery.runAttempt, 2);
});

test("paused and cancelled runs cannot accept, resume is explicit and cancellation terminal", () => {
  const state = newRun(42, "example/repo", baseline);
  recordDelivery(state, evidence, acceptancePolicy);
  const apply = (text) => applyRunCommand(state, parseRunCommand(text), command(text), acceptancePolicy);
  apply("/sdlc pause");
  assert.throws(() => apply(`/sdlc accept ${digest}\npassed`), /Resume/);
  apply("/sdlc resume");
  assert.equal(state.status, "active");
  apply("/sdlc cancel");
  assert.throws(() => apply("/sdlc resume"), /cancelled/);
  apply("/sdlc status");
  assert.equal(state.status, "cancelled");
});

test("run state rejects malformed or unbound delivery evidence", () => {
  const state = newRun(42, "example/repo", baseline);
  recordDelivery(state, evidence, acceptancePolicy);
  for (const patch of [{ digest: "latest" }, { image: "ghcr.io/other/repo" }, { runAttempt: 0 }, { pullNumber: -1 }, { runUrl: "https://other.invalid/run" }]) {
    assert.throws(() => validateRun({ ...state, delivery: { ...state.delivery, ...patch } }, 42), /Invalid/);
  }
  assert.throws(() => validateRun({ ...state, status: "accepted" }, 42), /Human acceptance/);
});

async function engineering(mock) {
  await control(mock).ensure(42, baseline);
  await mock.draft();
  mock.add("/sdlc approve spec v1");
  await mock.draft("plan");
  mock.add("/sdlc approve plan v1");
  const snapshot = await mock.review.process(42);
  mock.issues[3].state = "closed";
  const pr = {
    number: 50, node_id: "PR_50", state: "closed", merged: true, merge_commit_sha: snapshot.sha,
    timeline: [{ event: "merged", commit_id: snapshot.sha }],
    body: mock.issues[4].body, user: { login: "Copilot", type: "Bot" },
    head: { sha: snapshot.sha, repo: { full_name: "example/repo" } }, base: { ref: "main" },
    html_url: "https://github.com/example/repo/pull/50",
  };
  mock.state.pulls.push(pr);
  return { snapshot, pr, verified: { ...evidence, mergeSha: snapshot.sha } };
}

test("actual delivery adapter retains Intent and lifecycle until Human acceptance and freezes document Git blobs", async () => {
  const mock = repository();
  const { snapshot, pr, verified } = await engineering(mock);
  const saved = { ...process.env };
  const directory = mkdtempSync(join(tmpdir(), "sdlc-acceptance-"));
  try {
    Object.assign(process.env, {
      GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "example/repo",
      GITHUB_EVENT_PATH: join(directory, "event.json"), GITHUB_RUN_ID: verified.runId,
      GITHUB_RUN_ATTEMPT: "1", IMAGE: verified.image, DIGEST: verified.digest,
      RUN_URL: verified.runUrl, DELIVERY_SUCCESS: "true",
    });
    writeFileSync(process.env.GITHUB_EVENT_PATH, JSON.stringify({ pull_request: pr }));
    await delivery();
    assert.equal(mock.issues[0].state, "open");
    assert.ok(mock.refs.has(lifecycleBranch(42)));
    assert.equal(mock.refs.get(documentBranch(42)), snapshot.sha);
    assert.equal((await control(mock).loadRun(42)).state.status, "active");
    mock.add(`/sdlc accept ${digest}\nAC-1 persisted after refresh; unassigned ticket preserved.`);
    await control(mock).processControls(42, baseline);
    assert.equal(mock.issues[0].state, "closed");
    assert.equal(mock.issues[4].state, "closed");
    assert.equal(mock.refs.has(lifecycleBranch(42)), false);
    assert.equal(mock.refs.get(documentBranch(42)), snapshot.sha);
    assert.ok(mock.refs.has(runBranch(42)));
    await delivery();
    assert.equal((await control(mock).loadRun(42)).state.delivery.acceptances.length, 1);
    assert.equal(mock.issues[0].state, "closed");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(directory, { recursive: true });
  }
});

test("acceptance rejects unpublished, edited, stale, unauthorized and spoofed receipt commands", async () => {
  const mock = repository();
  const run = control(mock);
  const { verified } = await engineering(mock);
  mock.add(`/sdlc accept ${digest}\nPreapproved`);
  await run.verification(42, baseline, verified);
  mock.add(`/sdlc accept ${digest}\nEdited`, { updated_at: "2026-09-27T00:00:00Z" });
  mock.add(`/sdlc accept ${digest}\nUnauthorized`, { user: { id: 999, login: "outsider", type: "User" } });
  mock.add(`/sdlc accept sha256:${"b".repeat(64)}\nStale`);
  await run.processControls(42, baseline);
  assert.equal((await run.loadRun(42)).state.delivery.acceptances.length, 0);
  assert.equal(mock.issues[0].state, "open");
  const receipt = mock.comments.find((entry) => entry.body.startsWith("<!-- sdlc-verification:"));
  receipt.lastEditedAt = "2026-09-27T00:00:00Z";
  receipt.editor = { __typename: "User", login: human.login };
  mock.add(`/sdlc accept ${digest}\nSpoofed receipt`);
  await run.processControls(42, baseline);
  assert.equal((await run.loadRun(42)).state.status, "active");
  assert.match(mock.comments.at(-1).body, /trusted workflow|Run: Active|Awaiting Human acceptance/);
});

test("acceptance cleanup recovers after API failure without requiring or duplicating approval", async () => {
  const mock = repository();
  const run = control(mock);
  const { verified } = await engineering(mock);
  await run.verification(42, baseline, verified);
  mock.add(`/sdlc accept ${digest}\nAC-1 passed`);
  mock.state.fail = (call) => call.method === "DELETE";
  await assert.rejects(() => run.processControls(42, baseline), /503/);
  assert.equal((await run.loadRun(42)).state.status, "accepted");
  assert.ok(mock.refs.has(lifecycleBranch(42)));
  mock.state.fail = null;
  await run.processControls(42, baseline);
  assert.equal(mock.refs.has(lifecycleBranch(42)), false);
  assert.equal((await run.loadRun(42)).state.delivery.acceptances.length, 1);
});

test("acceptance needs one matching merge event even when the REST PR omits merge_commit_sha", async () => {
  for (const mismatch of [
    () => [],
    () => [{ event: "merged", commit_id: baseline }],
    (merge) => [{ event: "merged", commit_id: merge }, { event: "merged", commit_id: merge }],
  ]) {
    const mock = repository();
    const run = control(mock);
    const { pr, verified } = await engineering(mock);
    await run.verification(42, baseline, verified);
    mock.add(`/sdlc accept ${digest}\nAC-1 passed`);
    pr.timeline = mismatch(verified.mergeSha);
    await assert.rejects(() => run.processControls(42, baseline), /merged timeline event/);
    assert.equal(mock.issues[0].state, "open");
    assert.ok(mock.refs.has(lifecycleBranch(42)));
    pr.timeline = [{ event: "merged", commit_id: verified.mergeSha }];
    await run.processControls(42, baseline);
    assert.equal(mock.issues[0].state, "closed");
    assert.equal((await run.loadRun(42)).state.delivery.acceptances.length, 1);
  }
});

test("pause gates document publication, revokes automerge and retry repairs a failed status write", async () => {
  const mock = repository();
  const run = control(mock);
  const snapshot = await mock.review.process(42);
  await run.ensure(42, baseline);
  mock.state.pulls.push({ state: "open", node_id: "PR_51", auto_merge: {}, body: "Delivery Intent: #42\n",
    base: { ref: lifecycleBranch(42) }, head: { sha: baseline } });
  mock.add("/sdlc pause");
  mock.state.fail = (call) => call.path.startsWith("/statuses/");
  await assert.rejects(() => run.processControls(42, baseline), /503/);
  assert.equal((await run.loadRun(42)).state.status, "paused");
  mock.state.fail = null;
  await run.processControls(42, baseline);
  assert.equal(mock.state.pulls[0].auto_merge, null);
  await assert.rejects(() => mock.review.publish(42, snapshot.sha, spec), /paused/);
  mock.add("/sdlc resume");
  await run.processControls(42, baseline);
  await mock.review.publish(42, snapshot.sha, spec);
  assert.equal((await mock.review.load(42)).state.documents.spec.version, 1);
});

test("run state tampering and missing attested branches cannot silently reset approval history", async () => {
  const mock = repository();
  const run = control(mock);
  const snapshot = await run.ensure(42, baseline);
  const tree = mock.treeAt(snapshot.sha);
  const original = tree[runStatePath(42)];
  tree[runStatePath(42)] = original.replace('"active"', '"accepted"');
  await assert.rejects(() => run.loadRun(42), /audit entry/);
  tree[runStatePath(42)] = original;
  mock.refs.delete(runBranch(42));
  await assert.rejects(() => run.ensure(42, baseline), /missing.*audit ledger/);
});

test("delivery failure and later verification are explicit, preserve branch and invalidate earlier acceptance", async () => {
  const mock = repository();
  const run = control(mock);
  const { verified } = await engineering(mock);
  await run.verification(42, baseline, { ...verified, verified: false, image: "", digest: "" });
  assert.equal((await run.loadRun(42)).state.failure.stage, "delivery");
  assert.equal(mock.issues[0].state, "open");
  assert.ok(mock.refs.has(lifecycleBranch(42)));
  await run.verification(42, baseline, { ...verified, runAttempt: 2 });
  assert.equal((await run.loadRun(42)).state.failure, null);
  assert.equal(mock.issues[0].state, "open");
  mock.add(`/sdlc reject ${digest}\nWrong persisted value`);
  await run.processControls(42, baseline);
  mock.add(`/sdlc accept ${digest}\nCannot override rejection`);
  await run.processControls(42, baseline);
  assert.equal((await run.loadRun(42)).state.status, "active");
  await run.verification(42, baseline, { ...verified, runAttempt: 3 });
  mock.add(`/sdlc accept ${digest}\nRetested original scenarios successfully`);
  await run.processControls(42, baseline);
  assert.equal(mock.issues[0].state, "closed");
});

test("real Publish verification and Advance adapters reject paused Issue-based runs before starting work", async () => {
  const mock = repository();
  const { pr } = await engineering(mock);
  mock.add("/sdlc pause");
  await control(mock).processControls(42, baseline);
  const saved = { ...process.env };
  const directory = mkdtempSync(join(tmpdir(), "sdlc-paused-adapters-"));
  try {
    Object.assign(process.env, {
      GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "example/repo",
      GITHUB_EVENT_PATH: join(directory, "event.json"), GITHUB_OUTPUT: join(directory, "output"),
      DELIVERY_RETRY: "true",
    });
    writeFileSync(process.env.GITHUB_EVENT_PATH, JSON.stringify({ pull_request: pr }));
    await assert.rejects(() => verify(), /run is paused/);
    await assert.rejects(() => advance(), /run is paused/);
    assert.equal(mock.issues[4].state, "open");
    assert.equal(mock.issues[0].state, "open");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(directory, { recursive: true });
  }
});

test("verification API failure does not consume a valid Human command as a rejection", async () => {
  const mock = repository();
  const { verified } = await engineering(mock);
  const run = control(mock);
  await run.verification(42, baseline, verified);
  const accepted = mock.add(`/sdlc accept ${digest}\nAC-1 passed`);
  mock.state.fail = (call) => call.path === "/graphql" && call.body.query.includes("VerificationReceipt");
  await assert.rejects(() => run.processControls(42, baseline), /503/);
  assert.ok((await run.loadRun(42)).state.lastCommentId < accepted.id);
  mock.state.fail = null;
  await run.processControls(42, baseline);
  assert.equal((await run.loadRun(42)).state.status, "accepted");
});
