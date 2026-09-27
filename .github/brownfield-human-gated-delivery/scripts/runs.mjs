import { lifecycleBranch, parsePullRequestMetadata } from "./core.mjs";
import { DocumentReview } from "./documents.mjs";
import { graphql, resolveTeamMembers, policyStatus } from "./github.mjs";
import { isWorkflowComment, ReviewStateStore } from "./state-store.mjs";
import {
  applyRunCommand, newRun, parseRunCommand, recordDelivery, runBranch,
  runPresentation, runStatePath, validateRun,
} from "./run-core.mjs";

const ledgerMarker = "<!-- brownfield-human-gated-delivery-run-ledger -->";
const controlMarker = "<!-- brownfield-human-gated-delivery-run-control -->";
const verificationMarker = (delivery) => `<!-- sdlc-verification:${delivery.runId}:${delivery.runAttempt} -->`;
const help = [
  "### Run commands",
  "- `/sdlc status` or `/sdlc help`: show the current state and instructions.",
  "- `/sdlc pause` / `/sdlc resume`: stop or restore new work. Already-running agents are not terminated and completed merges cannot be undone.",
  "- `/sdlc cancel`: permanently stop this run. Evidence, branches, Issues and PRs are retained; no automatic destructive cleanup.",
  "- `/sdlc retry`: retry document generation/handoff. For failed engineering CI use the linked PR; for Advance/Publish rerun the failed Actions run after fixing its cause.",
  "- `/sdlc accept sha256:<digest>` plus observed results on a new line: configured Human business acceptance.",
  "- `/sdlc reject sha256:<digest>` plus failures on a new line: keep the Intent open for remediation.",
  "",
  "Acceptance uses the implementation-stage reviewer policy. It does not replace Spec, Plan, Tests or implementation approval.",
  "A rejection requires a new verification attempt. Scope/code fixes after merge use a linked new Intent, not edits to sealed approvals.",
].join("\n");

export class RunControl extends DocumentReview {
  constructor(options) {
    super(options);
    this.runStore = new ReviewStateStore(this, {
      branch: runBranch, path: runStatePath, marker: ledgerMarker, validate: validateRun,
    });
  }

  async loadRun(intent) {
    const snapshot = await this.runStore.load(intent);
    if (snapshot && snapshot.state.repository !== `${this.owner}/${this.repo}`) {
      throw new Error("Run state belongs to a different repository.");
    }
    return snapshot;
  }

  async ensure(intent, baseline) {
    const existing = await this.loadRun(intent);
    if (existing) return existing;
    const issue = await this.request(`/issues/${intent}`);
    const mode = /^Delivery Execution: development-test\s*$/m.test(issue.body ?? "") ? "development-test" : "live";
    return this.runStore.save(null, newRun(intent, `${this.owner}/${this.repo}`, baseline, mode));
  }

  async assertActive(intent) {
    const run = await this.loadRun(intent);
    if (run && run.state.status !== "active") throw new Error(`Delivery run is ${run.state.status}; new work is blocked.`);
    return run;
  }

  async failure(intent, failure) {
    const snapshot = await this.loadRun(intent);
    if (!snapshot || ["accepted", "cancelled"].includes(snapshot.state.status)) return;
    const state = structuredClone(snapshot.state);
    state.failure = failure;
    state.events.push({ type: failure ? "workflow-failed" : "workflow-recovered", at: new Date().toISOString(), ...(failure ?? {}) });
    await this.runStore.save(snapshot, state);
    await this.render(intent);
  }

