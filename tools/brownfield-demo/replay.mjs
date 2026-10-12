import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  configPath, fullSha, intentNumber, newDestination, positive, repository,
  reviewerLogin, sha256, validateHumanConfig,
} from "./common.mjs";
import { exactImage } from "./docker.mjs";
import { contentFile, github, readOnlyApi } from "./github.mjs";
import {
  assertDiscoveryReady, discoveryContextHash, latestDecisions, parseDocumentCommand,
  policyHash, validateDocumentHandoff, validateDocumentState,
} from "../../.github/brownfield-human-gated-delivery/scripts/document-core.mjs";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function validateRunRecord(record, repo, intent) {
  if (record?.version !== 1 || record.intent !== intent ||
      record.repository?.toLowerCase() !== repo || !["live", "development-test"].includes(record.mode) ||
      !fullSha(record.baseline) || !["active", "paused", "cancelled", "accepted"].includes(record.status) ||
      !Number.isSafeInteger(record.lastCommentId) || record.lastCommentId < 0 ||
      !Array.isArray(record.events) || record.events.some((event) => typeof event?.type !== "string" ||
        !Number.isFinite(Date.parse(event.at)))) throw new Error("Invalid runtime record identity or schema.");
  const delivery = record.delivery;
  if (delivery !== null) {
    if (!delivery || !/^[1-9]\d*$/.test(String(delivery.runId)) || !positive(Number(delivery.runId)) || !positive(delivery.pullNumber) ||
        !fullSha(delivery.mergeSha) || typeof delivery.verified !== "boolean" ||
        delivery.runUrl?.toLowerCase() !== `https://github.com/${repo}/actions/runs/${delivery.runId}` ||
        (delivery.runAttempt !== undefined && !positive(delivery.runAttempt)) ||
        !Array.isArray(delivery.acceptances) ||
        (delivery.rejection !== null && (typeof delivery.rejection !== "object" || Array.isArray(delivery.rejection)))) {
      throw new Error("Invalid runtime delivery schema.");
    }
    if (delivery.verified) exactImage(`${delivery.image}@${delivery.digest}`);
    for (const acceptance of delivery.acceptances) {
      if (!positive(acceptance?.commentId) || !positive(acceptance.user?.id) ||
          typeof acceptance.notes !== "string" || !acceptance.notes.trim() ||
          !Number.isFinite(Date.parse(acceptance.at)) ||
          (acceptance.digest !== undefined && acceptance.digest !== delivery.digest) ||
          (acceptance.runId !== undefined && acceptance.runId !== delivery.runId) ||
          (acceptance.runAttempt !== undefined && acceptance.runAttempt !== delivery.runAttempt)) throw new Error("Invalid Human acceptance record.");
      reviewerLogin(acceptance.user.login);
    }
  }
  if (record.status === "accepted" && (!delivery?.verified || !delivery.acceptances.length || delivery.rejection)) {
    throw new Error("Accepted runtime state requires verified unrejected Human acceptance.");
  }
  return record;
}

function issueEvidence(issue, comments) {
  return {
    number: issue.number, title: issue.title, body: issue.body, state: issue.state,
    stateReason: issue.state_reason, user: issue.user, createdAt: issue.created_at,
    updatedAt: issue.updated_at, comments: comments.map((comment) => ({
      id: comment.id, nodeId: comment.node_id, user: comment.user, authorAssociation: comment.author_association,
      body: comment.body, createdAt: comment.created_at, updatedAt: comment.updated_at,
    })),
  };
}

function validateReviewProfile(state, intent) {
  if (state?.version === 2) return validateDocumentState(state, intent);
  if (state?.version !== 1 || state.reviewProfile !== undefined || state.discovery !== undefined) {
    throw new Error("Unsupported or malformed document review profile.");
  }
  return state;
}

function uneditedHuman(comment) {
  return comment?.user?.type === "User" && positive(comment.user.id) &&
    ["OWNER", "MEMBER", "COLLABORATOR"].includes(comment.authorAssociation) &&
    typeof comment.createdAt === "string" && Number.isFinite(Date.parse(comment.createdAt)) &&
    comment.createdAt === comment.updatedAt;
}

