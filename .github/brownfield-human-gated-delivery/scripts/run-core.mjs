import { artifactPaths, lifecycleBranch } from "./core.mjs";
import { policyHash } from "./document-core.mjs";

export const runBranch = (intent) => lifecycleBranch(intent).replace("brownfield-delivery/", "brownfield-runs/");
export const runStatePath = (intent) => `${artifactPaths(intent).root}/run-state.json`;
export const digestPattern = /^sha256:[a-f0-9]{64}$/;
export const controlActions = ["help", "status", "pause", "resume", "cancel", "accept", "reject"];

export function parseRunCommand(body) {
  const text = String(body).trim();
  const simple = text.match(/^\/sdlc (help|status|pause|resume|cancel)$/);
  if (simple) return { action: simple[1] };
  const decision = text.match(/^\/sdlc (accept|reject) (sha256:[a-f0-9]{64})\r?\n+([\s\S]+)$/);
  if (decision?.[3].trim()) return { action: decision[1], digest: decision[2], notes: decision[3].trim() };
  if (/^\/sdlc (?:help|status|pause|resume|cancel|accept|reject)\b/.test(text)) {
    throw new Error("Use /sdlc help|status|pause|resume|cancel, or /sdlc accept|reject sha256:<digest> followed by your observed results on a new line.");
  }
  return null;
}

export function newRun(intent, repository, baseline, mode = "live") {
  return {
    version: 1, intent, repository, baseline, mode, status: "active",
    lastCommentId: 0, delivery: null, failure: null, events: [],
  };
}

export function validateRun(state, intent) {
  if (state?.version !== 1 || state.intent !== intent || !Number.isSafeInteger(intent) || intent < 1 ||
      !/^[\w.-]+\/[\w.-]+$/.test(state.repository) || !/^[a-f0-9]{40}$/.test(state.baseline) ||
      !["live", "development-test"].includes(state.mode) || !["active", "paused", "cancelled", "accepted"].includes(state.status) ||
      !Number.isSafeInteger(state.lastCommentId) || state.lastCommentId < 0 || !Array.isArray(state.events)) {
    throw new Error("Invalid delivery run state.");
  }
  if (state.delivery) {
    const delivery = state.delivery;
    if (!/^[1-9]\d*$/.test(delivery.runId) || !Number.isSafeInteger(Number(delivery.runId)) ||
        !Number.isSafeInteger(delivery.runAttempt) || delivery.runAttempt < 1 ||
        !/^[a-f0-9]{40}$/.test(delivery.mergeSha) || !Number.isSafeInteger(delivery.pullNumber) || delivery.pullNumber < 1 ||
        typeof delivery.verified !== "boolean" || !Array.isArray(delivery.acceptances) ||
        (delivery.verified && (!digestPattern.test(delivery.digest) ||
          delivery.image !== `ghcr.io/${state.repository.toLowerCase()}-it-service-desk`)) ||
        delivery.runUrl !== `https://github.com/${state.repository}/actions/runs/${delivery.runId}`) {
      throw new Error("Invalid versioned delivery evidence.");
    }
    if (!/^[a-f0-9]{64}$/.test(delivery.policyHash) ||
        delivery.acceptances.some((decision) => !Number.isSafeInteger(decision.user?.id) ||
          typeof decision.user.login !== "string" || !decision.notes?.trim() ||
          !Number.isSafeInteger(decision.commentId) || decision.digest !== delivery.digest ||
          decision.runId !== delivery.runId || decision.runAttempt !== delivery.runAttempt) ||
        new Set(delivery.acceptances.map((decision) => decision.user.id)).size !== delivery.acceptances.length) {
      throw new Error("Invalid Human acceptance evidence.");
    }
  }
  if (state.status === "accepted" && (!state.delivery?.verified || !state.delivery.acceptances.length || state.delivery.rejection)) {
    throw new Error("Accepted runs require unrejected, verified Human acceptance evidence.");
  }
  return state;
}