  async summary(intent) {
    const run = await this.loadRun(intent);
    if (!run) return "";
    const { state, sha } = run;
    const presentation = runPresentation(state);
    const delivery = state.delivery;
    return [
      state.mode === "development-test" ? "**AUTOMATED DEVELOPMENT TEST: approvals are scripted with explicit account-owner authorization. This run never counts as genuine Human acceptance or Demo Ready.**" : "",
      `### Run: ${presentation.status}`, "", presentation.next, "",
      `Responsible Human reviewers: ${this.config.stages.implementation.reviewers.users.map((login) => `@${login}`).join(", ") || "configured team"}.`,
      `Evidence: [run record](https://github.com/${this.owner}/${this.repo}/blob/${sha}/${runStatePath(intent)})`,
      delivery ? `Implementation: [#${delivery.pullNumber}](https://github.com/${this.owner}/${this.repo}/pull/${delivery.pullNumber}) | merge \`${delivery.mergeSha}\` | [verification attempt ${delivery.runAttempt}](${delivery.runUrl})` : "",
      delivery?.verified ? `Image: \`${delivery.image}@${delivery.digest}\`\n\nHuman acceptance: ${delivery.acceptances.length}/${this.config.stages.implementation.minimumApprovals}. Use the demo toolkit to run this exact digest in an isolated local container. The Actions smoke container is not a hosted application.` : "",
      state.failure ? `Failure: ${state.failure.message} [Inspect run](${state.failure.runUrl}).` : "",
      "", "Commands: `/sdlc help`, `/sdlc status`, `/sdlc pause`, `/sdlc resume`, `/sdlc cancel`.",
    ].filter(Boolean).join("\n");
  }

  async render(intent) {
    await this.comment(intent, controlMarker, `${await this.summary(intent)}\n\n<details><summary>Help and recovery</summary>\n\n${help}\n</details>`);
  }

  async blockPullRequests(intent) {
    for (const pr of await this.list("/pulls?state=open")) {
      // Gate the entire SHA just as the coordinator does: peers sharing it may
      // never retain a successful policy after this run has been paused.
      if (!new RegExp(`^Delivery Intent:\\s*#${intent}\\s*$`, "im").test(pr.body ?? "") &&
          pr.base?.ref !== lifecycleBranch(intent)) continue;
      await this.request(`/statuses/${pr.head.sha}`, "POST", {
        state: "pending", context: policyStatus, description: "Run paused or cancelled; Human must resume before delivery",
      });
      if (pr.auto_merge) await graphql(this.copilotToken, `
        mutation DisableAutoMerge($pullRequestId: ID!) {
          disablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId}) { pullRequest { id } }
        }
      `, { pullRequestId: pr.node_id });
    }
  }

  async reconcilePolicy() {
    const repository = await this.request("");
    await this.request("/actions/workflows/brownfield-human-gated-delivery-pr-coordinator.yml/dispatches", "POST", {
      ref: repository.default_branch,
    });
  }

  async processControls(intent, baseline) {
    const issue = await this.request(`/issues/${intent}`);
    if (issue.pull_request || !issue.labels?.some((label) => (label.name ?? label) === "brownfield-human-gated-delivery:intent")) {
      throw new Error("Run controls require a delivery Intent Issue.");
    }
    let snapshot = await this.ensure(intent, baseline);
    const candidates = (await this.list(`/issues/${intent}/comments`))
      .filter((comment) => comment.user?.type === "User" && comment.id > snapshot.state.lastCommentId &&
        /^\/sdlc (?:help|status|pause|resume|cancel|accept|reject)\b/.test(comment.body ?? ""))
      .sort((a, b) => a.id - b.id);
    for (const candidate of candidates) {
      const comment = await this.request(`/issues/comments/${candidate.id}`);
      const writable = await this.writer(comment);
      let state = structuredClone(snapshot.state);
      let command;
      let error;
      const policy = this.config.stages.implementation;
      const members = /^\/sdlc (accept|reject)\b/.test(comment.body ?? "")
        ? await resolveTeamMembers(this.copilotToken, this.owner, policy.reviewers.teams) : [];
      let receipt;
      let published;
      if (writable && state.delivery && /^\/sdlc (accept|reject)\b/.test(comment.body ?? "")) {
        receipt = (await this.list(`/issues/${intent}/comments`))
          .find((entry) => isWorkflowComment(entry) && entry.body?.startsWith(verificationMarker(state.delivery)));
        if (receipt) {
          const result = await graphql(this.token, `
            query VerificationReceipt($id: ID!) {
              node(id: $id) {
                ... on IssueComment { body lastEditedAt author { __typename login } editor { __typename login } }
              }
            }
          `, { id: receipt.node_id });
          published = result.node;
        }
      }
      try {
        if (!writable) throw new Error("Commands require a Human with current repository write access.");
        if (comment.updated_at !== comment.created_at) throw new Error("Submit a new, unedited command.");
        command = parseRunCommand(comment.body);
        if (!command) throw new Error("Command was removed.");
        if (["accept", "reject"].includes(command.action)) {
          if (!receipt || comment.id <= receipt.id) throw new Error("Acceptance predates publication of this verification attempt.");
          const trusted = (actor) => actor?.__typename === "Bot" &&
            ["github-actions", "github-actions[bot]"].includes(actor.login);
          if (!trusted(published?.author) || (published.lastEditedAt && !trusted(published.editor)) ||
              !published.body?.startsWith(verificationMarker(state.delivery))) {
            throw new Error("Verification receipt was edited outside trusted workflow automation.");
          }
        }
        applyRunCommand(state, command, comment, policy, members);
      } catch (failure) {
        error = failure.message;
        state = structuredClone(snapshot.state);
      }
      const message = error ? `Command #${comment.id} rejected: ${error}` : `Command #${comment.id} recorded: ${command.action}.`;
      state.lastCommentId = comment.id;
      state.events.push({ type: "command-receipt", at: comment.created_at, commentId: comment.id, message });
      snapshot = await this.runStore.save(snapshot, state);
    }
    // Reconcile durable side effects on every retry, even when no new command
    // exists. A partially failed cleanup or status write is not lost.
    for (const event of snapshot.state.events.filter((entry) => entry.type === "command-receipt")) {
      await this.comment(intent, `<!-- sdlc-run-command:${event.commentId} -->`, event.message);
    }
    if (["paused", "cancelled"].includes(snapshot.state.status)) await this.blockPullRequests(intent);
    if (snapshot.state.status === "accepted") await this.complete(snapshot);
    await this.render(intent);
    if (snapshot.state.status === "active" && snapshot.state.events.some((event) => event.type === "resume")) await this.reconcilePolicy();
    return snapshot;
  }

