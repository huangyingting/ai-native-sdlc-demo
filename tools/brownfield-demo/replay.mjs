import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  configPath, fullSha, intentNumber, newDestination, positive, repository,
  reviewerLogin, sha256, validateHumanConfig,
} from "./common.mjs";
import { exactImage } from "./docker.mjs";
import { contentFile, github, readOnlyApi } from "./github.mjs";

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
  const workflowCommitMatches = run?.head_sha === delivery?.mergeSha ||
    (run?.event === "pull_request" && run.head_sha === pull?.head?.sha &&
      run.pull_requests?.some((item) => item.number === pull.number));
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
  }
  const acceptance = acceptanceEvidence(record, issues, pulls, [...runs.values()], config, recordTrusted);
  const summary = {
    version: 1, mode: "read-only-replay", live: false,
    capturedAt: now().toISOString(), repository: repo, intent,
    currentGitHubIssueState: parent.state, inspectedConfigCommit: main,
    recordCommit, recordTrusted, executionMode: record?.mode ?? null, runtimeStatus: record?.status ?? null, acceptance, documents, warnings,
    recordUrl: recordCommit ? `https://github.com/${repo}/blob/${recordCommit}/docs/delivery-runs/brownfield-human-gated-delivery/${intent}/run-state.json` : null,
    scenarioRunsCompleted: "Not assessed. A single replay cannot prove three live scenario runs.",
  };
  return { summary, record, issues, pulls, workflows: [...runs.values()], config };
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
<ul>${links.map((link) => `<li><a rel="noreferrer" href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a></li>`).join("\n")}</ul>
<h2>Evidence (untrusted text displayed literally)</h2><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></body></html>
`;
  mkdirSync(destination, { mode: 0o700 });
  writeFileSync(join(destination, "index.html"), html, { flag: "wx", mode: 0o600 });
  writeFileSync(join(destination, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  writeFileSync(join(destination, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return { destination, summary };
}