export function documentEvidence(evidence, state, texts, trusted) {
  const { record, config } = evidence;
  const comments = evidence.issues.find((issue) => issue.number === (record?.intent ?? evidence.summary?.intent))?.comments ?? [];
  const reasons = [];
  const result = {
    verified: false, trusted, reviewProfile: state?.version === 1 ? "structural" : state?.reviewProfile ?? null,
    counters: state?.counters ?? null, sealed: state?.sealed ?? false, pending: state?.pending ?? null,
    approvalCommentIds: {}, revisionCommentIds: [], decisionCommentIds: [], discovery: null, reasons,
  };
  if (!trusted) reasons.push("Document state lacks a trusted workflow audit entry.");
  try {
    validateHumanConfig(config);
    validateReviewProfile(state, record?.intent ?? evidence.summary?.intent);
  } catch (error) {
    reasons.push(error.message);
    return result;
  }
  if (state.intent !== record?.intent || state.baseline !== record?.baseline ||
      state.sealed !== true || state.pending !== null || !Array.isArray(state.receipts)) {
    reasons.push("Documents are not a sealed, versioned handoff for this run and baseline.");
  }
  if (state.version === 2) {
    const discoveryReasons = [];
    try { assertDiscoveryReady(state); } catch (error) { discoveryReasons.push(error.message); }
    const latest = latestDecisions(state.discovery);
    result.discovery = {
      contextHash: discoveryContextHash(state.discovery),
      recordedReady: discoveryReasons.length === 0, decisionEvidenceVerified: false,
      questions: state.discovery.questions.map((question) => ({
        ...question, decision: latest.find((decision) => decision.questionId === question.id) ?? null,
      })),
      decisions: state.discovery.decisions, reasons: discoveryReasons,
    };
    try { validateDocumentHandoff(state, texts, config); } catch (error) { reasons.push(error.message); }
  }
  for (const stage of ["spec", "plan"]) {
    const doc = state.documents?.[stage];
    const policy = config.stages[stage];
    if (!positive(state.counters?.[stage]) || doc?.version !== state.counters[stage] ||
        !/^[a-f0-9]{64}$/.test(doc?.hash ?? "") || typeof texts[stage] !== "string" ||
        sha256(texts[stage]) !== doc.hash || doc.policyHash !== policyHash(policy) ||
        !Array.isArray(doc.approvals) || policy.reviewers.teams.length) {
      reasons.push(`The ${stage} revision, content, or individual Human policy cannot be verified.`);
      continue;
    }
    const verified = doc.approvals.filter((approval) => {
      const comment = comments.find((item) => item.id === approval.commentId);
      return uneditedHuman(comment) && comment.user.id === approval.user?.id &&
        comment.user.login?.toLowerCase() === approval.user.login?.toLowerCase() &&
        policy.reviewers.users.some((login) => login.toLowerCase() === comment.user.login.toLowerCase()) &&
        comment.body?.trim() === `/sdlc approve ${stage} v${doc.version}` &&
        approval.commentBody === comment.body && approval.approvedAt === comment.createdAt &&
        approval.hash === doc.hash && approval.version === doc.version &&
        (state.version === 1 || approval.contextHash === doc.contextHash);
    });
    if (new Set(verified.map((approval) => approval.user.id)).size < policy.minimumApprovals) {
      reasons.push(`Missing actual Human approval of the current ${stage} revision.`);
    }
    result.approvalCommentIds[stage] = verified.map((approval) => approval.commentId);
  }
  if (!state.documents?.spec || state.documents.plan?.specHash !== state.documents.spec.hash) {
    reasons.push("Plan does not reference the current Spec hash.");
  }
  const revisions = comments.filter((comment) => uneditedHuman(comment) &&
    /^\/sdlc revise spec\r?\n+\s*\S/.test(comment.body ?? "") &&
    state.receipts?.some((receipt) => receipt.id === comment.id &&
      receipt.message === `Command #${comment.id} recorded: revise spec.`) &&
    state.documents?.spec?.approvals?.some((approval) => Date.parse(comment.createdAt) < Date.parse(approval.approvedAt)));
  result.revisionCommentIds = revisions.map((comment) => comment.id);
  if (state.version === 2) {
    const policy = config.stages.spec;
    let previousVersion = 0;
    for (const decision of state.discovery.decisions) {
      const comment = comments.find((item) => item.id === decision.commentId);
      const command = parseDocumentCommand(decision.commentBody);
      const receipt = `Command #${decision.commentId} recorded: ${command.action} spec v${decision.version}.`;
      if (uneditedHuman(comment) && comment.user.id === decision.user.id &&
          comment.user.login?.toLowerCase() === decision.user.login.toLowerCase() &&
          policy.reviewers.users.some((login) => login.toLowerCase() === comment.user.login.toLowerCase()) &&
          !policy.reviewers.teams.length && decision.policyHash === policyHash(policy) &&
          comment.body === decision.commentBody && comment.createdAt === decision.decidedAt &&
          state.receipts.some((item) => item.id === comment.id && item.message === receipt) &&
          decision.version > previousVersion &&
          (!state.sealed || (decision.version < state.counters.spec &&
            state.documents.spec.approvals.every((approval) => Date.parse(decision.decidedAt) < Date.parse(approval.approvedAt))))) {
        result.decisionCommentIds.push(decision.commentId);
      } else {
        reasons.push(`Human discovery decision ${decision.commentId} is missing, edited, unauthorized, or does not match its recorded revision and receipt.`);
      }
      previousVersion = decision.version;
    }
    result.discovery.decisionEvidenceVerified = trusted &&
      result.decisionCommentIds.length === state.discovery.decisions.length;
  }
  if (state.counters?.spec > 1 && !revisions.length &&
      (state.version === 1 || state.counters.spec !== 1 + result.decisionCommentIds.length)) {
    reasons.push("Spec counter increased without actual recorded Human revision requests or matching decision-driven revisions.");
  }
  result.verified = reasons.length === 0;
  return result;
}