  async complete(snapshot) {
    const { state } = snapshot;
    if (state.status !== "accepted" || !state.delivery?.verified || !state.delivery.acceptances.length) {
      throw new Error("Only a recorded Human acceptance may complete a delivery.");
    }
    const pr = await this.request(`/pulls/${state.delivery.pullNumber}`);
    const metadata = parsePullRequestMetadata(pr.body);
    if (!pr.merged || pr.merge_commit_sha !== state.delivery.mergeSha ||
        metadata.intentNumber !== state.intent || metadata.stage !== "implementation") {
      throw new Error("Accepted delivery no longer matches its merged implementation.");
    }
    for (const number of [metadata.stageIssueNumber, state.intent]) {
      const issue = await this.request(`/issues/${number}`);
      if (issue.state !== "closed") await this.request(`/issues/${number}`, "PATCH", { state: "closed", state_reason: "completed" });
    }
    const branch = lifecycleBranch(state.intent);
    if (await this.ref(branch)) {
      try {
        await this.request(`/git/refs/heads/${branch}`, "DELETE");
      } catch (error) {
        if (!/\((404|422)\)/.test(error.message) || await this.ref(branch)) throw error;
      }
    }
  }

  async verification(intent, baseline, evidence) {
    let snapshot = await this.ensure(intent, baseline);
    const state = structuredClone(snapshot.state);
    if (recordDelivery(state, evidence, this.config.stages.implementation)) snapshot = await this.runStore.save(snapshot, state);
    const delivery = snapshot.state.delivery;
    if (delivery.runId !== evidence.runId || delivery.runAttempt !== evidence.runAttempt) return snapshot;
    await this.comment(intent, verificationMarker(delivery), [
      `### Automated verification ${delivery.verified ? "passed - Human acceptance required" : "failed"}`,
      `Implementation merge: \`${delivery.mergeSha}\`. [Attempt ${delivery.runAttempt}](${delivery.runUrl}).`,
      delivery.verified ? `Image: \`${delivery.image}@${delivery.digest}\`.\n\nRun the artifact and submit \`/sdlc accept ${delivery.digest}\` or \`/sdlc reject ${delivery.digest}\` with observed results on a new line.` : "Fix the failure and rerun Publish. This is not a delivery acceptance.",
    ].join("\n\n"));
    if (snapshot.state.status === "accepted") await this.complete(snapshot);
    else if (snapshot.state.status !== "cancelled") {
      const issue = await this.request(`/issues/${intent}`);
      if (issue.state !== "open") await this.request(`/issues/${intent}`, "PATCH", { state: "open", state_reason: "reopened" });
    }
    await this.render(intent);
    return snapshot;
  }
}
