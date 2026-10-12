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
export const discoveryProfile = "decisions-v1";
export const discoveryContextHash = (discovery) => contentHash(JSON.stringify({
  questions: discovery.questions, decisions: discovery.decisions,
}));

function exactObject(value, keys, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`Invalid ${name} fields; expected ${keys.join(", ")}.`);
  }
}

function boundedText(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 4000 || value.includes("\0")) {
    throw new Error(`${name} must be non-empty text of at most 4000 characters.`);
  }
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length > 20) throw new Error("Discovery supports at most 20 questions; narrow the Intent.");
  const ids = new Set();
  for (const question of questions) {
    exactObject(question, ["id", "question", "options"], "discovery question");
    if (!/^Q-[1-9]\d*$/.test(question.id) || ids.has(question.id)) throw new Error("Discovery needs unique Q-n identifiers.");
    boundedText(question.question, "Question");
    boundedText(question.options, "Options");
    ids.add(question.id);
  }
}

export function latestDecisions(discovery) {
  return [...new Map(discovery.decisions.map((decision) => [decision.questionId, decision])).values()];
}

export function discoveryBlockers(state) {
  if (state.version !== 2) return [];
  const answered = new Set(latestDecisions(state.discovery).map((decision) => decision.questionId));
  return state.discovery.questions.filter((question) => !answered.has(question.id));
}

export function assertDiscoveryReady(state) {
  if (state.version !== 2) return;
  const blockers = discoveryBlockers(state);
  if (blockers.length) throw new Error(`Unresolved discovery blockers: ${blockers.map((item) => item.id).join(", ")}. Record a Human decision or explicit deferment before approval.`);
  if (state.documents.spec?.contextHash !== discoveryContextHash(state.discovery)) {
    throw new Error("Spec does not incorporate the current Human decisions. Publish and review its revision.");
  }
}

