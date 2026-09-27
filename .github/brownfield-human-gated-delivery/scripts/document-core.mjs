import { createHash } from "node:crypto";
import { artifactPaths, lifecycleBranch, section, validateImplementationPlan, validateSpecification } from "./core.mjs";

export const documentMode = "Delivery Document Review: issue-v1";
export const documentStages = ["spec", "plan"];
export const documentBranch = (intent) => lifecycleBranch(intent).replace("brownfield-delivery/", "brownfield-documents/");
export const documentStatePath = (intent) => `${artifactPaths(intent).root}/document-review.json`;
export const contentHash = (text) => createHash("sha256").update(text).digest("hex");
export const reviewPolicy = (policy) => ({
  minimumApprovals: policy.minimumApprovals,
  reviewers: policy.reviewers,
});
export const policyHash = (policy) => contentHash(JSON.stringify(reviewPolicy(policy)));

export function parseDocumentCommand(body) {
  if (!String(body).startsWith("/sdlc")) return null;
  const text = body.trim();
  if (text === "/sdlc retry") return { action: "retry" };
  const approve = text.match(/^\/sdlc approve (spec|plan) v([1-9]\d*)$/);
  if (approve && Number.isSafeInteger(Number(approve[2]))) {
    return { action: "approve", stage: approve[1], version: Number(approve[2]) };
  }
  const revise = text.match(/^\/sdlc revise (spec|plan)\r?\n+([\s\S]+)$/);
  if (revise && revise[2].trim()) {
    return { action: "revise", stage: revise[1], feedback: revise[2].trim() };
  }
  throw new Error("Use /sdlc approve spec|plan vN, /sdlc revise spec|plan followed by feedback on a new line, or /sdlc retry.");
}

export function initialDocumentState(issue, baseline) {
  return {
    version: 1,
    intent: issue.number,
    baseline,
    intentSnapshot: { title: issue.title, body: issue.body ?? "" },
    counters: { spec: 0, plan: 0 },
    documents: { spec: null, plan: null },
    pending: null,
    lastCommentId: 0,
    receipts: [],
    sealed: false,
  };
}

export function hasDocumentApproval(doc, policy) {
  if (!doc || doc.policyHash !== policyHash(policy)) return false;
  const approvals = doc.approvals.filter((approval) =>
    approval.hash === doc.hash && approval.version === doc.version &&
    approval.user.type === "User" && Number.isSafeInteger(approval.user.id));
  return new Set(approvals.map((approval) => approval.user.id)).size >= policy.minimumApprovals;
}

export function requestDocumentRevision(state, stage, feedback, config) {
  if (state.sealed) throw new Error("Documents are frozen after Plan approval. Start a new Intent for a scope change.");
  if (!documentStages.includes(stage)) throw new Error("Unknown document stage.");
  if (stage === "plan" && !hasDocumentApproval(state.documents.spec, config.stages.spec)) {
    throw new Error("Approve the current Spec before requesting a Plan.");
  }
  if (state.documents[stage]) state.documents[stage].approvals = [];
  if (stage === "spec") state.documents.plan = null;
  state.pending = {
    stage, version: state.counters[stage] + 1, feedback,
    policyHash: policyHash(config.stages[stage]),
    specHash: stage === "plan" ? state.documents.spec.hash : null,
  };
}

export function validateGeneratedDocument(stage, text, spec) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 40000 || text.includes("\0")) {
    throw new Error("Document must be UTF-8 Markdown, at most 40 KB, without NUL bytes.");
  }
  if (stage === "spec") validateSpecification(text);
  else validateImplementationPlan(text, validateSpecification(spec));
  for (const heading of ["Revision summary", "Open questions"]) {
    section(text, heading);
  }
}

export function publishDocumentRevision(state, text, spec, config) {
  const request = state.pending;
  if (!request || state.sealed) throw new Error("No document generation is pending.");
  if (request.policyHash !== policyHash(config.stages[request.stage])) {
    throw new Error("Reviewer policy changed during generation; request a new revision.");
  }
  if (request.stage === "plan" &&
      (!hasDocumentApproval(state.documents.spec, config.stages.spec) ||
       request.specHash !== state.documents.spec.hash)) {
    throw new Error("The Plan no longer references an approved Spec.");
  }
  validateGeneratedDocument(request.stage, text, spec);
  state.documents[request.stage] = {
    version: request.version, hash: contentHash(text), specHash: request.specHash,
    policyHash: request.policyHash, approvals: [],
  };
  state.counters[request.stage] = request.version;
  state.pending = null;
}