export function acceptanceEvidence(record, issues, pulls, runs, config, recordTrusted = false) {
  const delivery = record?.delivery;
  const reasons = [];
  if (record?.mode !== "live") reasons.push("Automated development tests do not constitute genuine Human acceptance or Demo Ready.");
  if (!recordTrusted) reasons.push("Runtime record lacks a verified trusted workflow audit entry.");
  if (record?.status !== "accepted") reasons.push("Runtime record is not accepted.");
  if (!delivery?.verified || delivery?.rejection !== null) reasons.push("Delivery is not verified or has an outstanding rejection.");
  const pull = pulls.find((item) => item.number === delivery?.pullNumber);
  const merges = pull?.timeline?.filter((event) => event.event === "merged") ?? [];
  if (!pull?.merged || merges.length !== 1 || merges[0].commit_id !== delivery?.mergeSha ||
      pull.base?.repo?.full_name?.toLowerCase() !== record?.repository?.toLowerCase() ||
      pull.base?.ref !== "main" ||
      !new RegExp(`^Delivery Intent:\\s*#${record?.intent}\\s*$`, "im").test(pull.body ?? "") ||
      !/^Delivery Stage:\s*implementation\s*$/im.test(pull.body ?? "")) reasons.push("Actual implementation PR merge does not match the recorded delivery.");
  const run = runs.find((item) => item.id === Number(delivery?.runId));
  const sourceMatches = typeof pull?.head?.ref === "string" && pull.head.ref.length > 0 &&
    run?.head_branch === pull.head.ref &&
    typeof pull?.head?.repo?.full_name === "string" &&
    run?.head_repository?.full_name?.toLowerCase() === pull.head.repo.full_name.toLowerCase();
  // GitHub can omit associations after a PR closes; still require its exact source and head SHA.
  const pullMatches = run?.pull_requests?.some((item) => item.number === pull?.number) ||
    (Array.isArray(run?.pull_requests) && run.pull_requests.length === 0 && sourceMatches);
  const workflowCommitMatches = run?.head_sha === delivery?.mergeSha ||
    (run?.event === "pull_request" && run.head_sha === pull?.head?.sha && pullMatches);
  if (!run || run.status !== "completed" || run.conclusion !== "success" ||
      !workflowCommitMatches ||
      (delivery?.runAttempt !== undefined && run.run_attempt !== delivery.runAttempt) ||
      run.path?.split("@")[0] !== ".github/workflows/brownfield-human-gated-delivery-publish.yml" ||
      run.repository?.full_name?.toLowerCase() !== record?.repository?.toLowerCase()) {
    reasons.push("Actual successful publish/verify workflow does not match the recorded delivery.");
  }
  const policy = config?.stages?.implementation;
  const configured = policy?.reviewers?.users?.map((login) => login.toLowerCase()) ?? [];
  if (!policy || policy.reviewers.teams.length) reasons.push("Acceptance authority cannot be fully verified from individual Human configuration.");
  if (policy && delivery?.policyHash !== undefined &&
      delivery.policyHash !== sha256(JSON.stringify({ minimumApprovals: policy.minimumApprovals, reviewers: policy.reviewers }))) {
    reasons.push("Recorded acceptance policy differs from current Human configuration.");
  }
  const comments = issues.find((issue) => issue.number === record?.intent)?.comments ?? [];
  const verifiedHumans = [];
  for (const acceptance of delivery?.acceptances ?? []) {
    const comment = comments.find((item) => item.id === acceptance.commentId);
    const command = /^\/sdlc accept (sha256:[a-f0-9]{64})\r?\n+([\s\S]+)$/.exec(comment?.body ?? "");
    if (comment?.user?.type === "User" && comment.user.id === acceptance.user.id &&
        comment.user.login?.toLowerCase() === acceptance.user.login.toLowerCase() &&
        configured.includes(comment.user.login.toLowerCase()) &&
        ["OWNER", "MEMBER", "COLLABORATOR"].includes(comment.authorAssociation) &&
        command?.[1] === delivery.digest && command?.[2].trim() === acceptance.notes.trim() &&
        (acceptance.commentBody === undefined || acceptance.commentBody === comment.body) &&
        Date.parse(comment.createdAt) === Date.parse(acceptance.at) &&
        Date.parse(comment.createdAt) >= Date.parse(run?.updated_at) &&
        Date.parse(comment.updatedAt) === Date.parse(comment.createdAt)) {
      verifiedHumans.push({ user: acceptance.user, commentId: acceptance.commentId });
    } else reasons.push(`Human acceptance comment ${acceptance.commentId} is missing, edited, unauthorized, or does not match the recorded decision.`);
  }
  if (new Set(verifiedHumans.map((item) => item.user.id)).size < (policy?.minimumApprovals ?? 1)) {
    reasons.push("Not enough actual configured Human acceptance comments.");
  }
  return { complete: reasons.length === 0, verifiedHumans, reasons };
}