export function validateDiscoveryDocument(text, discovery) {
  if ((text.match(/^## Discovery$/gm) ?? []).length !== 1) throw new Error("Spec needs exactly one Discovery section.");
  const block = section(text, "Discovery").trim().match(/^```json\r?\n([\s\S]+)\r?\n```$/);
  if (!block) throw new Error("Discovery must contain one JSON code block.");
  const value = JSON.parse(block[1]);
  exactObject(value, ["problem", "evidence", "successMeasure", "alternatives", "questions", "decisionMapping"], "discovery");
  for (const key of ["problem", "evidence", "successMeasure", "alternatives"]) boundedText(value[key], key);
  validateQuestions(value.questions);
  for (const previous of discovery.questions) {
    const current = value.questions.find((question) => question.id === previous.id);
    if (!current || current.question !== previous.question || current.options !== previous.options) {
      throw new Error(`Preserve discovery question ${previous.id} and its options; resolve or defer it explicitly, or add a new question.`);
    }
  }
  const decisions = latestDecisions(discovery);
  if (!Array.isArray(value.decisionMapping) || value.decisionMapping.length !== decisions.length) {
    throw new Error("Discovery must map every latest Human decision exactly once.");
  }
  const acceptance = validateSpecification(text);
  const mapped = new Set();
  for (const mapping of value.decisionMapping) {
    exactObject(mapping, ["questionId", "commentId", "acceptanceIds", "explanation"], "decision mapping");
    const decision = decisions.find((item) => item.questionId === mapping.questionId);
    if (!decision || mapping.commentId !== decision.commentId || mapped.has(mapping.questionId)) {
      throw new Error("Decision mapping references a missing, stale, or duplicate Human decision.");
    }
    if (!Array.isArray(mapping.acceptanceIds) ||
        mapping.acceptanceIds.some((id) => !acceptance.includes(id)) ||
        new Set(mapping.acceptanceIds).size !== mapping.acceptanceIds.length) {
      throw new Error("Decision mapping references invalid acceptance IDs.");
    }
    boundedText(mapping.explanation, "Decision application (or reason no AC changes)");
    mapped.add(mapping.questionId);
  }
  return value;
}

function decisionFields(action, text) {
  const keys = action === "decide" ? ["Outcome", "Rationale"] : ["Rationale", "Owner", "Follow-up", "Risk"];
  const fields = {};
  for (const line of text.split(/\r?\n/).filter((item) => item.trim())) {
    const match = line.match(/^([A-Za-z-]+): (.+)$/);
    if (!match || !keys.includes(match[1]) || Object.hasOwn(fields, match[1])) throw new Error(`Use one line per field: ${keys.join(", ")}.`);
    boundedText(match[2], match[1]);
    fields[match[1]] = match[2].trim();
  }
  if (Object.keys(fields).length !== keys.length) throw new Error(`Required decision fields: ${keys.join(", ")}.`);
  if (action === "defer" && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(fields.Owner)) {
    throw new Error("Deferment Owner must be a GitHub login.");
  }
  return Object.fromEntries(keys.map((key) => [key, fields[key]]));
}

export function parseDocumentCommand(body) {
  if (!String(body).startsWith("/sdlc")) return null;
  const text = body.trim();
  if (text === "/sdlc retry") return { action: "retry" };
  const decision = text.match(/^\/sdlc (decide|defer) spec v([1-9]\d*) (Q-[1-9]\d*)\r?\n+([\s\S]+)$/);
  if (decision && Number.isSafeInteger(Number(decision[2]))) {
    return { action: decision[1], stage: "spec", version: Number(decision[2]), questionId: decision[3],
      fields: decisionFields(decision[1], decision[4]) };
  }
  const approve = text.match(/^\/sdlc approve (spec|plan) v([1-9]\d*)$/);
  if (approve && Number.isSafeInteger(Number(approve[2]))) {
    return { action: "approve", stage: approve[1], version: Number(approve[2]) };
  }
  const revise = text.match(/^\/sdlc revise (spec|plan)\r?\n+([\s\S]+)$/);
  if (revise && revise[2].trim()) {
    return { action: "revise", stage: revise[1], feedback: revise[2].trim() };
  }
  throw new Error("Use /sdlc approve spec|plan vN, /sdlc revise spec|plan followed by feedback, /sdlc decide|defer spec vN Q-n with required fields, or /sdlc retry.");
}

export function initialDocumentState(issue, baseline, config = {}) {
  if (config.specReadiness !== undefined && !["structural", discoveryProfile].includes(config.specReadiness)) {
    throw new Error("Unsupported Spec readiness profile.");
  }
  const discovery = config.specReadiness === discoveryProfile;
  return {
    version: discovery ? 2 : 1,
    ...(discovery ? { reviewProfile: discoveryProfile, discovery: { questions: [], decisions: [] } } : {}),
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
    approval.user.type === "User" && Number.isSafeInteger(approval.user.id) &&
    approval.contextHash === doc.contextHash);
  return new Set(approvals.map((approval) => approval.user.id)).size >= policy.minimumApprovals;
}

export function requestDocumentRevision(state, stage, feedback, config) {
  if (state.sealed) throw new Error("Documents are frozen after Plan approval. Start a new Intent for a scope change.");
  if (!documentStages.includes(stage)) throw new Error("Unknown document stage.");
  if (stage === "plan" && !hasDocumentApproval(state.documents.spec, config.stages.spec)) {
    throw new Error("Approve the current Spec before requesting a Plan.");
  }
  if (stage === "plan") assertDiscoveryReady(state);
  if (state.documents[stage]) state.documents[stage].approvals = [];
  if (stage === "spec") state.documents.plan = null;
  state.pending = {
    stage, version: state.counters[stage] + 1, feedback,
    policyHash: policyHash(config.stages[stage]),
    specHash: stage === "plan" ? state.documents.spec.hash : null,
    ...(state.version === 2 ? { contextHash: discoveryContextHash(state.discovery) } : {}),
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
  let discovery;
  if (state.version === 2) {
    if (request.contextHash !== discoveryContextHash(state.discovery)) throw new Error("Discovery context changed during generation.");
    if (request.stage === "spec") discovery = validateDiscoveryDocument(text, state.discovery);
    else assertDiscoveryReady(state);
  }
  if (discovery) state.discovery.questions = discovery.questions;
  state.documents[request.stage] = {
    version: request.version, hash: contentHash(text), specHash: request.specHash,
    policyHash: request.policyHash, approvals: [],
    ...(state.version === 2 ? { contextHash: discoveryContextHash(state.discovery) } : {}),
  };
  state.counters[request.stage] = request.version;
  state.pending = null;
}

function reviewableDocument(state, command, comment, config, teamMembers) {
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
  return doc;
}

export function recordDiscoveryDecision(state, command, comment, config, teamMembers = []) {
  if (state.version !== 2) throw new Error("Discovery decisions require a new decisions-v1 run; existing runs are not migrated.");
  const doc = reviewableDocument(state, command, comment, config, teamMembers);
  if (!state.discovery.questions.some((question) => question.id === command.questionId)) throw new Error("Unknown discovery question.");
  const parsed = parseDocumentCommand(comment.body);
  if (!parsed || !["decide", "defer"].includes(parsed.action) || JSON.stringify(parsed) !== JSON.stringify(command) ||
      comment.created_at !== comment.updated_at || !Number.isSafeInteger(comment.id) ||
      !Number.isFinite(Date.parse(comment.created_at))) throw new Error("Decision must be an exact new, unedited Human command.");
  if (state.discovery.decisions.some((decision) => decision.commentId === comment.id)) throw new Error("Decision was already recorded.");
  if (state.discovery.decisions.length >= 100) throw new Error("Discovery decision history is full; narrow the Intent.");
  state.discovery.decisions.push({
    questionId: command.questionId, disposition: command.action === "decide" ? "resolved" : "deferred",
    fields: command.fields, version: doc.version, hash: doc.hash, contextHash: doc.contextHash,
    policyHash: doc.policyHash, user: { id: comment.user.id, login: comment.user.login, type: "User" },
    commentId: comment.id, commentBody: comment.body, decidedAt: comment.created_at,
  });
  requestDocumentRevision(state, "spec", `Apply Human decision #${comment.id} for ${command.questionId}. Preserve every question and map the latest decisions to acceptance IDs or explain why no AC changes.`, config);
}

export function approveDocument(state, command, comment, config, teamMembers = []) {
  const doc = reviewableDocument(state, command, comment, config, teamMembers);
  assertDiscoveryReady(state);
  if (state.version === 2 && doc.contextHash !== discoveryContextHash(state.discovery)) throw new Error("Document decision context is stale.");
  const policy = config.stages[command.stage];
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
      ...(state.version === 2 ? { contextHash: doc.contextHash } : {}),
    });
  }
  if (command.stage === "plan" && hasDocumentApproval(doc, policy)) state.sealed = true;
}

export function validateDocumentState(state, intent) {
  if (![1, 2].includes(state?.version) || state.intent !== intent || !/^[a-f0-9]{40}$/.test(state.baseline) ||
      typeof state.sealed !== "boolean" || !Number.isSafeInteger(state.lastCommentId) ||
      state.lastCommentId < 0 || !Array.isArray(state.receipts) ||
      state.receipts.some((receipt) => !Number.isSafeInteger(receipt.id) || typeof receipt.message !== "string") ||
      typeof state.intentSnapshot?.title !== "string" ||
      typeof state.intentSnapshot.body !== "string") {
    throw new Error("Invalid persisted document review state.");
  }
  if (state.version === 1 && (state.reviewProfile !== undefined || state.discovery !== undefined)) throw new Error("Legacy review state cannot enroll in a new profile.");
  if (state.version === 2) {
    if (state.reviewProfile !== discoveryProfile) throw new Error("Unsupported persisted review profile.");
    exactObject(state.discovery, ["questions", "decisions"], "discovery state");
    validateQuestions(state.discovery.questions);
    if (!Array.isArray(state.discovery.decisions) || state.discovery.decisions.length > 100) throw new Error("Invalid discovery decision history.");
    const comments = new Set();
    for (const decision of state.discovery.decisions) {
      if (!state.discovery.questions.some((question) => question.id === decision.questionId) ||
          !["resolved", "deferred"].includes(decision.disposition) ||
          !Number.isSafeInteger(decision.commentId) || decision.commentId <= 0 || comments.has(decision.commentId) ||
          decision.user?.type !== "User" || !Number.isSafeInteger(decision.user.id) || !decision.user.login ||
          !Number.isSafeInteger(decision.version) || decision.version < 1 || decision.version > state.counters.spec ||
          !Number.isFinite(Date.parse(decision.decidedAt)) ||
          ["hash", "contextHash", "policyHash"].some((key) => !/^[a-f0-9]{64}$/.test(decision[key] ?? ""))) {
        throw new Error("Invalid persisted Human decision.");
      }
      const parsed = parseDocumentCommand(decision.commentBody);
      if (parsed?.action !== (decision.disposition === "resolved" ? "decide" : "defer") ||
          parsed.questionId !== decision.questionId || parsed.version !== decision.version ||
          JSON.stringify(parsed.fields) !== JSON.stringify(decision.fields)) throw new Error("Decision receipt differs from its Human command.");
      comments.add(decision.commentId);
    }
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
    if (state.version === 2 && doc && (!/^[a-f0-9]{64}$/.test(doc.contextHash ?? "") ||
        doc.approvals.some((approval) => approval.contextHash !== doc.contextHash) ||
        (!state.pending && doc.contextHash !== discoveryContextHash(state.discovery)))) {
      throw new Error(`Invalid persisted ${stage} discovery binding.`);
    }
  }
  if (state.pending && (!documentStages.includes(state.pending.stage) ||
      state.pending.version !== state.counters[state.pending.stage] + 1 ||
      typeof state.pending.feedback !== "string" ||
      (state.version === 2 && state.pending.contextHash !== discoveryContextHash(state.discovery)))) {
    throw new Error("Invalid pending document revision.");
  }
  if (state.version === 2 && (state.sealed || state.documents.spec?.approvals.length)) assertDiscoveryReady(state);
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
  if (state.version === 2) {
    assertDiscoveryReady(state);
    const discovery = validateDiscoveryDocument(documents.spec, state.discovery);
    if (JSON.stringify(discovery.questions) !== JSON.stringify(state.discovery.questions)) throw new Error("Spec questions differ from the reviewed discovery state.");
  }
}