export function approveDocument(state, command, comment, config, teamMembers = []) {
  if (state.sealed) throw new Error("Documents have already been approved and handed off.");
  if (state.pending) throw new Error("A revision is pending. Review and approve the newly published version.");
  const doc = state.documents[command.stage];
  if (!doc || doc.version !== command.version) throw new Error("Stale or missing document version; approve the latest published vN.");
  const policy = config.stages[command.stage];
  const configured = new Set([...policy.reviewers.users, ...teamMembers].map((login) => login.toLowerCase()));
  if (comment.user.type !== "User" || !Number.isSafeInteger(comment.user.id) ||
      !configured.has(comment.user.login.toLowerCase())) {
    throw new Error("Only a configured Human reviewer can approve this document.");
  }
  if (doc.policyHash !== policyHash(policy)) throw new Error("Reviewer policy changed; request a new document revision before approval.");
  if (command.stage === "plan" &&
      (!hasDocumentApproval(state.documents.spec, config.stages.spec) ||
       doc.specHash !== state.documents.spec.hash)) {
    throw new Error("Plan approval requires the exact approved Spec.");
  }
  if (!doc.approvals.some((entry) => entry.user.id === comment.user.id)) {
    doc.approvals.push({
      user: { id: comment.user.id, login: comment.user.login, type: "User" },
      commentId: comment.id, commentBody: comment.body,
      approvedAt: comment.created_at, hash: doc.hash, version: doc.version,
    });
  }
  if (command.stage === "plan" && hasDocumentApproval(doc, policy)) state.sealed = true;
}

export function validateDocumentState(state, intent) {
  if (state?.version !== 1 || state.intent !== intent || !/^[a-f0-9]{40}$/.test(state.baseline) ||
      typeof state.sealed !== "boolean" || !Number.isSafeInteger(state.lastCommentId) ||
      state.lastCommentId < 0 || !Array.isArray(state.receipts) ||
      state.receipts.some((receipt) => !Number.isSafeInteger(receipt.id) || typeof receipt.message !== "string") ||
      typeof state.intentSnapshot?.title !== "string" ||
      typeof state.intentSnapshot.body !== "string") {
    throw new Error("Invalid persisted document review state.");
  }
  for (const stage of documentStages) {
    const doc = state.documents?.[stage];
    if (!Number.isSafeInteger(state.counters?.[stage]) || state.counters[stage] < 0 ||
        (doc !== null && (!doc || doc.version !== state.counters[stage] ||
          !/^[a-f0-9]{64}$/.test(doc.hash) || !/^[a-f0-9]{64}$/.test(doc.policyHash) ||
          !Array.isArray(doc.approvals) || doc.approvals.some((entry) =>
            !Number.isSafeInteger(entry.commentId) || !entry.user?.login ||
            entry.user.type !== "User" || !Number.isSafeInteger(entry.user.id) ||
            typeof entry.commentBody !== "string" || !entry.approvedAt ||
            entry.hash !== doc.hash || entry.version !== doc.version)))) {
      throw new Error(`Invalid persisted ${stage} review.`);
    }
  }
  if (state.pending && (!documentStages.includes(state.pending.stage) ||
      state.pending.version !== state.counters[state.pending.stage] + 1 ||
      typeof state.pending.feedback !== "string")) {
    throw new Error("Invalid pending document revision.");
  }
  return state;
}

export function validateDocumentHandoff(state, documents, config) {
  validateDocumentState(state, state.intent);
  if (!state.sealed || state.pending) throw new Error("Spec and Plan have not completed Human approval.");
  for (const stage of documentStages) {
    if (!hasDocumentApproval(state.documents[stage], config.stages[stage]) ||
        contentHash(documents[stage]) !== state.documents[stage].hash) {
      throw new Error(`Missing approval or changed approved ${stage}.`);
    }
  }
  if (state.documents.plan.specHash !== state.documents.spec.hash) throw new Error("Plan references a different Spec.");
  validateGeneratedDocument("spec", documents.spec);
  validateGeneratedDocument("plan", documents.plan, documents.spec);
}