export async function trustedRecord(api, comments, commit, text, marker = "<!-- brownfield-human-gated-delivery-run-ledger -->") {
  const ledgers = comments.filter((comment) => comment.user?.type === "Bot" &&
    comment.user.login === "github-actions[bot]" && comment.body?.startsWith(marker));
  if (ledgers.length !== 1 || !ledgers[0].nodeId) return false;
  const result = await api("POST", "graphql", {
    query: `query AuditComment($id: ID!) {
      node(id: $id) {
        ... on IssueComment {
          body lastEditedAt author { __typename login } editor { __typename login }
        }
      }
    }`,
    variables: { id: ledgers[0].nodeId },
  });
  if (result.errors?.length) throw new Error("Unable to verify the runtime audit ledger.");
  const node = result.data?.node;
  const trusted = (actor) => actor?.__typename === "Bot" && ["github-actions", "github-actions[bot]"].includes(actor.login);
  return Boolean(trusted(node?.author) && (node.lastEditedAt === null || trusted(node.editor)) &&
    node.body?.startsWith(marker) && node.body.split("\n").includes(`${commit} ${sha256(text)}`));
}

export async function collectEvidence(options, { api = readOnlyApi, now = () => new Date() } = {}) {
  const repo = repository(options.repo);
  const intent = intentNumber(options.intent);
  const client = github(repo, api);
  const metadata = client.get("");
  if (metadata.full_name?.toLowerCase() !== repo) throw new Error("GitHub repository identity differs.");
  const parent = client.get(`issues/${intent}`);
  if (parent.pull_request || parent.number !== intent) throw new Error("--intent must identify an Issue, not a pull request.");
  const main = client.get(`branches/${encodeURIComponent(metadata.default_branch)}`).commit?.sha;
  if (!fullSha(main)) throw new Error("Cannot pin current repository configuration.");
  const config = validateHumanConfig(JSON.parse(contentFile(client.get(`contents/${configPath}?ref=${main}`))));
  const issues = [];
  const pullNumbers = new Set();
  const warnings = [];
  const stageIssues = client.list(`issues/${intent}/sub_issues`);
  if (stageIssues.length > 50) throw new Error("Too many sub-issues for a bounded replay.");
  for (const issue of [parent, ...stageIssues]) {
    if (!positive(issue.number) || (issue.repository_url && issue.repository_url.toLowerCase() !== `https://api.github.com/repos/${repo}`)) {
      throw new Error("Cross-repository or invalid sub-issue; review separately.");
    }
    issues.push(issueEvidence(issue, client.list(`issues/${issue.number}/comments`)));
    for (const event of client.list(`issues/${issue.number}/timeline`)) {
      const source = event.source?.issue;
      if (event.event === "cross-referenced" && source?.pull_request &&
          source.repository_url?.toLowerCase() === `https://api.github.com/repos/${repo}` &&
          positive(source.number)) pullNumbers.add(source.number);
    }
  }
  const recordRef = client.optional(`git/ref/heads/brownfield-runs/${intent}`);
  let record = null;
  let recordCommit = null;
  let recordTrusted = false;
  if (recordRef) {
    recordCommit = recordRef.object?.sha;
    if (!fullSha(recordCommit)) throw new Error("Runtime record ref is not an immutable commit.");
    const path = `docs/delivery-runs/brownfield-human-gated-delivery/${intent}/run-state.json`;
    const text = contentFile(client.get(`contents/${path}?ref=${recordCommit}`));
    record = validateRunRecord(JSON.parse(text), repo, intent);
    recordTrusted = await trustedRecord(api, issues[0].comments, recordCommit, text);
    if (!recordTrusted) warnings.push("Runtime branch is not attested by an unmodified trusted workflow ledger; it cannot authorize completion.");
    if (record.delivery) pullNumbers.add(record.delivery.pullNumber);
  } else warnings.push("No runtime record is accessible; this may be a legacy run or insufficient access. Delivery is not counted as accepted.");
  if (pullNumbers.size > 50) throw new Error("Too many linked PRs for a bounded replay.");
  const pulls = [];
  const runs = new Map();
  for (const number of pullNumbers) {
    const pull = client.get(`pulls/${number}`);
    if (!fullSha(pull.head?.sha)) throw new Error("PR head commit is invalid.");
    pulls.push({
      ...pull,
      timeline: client.list(`issues/${number}/timeline`),
      reviews: client.list(`pulls/${number}/reviews`),
      reviewComments: client.list(`pulls/${number}/comments`),
      checks: client.list(`commits/${pull.head.sha}/check-runs`, "check_runs"),
    });
    for (const run of client.list(`actions/runs?head_sha=${pull.head.sha}`, "workflow_runs")) runs.set(run.id, run);
  }
  if (record?.delivery) {
    const run = client.get(`actions/runs/${record.delivery.runId}`);
    runs.set(run.id, run);
  }
  const documents = [];
  let documentSnapshot = null;
  let documentReview = null;
  const documentRef = client.optional(`git/ref/heads/brownfield-documents/${intent}`);
  if (documentRef) {
    const sha = documentRef.object?.sha;
    if (!fullSha(sha)) throw new Error("Document ref is not an immutable commit.");
    const tree = client.get(`git/trees/${sha}?recursive=1`);
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("Document tree is incomplete.");
    for (const name of ["spec.md", "plan.md", "document-review.json"]) {
      const path = `docs/delivery-runs/brownfield-human-gated-delivery/${intent}/${name}`;
      if (tree.tree.some((item) => item.type === "blob" && item.path === path)) {
        documents.push({ path, commit: sha, url: `https://github.com/${repo}/blob/${sha}/${path}` });
      }
    }
    const stateLink = documents.find((document) => document.path.endsWith("/document-review.json"));
    if (stateLink) {
      const raw = contentFile(client.get(`contents/${stateLink.path}?ref=${sha}`));
      const state = validateReviewProfile(JSON.parse(raw), intent);
      const texts = {};
      for (const stage of ["spec", "plan"]) {
        const link = documents.find((document) => document.path.endsWith(`/${stage}.md`));
        if (link) texts[stage] = contentFile(client.get(`contents/${link.path}?ref=${sha}`)).toString("utf8");
      }
      const trusted = await trustedRecord(api, issues[0].comments, sha, raw,
        "<!-- brownfield-human-gated-delivery-document-ledger -->");
      documentSnapshot = { commit: sha, path: stateLink.path, state, texts, trusted };
      documentReview = {
        ...documentEvidence({ record, config, issues, summary: { intent } }, state, texts, trusted),
        recordUrl: stateLink.url,
      };
      if (!documentReview.verified) warnings.push("Document handoff is not corroborated; inspect documentReview.reasons. Recorded discovery readiness alone is not verified Human approval.");
    } else warnings.push("No document review state is available; document links alone cannot establish discovery readiness or approval.");
  }
  const acceptance = acceptanceEvidence(record, issues, pulls, [...runs.values()], config, recordTrusted);
  const summary = {
    version: 1, mode: "read-only-replay", live: false,
    capturedAt: now().toISOString(), repository: repo, intent,
    currentGitHubIssueState: parent.state, inspectedConfigCommit: main,
    recordCommit, recordTrusted, executionMode: record?.mode ?? null, runtimeStatus: record?.status ?? null,
    acceptance, documents, documentReview, warnings,
    recordUrl: recordCommit ? `https://github.com/${repo}/blob/${recordCommit}/docs/delivery-runs/brownfield-human-gated-delivery/${intent}/run-state.json` : null,
    scenarioRunsCompleted: "Not assessed. A single replay cannot prove three live scenario runs.",
  };
  return { summary, record, issues, pulls, workflows: [...runs.values()], config, documentSnapshot };
}