export function recordDelivery(state, evidence, policy) {
  const previous = state.delivery;
  if (previous && (Number(evidence.runId) < Number(previous.runId) ||
      (evidence.runId === previous.runId && evidence.runAttempt < previous.runAttempt))) {
    return false;
  }
  if (previous && evidence.runId === previous.runId && evidence.runAttempt === previous.runAttempt) {
    if (previous.verified !== evidence.verified || previous.digest !== evidence.digest ||
        previous.mergeSha !== evidence.mergeSha || previous.image !== evidence.image ||
        previous.pullNumber !== evidence.pullNumber) throw new Error("Conflicting evidence for the same delivery attempt.");
    return false;
  }
  if (state.status === "accepted") throw new Error("This run was accepted. Start a new Intent for another delivery.");
  state.delivery = {
    ...evidence, policyHash: policyHash(policy), acceptances: [], rejection: null,
  };
  state.failure = evidence.verified ? null : { stage: "delivery", runUrl: evidence.runUrl, message: "Image publication or automated verification failed." };
  state.events.push({ type: evidence.verified ? "verification-passed" : "verification-failed", at: new Date().toISOString(), runId: evidence.runId, runAttempt: evidence.runAttempt });
  validateRun(state, state.intent);
  return true;
}

export function applyRunCommand(state, command, comment, policy, teamMembers = []) {
  if (!controlActions.includes(command.action)) throw new Error("Unsupported run command.");
  const terminal = ["cancelled", "accepted"].includes(state.status);
  if (["help", "status"].includes(command.action)) return;
  if (terminal) throw new Error(`Run is ${state.status}; no further changes are permitted. Start a new Intent.`);
  if (command.action === "pause") state.status = "paused";
  else if (command.action === "resume") state.status = "active";
  else if (command.action === "cancel") state.status = "cancelled";
  else {
    if (state.status !== "active") throw new Error("Resume the run before submitting acceptance.");
    const delivery = state.delivery;
    if (!delivery?.verified || delivery.digest !== command.digest) {
      throw new Error("Acceptance must reference the latest successfully verified image digest.");
    }
    if (delivery.policyHash !== policyHash(policy)) throw new Error("Acceptance policy changed. Reverify delivery before accepting.");
    const allowed = new Set([...policy.reviewers.users, ...teamMembers].map((login) => login.toLowerCase()));
    if (comment.user?.type !== "User" || !Number.isSafeInteger(comment.user.id) || !allowed.has(comment.user.login.toLowerCase())) {
      throw new Error("Only configured Human acceptance reviewers may accept or reject delivery.");
    }
    const decision = {
      user: { id: comment.user.id, login: comment.user.login },
      commentId: comment.id, commentBody: comment.body, notes: command.notes, at: comment.created_at,
      digest: command.digest, runId: delivery.runId, runAttempt: delivery.runAttempt,
    };
    if (command.action === "reject") {
      delivery.acceptances = [];
      delivery.rejection = decision;
    } else {
      if (delivery.rejection) throw new Error("Delivery was rejected. Fix the issue and publish/reverify before accepting a new attempt.");
      if (!delivery.acceptances.some((entry) => entry.user.id === comment.user.id)) delivery.acceptances.push(decision);
      if (delivery.acceptances.length >= policy.minimumApprovals) state.status = "accepted";
    }
  }
  state.events.push({ type: command.action, at: comment.created_at, commentId: comment.id, actor: comment.user.login });
}

export function runPresentation(state) {
  if (state.status === "accepted") return { status: state.mode === "development-test" ? "Development test complete - not Human acceptance" : "Complete - Human accepted", next: "Replay or archive this run. Start a fresh demo instance for another rehearsal." };
  if (state.status === "cancelled") return { status: "Cancelled", next: "No new work or automatic merge is allowed. Existing evidence is retained; start a new Intent." };
  if (state.status === "paused") return { status: "Paused", next: "Submit `/sdlc resume`. Already-running agents may finish, but publication/advancement and automatic merge are gated." };
  if (state.delivery?.rejection) return { status: "Acceptance rejected", next: "Use the rejection notes to create a linked remediation Intent. For an environment-only problem, fix it and rerun verification." };
  if (state.failure) return { status: `Failed: ${state.failure.stage}`, next: "Inspect the linked run, resolve the error, then retry. A failed check is never approval." };
  if (state.delivery?.verified) return { status: "Awaiting Human acceptance", next: `Run the exact image, check the acceptance scenarios, then submit \`/sdlc accept ${state.delivery.digest}\` followed by your observed results.` };
  return { status: "Active", next: "Use the current document or PR review below. Submit `/sdlc help` for available actions." };
}