export async function replay(options, dependencies = {}) {
  const destination = newDestination(options.dest);
  const evidence = await collectEvidence(options, dependencies);
  const { summary, issues, pulls, workflows } = evidence;
  const { repository: repo, intent, acceptance, documents } = summary;
  const links = [
    { title: `Intent #${intent}`, url: `https://github.com/${repo}/issues/${intent}` },
    ...(summary.recordUrl ? [{ title: "Immutable runtime record", url: summary.recordUrl }] : []),
    ...documents.map((document) => ({ title: document.path, url: document.url })),
    ...pulls.map((pull) => ({ title: `PR #${pull.number}`, url: `https://github.com/${repo}/pull/${pull.number}` })),
    ...workflows.filter((run) => positive(run.id)).map((run) => ({
      title: `Workflow run ${run.id}`, url: `https://github.com/${repo}/actions/runs/${run.id}`,
    })),
  ];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Brownfield evidence replay</title></head>
<body><h1>Read-only replay — NOT LIVE</h1>
<p>Snapshot of actual GitHub evidence at ${escapeHtml(summary.capturedAt)}.
Issue closure, generated prose, and successful tests alone are not Human acceptance.</p>
<p>Delivery acceptance corroborated: <strong>${acceptance.complete ? "yes" : "no"}</strong>.</p>
<p>Document handoff corroborated: <strong>${summary.documentReview?.verified ? "yes" : "no"}</strong>.
Recorded discovery readiness alone does not prove trusted Human decisions or semantic correctness.
Decision receipt history relies on the document audit ledger; historical Spec texts are not independently fetched.</p>
<ul>${links.map((link) => `<li><a rel="noreferrer" href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a></li>`).join("\n")}</ul>
<h2>Evidence (untrusted text displayed literally)</h2><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></body></html>
`;
  mkdirSync(destination, { mode: 0o700 });
  writeFileSync(join(destination, "index.html"), html, { flag: "wx", mode: 0o600 });
  writeFileSync(join(destination, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  writeFileSync(join(destination, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return { destination, summary };
}
