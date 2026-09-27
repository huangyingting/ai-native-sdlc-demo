import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  artifactPaths,
  countHumanApprovals,
  isAuthorizedAssociation,
  isCopilotActor,
  lifecycleBranch,
  loadConfig,
  nextStage,
  normalizeCopilotStageBody,
  parsePullRequestMetadata,
  renderPrompt,
  stages,
  validateStageFiles,
} from "./core.mjs";

const apiVersion = "2026-03-10";
const demoName = "brownfield-human-gated-delivery";
const intentLabel = `${demoName}:intent`;
const stageLabelPrefix = `${demoName}:`;
const stageWorkItemLabel = `${demoName}:stage`;
const progressMarker = `<!-- ${demoName}-progress -->`;
const policyMarker = `<!-- ${demoName}-policy -->`;
export const policyStatus = "Brownfield delivery policy";

function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error("GITHUB_EVENT_PATH is required.");
  return JSON.parse(readFileSync(path, "utf8"));
}

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function repositoryCoordinates() {
  const [owner, repo] = String(process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be owner/repo.");
  return { owner, repo };
}

export async function githubRequest(token, path, options = {}) {
  if (!token) throw new Error(`A GitHub token is required for ${path}.`);
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": apiVersion,
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `GitHub API ${options.method ?? "GET"} ${path} failed ` +
      `(${response.status}): ${body?.message ?? text}`,
    );
  }
  return body;
}

export async function graphql(token, query, variables) {
  const response = await githubRequest(token, "/graphql", {
    method: "POST",
    headers: {
      "GraphQL-Features":
        "issues_copilot_assignment_api_support,coding_agent_model_selection",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (response.errors?.length) {
    throw new Error(`GitHub GraphQL failed: ${response.errors.map((item) => item.message).join("; ")}`);
  }
  return response.data;
}

export async function listAll(token, path) {
  const separator = path.includes("?") ? "&" : "?";
  const items = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubRequest(
      token,
      `${path}${separator}per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) throw new Error(`Expected an array from ${path}.`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

function hasLabel(issue, label) {
  return issue.labels?.some((item) =>
    (typeof item === "string" ? item : item.name) === label);
}

function stageFromBody(body) {
  const match = String(body ?? "").match(
    /^Delivery Stage:\s*(spec|plan|tests|implementation)\s*$/im,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

function intentFromBody(body) {
  const match = String(body ?? "").match(
    /^Delivery Intent:\s*#([1-9]\d*)\s*$/im,
  );
  return match ? Number(match[1]) : null;
}

export async function ensureLabel(token, owner, repo, name, color, description) {
  try {
    return await githubRequest(token, `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    if (!String(error.message).includes("(404)")) throw error;
  }
  return githubRequest(token, `/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({ name, color, description }),
  });
}

async function ensureLifecycleBranch(token, owner, repo, defaultBranch, intentNumber) {
  const branch = lifecycleBranch(intentNumber);
  const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
  try {
    await githubRequest(token, `/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`);
    return branch;
  } catch (error) {
    if (!String(error.message).includes("(404)")) throw error;
  }
  const base = await githubRequest(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
  );
  await githubRequest(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: base.object.sha,
    }),
  });
  return branch;
}

function stageIssueTitle(intentNumber, stage, intentTitle) {
  const label = stage === "spec" ? "Spec review" :
    stage === "plan" ? "Plan review" :
    stage === "tests" ? "TDD Tests" :
    stage[0].toUpperCase() + stage.slice(1);
  const conciseIntent = intentTitle
    .replace(/^\[Brownfield delivery\]\s*/i, "")
    .trim();
  return `[Brownfield Delivery #${intentNumber}][${label}] ${conciseIntent}`;
}

function stageIssueBody(intentNumber, stage, stageIssueNumber = null, issueDocuments = false) {
  return [
    `Delivery Demo: ${demoName}`,
    `Delivery Intent: #${intentNumber}`,
    `Delivery Stage: ${stage}`,
    stageIssueNumber ? `Delivery Stage Issue: #${stageIssueNumber}` : "",
    issueDocuments ? "Delivery Document Review: issue-v1" : "",
    "",
    `This is the **${stage}** stage for Intent #${intentNumber}.`,
    "The workflow assigns this Issue when all preceding human review gates are complete.",
    issueDocuments && ["spec", "plan"].includes(stage)
      ? `Read, discuss, and approve document versions on parent Intent #${intentNumber}. Use /sdlc revise ${stage} followed by feedback, or /sdlc approve ${stage} vN. No document PR is created.`
      : "Review is iterative: use Request changes and ask @copilot to address feedback in the same pull request. Repeat until the configured Human reviewers explicitly approve the latest revision.",
    issueDocuments
      ? "Only approved Spec and Plan snapshots start TDD. Tests and implementation advance after approved PRs pass checks and merge."
      : "Only approval plus passing required checks permits merging; the next stage starts after merge, not after comments or CI alone.",
    "Do not close this Issue manually; lifecycle automation closes it when its gate completes.",
  ].filter(Boolean).join("\n");
}

export async function ensureStageIssues(token, owner, repo, parentIssue, issueDocuments = false) {
  const subIssues = await listAll(
    token,
    `/repos/${owner}/${repo}/issues/${parentIssue.number}/sub_issues`,
  );
  const byStage = new Map(
    subIssues.map((issue) => [stageFromBody(issue.body), issue]).filter(([stage]) => stage),
  );
  const repositoryStages = await listAll(
    token,
    `/repos/${owner}/${repo}/issues?state=all&labels=${encodeURIComponent(stageWorkItemLabel)}`,
  );
  for (const stage of stages) {
    if (byStage.has(stage)) continue;
    let created = repositoryStages.find((issue) =>
      !issue.pull_request &&
      intentFromBody(issue.body) === parentIssue.number &&
      stageFromBody(issue.body) === stage);
    if (!created) {
      created = await githubRequest(token, `/repos/${owner}/${repo}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: stageIssueTitle(parentIssue.number, stage, parentIssue.title),
          body: stageIssueBody(parentIssue.number, stage, null, issueDocuments),
          labels: [stageWorkItemLabel, `${stageLabelPrefix}${stage}`],
        }),
      });
      await githubRequest(
        token,
        `/repos/${owner}/${repo}/issues/${created.number}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            body: stageIssueBody(parentIssue.number, stage, created.number, issueDocuments),
          }),
        },
      );
      created = {
        ...created,
        body: stageIssueBody(parentIssue.number, stage, created.number, issueDocuments),
      };
    }
    if (!String(created.body ?? "").includes("Delivery Stage Issue:")) {
      const body = stageIssueBody(parentIssue.number, stage, created.number, issueDocuments);
      await githubRequest(
        token,
        `/repos/${owner}/${repo}/issues/${created.number}`,
        { method: "PATCH", body: JSON.stringify({ body }) },
      );
      created = { ...created, body };
    }
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/issues/${parentIssue.number}/sub_issues`,
      {
        method: "POST",
        body: JSON.stringify({ sub_issue_id: created.id }),
      },
    );
    byStage.set(stage, created);
  }
  return stages.map((stage) => byStage.get(stage));
}

function progressBody(parentIssue, stageIssues, current = {}) {
  const rows = stageIssues.map((issue) => {
    const stage = stageFromBody(issue.body);
    const status = current.stage === stage
      ? current.status
      : issue.state === "closed" ? "Complete" :
        issue.assignees?.some(isCopilotActor)
          ? "Copilot working"
          : "Waiting";
    const evidence = current.stage === stage && current.pullRequestUrl
      ? ` · [PR](${current.pullRequestUrl})${current.documentUrl ? ` · [Read document](${current.documentUrl})` : ""}`
      : "";
    return `| ${stage} | [#${issue.number}](${issue.html_url})${evidence} | ${status} |`;
  });
  return [
    progressMarker,
    "## Brownfield human-gated delivery progress",
    "",
    `Lifecycle branch: \`${lifecycleBranch(parentIssue.number)}\``,
    "",
    "| Stage | Work item | Status |",
    "|---|---|---|",
    ...rows,
    "",
    "For Spec and Plan, use **Request changes** and an `@copilot` comment to request revisions in the same pull request. Repeat until the configured Human reviewers **Approve** the latest revision; new commits require reapproval.",
    "The next stage starts only after the approved PR passes required checks and merges. Comments and resolved threads do not count as approval.",
    "",
    "The parent Intent closes only after the final image digest passes delivery verification.",
  ].join("\n");
}

async function updateProgress(token, owner, repo, parentIssue, stageIssues, current) {
  if (stageIssues.some((issue) => issue.body?.includes("Delivery Document Review: issue-v1"))) {
    const { DocumentReview } = await import("./documents.mjs");
    const review = new DocumentReview({ token, owner, repo, config: loadConfig() });
    const snapshot = await review.load(parentIssue.number);
    if (!snapshot) throw new Error("Missing Issue document review history.");
    return review.hub(parentIssue, snapshot, stageIssues, current);
  }
  const comments = await listAll(
    token,
    `/repos/${owner}/${repo}/issues/${parentIssue.number}/comments`,
  );
  const existing = comments.find((comment) => comment.body?.includes(progressMarker));
  const documentUrl = current?.headSha && ["spec", "plan"].includes(current.stage)
    ? `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(current.headSha)}/${artifactPaths(parentIssue.number)[current.stage]}`
    : null;
  const body = progressBody(parentIssue, stageIssues, { ...current, documentUrl });
  if (existing) {
    return githubRequest(token, `/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  }
  return githubRequest(
    token,
    `/repos/${owner}/${repo}/issues/${parentIssue.number}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
}

export async function assignCopilot(
  token,
  owner,
  repo,
  issue,
  stage,
  intentNumber,
  baseRef,
  config,
) {
  const refreshed = await githubRequest(
    token,
    `/repos/${owner}/${repo}/issues/${issue.number}`,
  );
  if (refreshed.assignees?.some(isCopilotActor)) {
    return;
  }
  const actorData = await graphql(token, `
    query CopilotActor($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
        suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
          nodes {
            __typename
            ... on Bot { id login }
            ... on User { id login }
          }
        }
      }
    }
  `, { owner, repo });
  const repository = actorData.repository;
  const actor = repository?.suggestedActors?.nodes?.find(isCopilotActor);
  if (!repository?.id || !actor?.id) {
    throw new Error("Copilot Coding Agent is not available for this repository.");
  }
  const template = readFileSync(config.stages[stage].prompt, "utf8");
  const instructions = [
    renderPrompt(template, {
      intent: intentNumber,
      stage_issue: issue.number,
    }),
    "",
    `Parent Intent: https://github.com/${owner}/${repo}/issues/${intentNumber}`,
    `Stage Issue: ${issue.html_url}`,
    `Base branch: ${baseRef}`,
  ].join("\n");
  await graphql(token, `
    mutation AssignCopilot(
      $assignableId: ID!,
      $actorIds: [ID!]!,
      $repositoryId: ID!,
      $baseRef: String!,
      $instructions: String!
    ) {
      replaceActorsForAssignable(input: {
        assignableId: $assignableId,
        actorIds: $actorIds,
        agentAssignment: {
          targetRepositoryId: $repositoryId,
          baseRef: $baseRef,
          customInstructions: $instructions
        }
      }) {
        assignable { ... on Issue { id number } }
      }
    }
  `, {
    assignableId: issue.node_id,
    actorIds: [actor.id],
    repositoryId: repository.id,
    baseRef,
    instructions,
  });
}

async function getParentIssue(token, owner, repo, stageIssueNumber) {
  return githubRequest(
    token,
    `/repos/${owner}/${repo}/issues/${stageIssueNumber}/parent`,
  );
}

async function validateStageContext(token, owner, repo, pullRequest, { deliveryRetry = false } = {}) {
  const metadata = parsePullRequestMetadata(pullRequest.body);
  const stageIssue = await githubRequest(
    token,
    `/repos/${owner}/${repo}/issues/${metadata.stageIssueNumber}`,
  );
  if (stageIssue.body?.includes("Delivery Document Review: issue-v1")) {
    const { DocumentReview } = await import("./documents.mjs");
    await new DocumentReview({ token, owner, repo, config: loadConfig() })
      .verifyPullRequest(metadata.intentNumber, metadata.stage, pullRequest);
    if (!deliveryRetry) {
      const { RunControl } = await import("./runs.mjs");
      await new RunControl({ token, owner, repo, config: loadConfig() }).assertActive(metadata.intentNumber);
    }
  }
  if (!hasLabel(stageIssue, `${stageLabelPrefix}${metadata.stage}`)) {
    throw new Error(`Stage Issue #${stageIssue.number} has the wrong stage label.`);
  }
  const issueMetadata = parsePullRequestMetadata(stageIssue.body);
  if (
    issueMetadata.intentNumber !== metadata.intentNumber ||
    issueMetadata.stage !== metadata.stage ||
    issueMetadata.stageIssueNumber !== metadata.stageIssueNumber
  ) {
    throw new Error("Pull request markers do not match the stage Issue.");
  }
  const parent = await getParentIssue(token, owner, repo, stageIssue.number);
  if (parent.number !== metadata.intentNumber || !hasLabel(parent, intentLabel)) {
    throw new Error("Pull request metadata does not match its parent Intent.");
  }
  if (parent.state !== "open" &&
      !(deliveryRetry && pullRequest.merged && metadata.stage === "implementation")) {
    throw new Error("Parent Intent is not open.");
  }
  const stageIssues = await listAll(
    token,
    `/repos/${owner}/${repo}/issues/${parent.number}/sub_issues`,
  );
  const currentIndex = stages.indexOf(metadata.stage);
  for (let index = 0; index < stages.length; index += 1) {
    const expectedStage = stages[index];
    const issue = stageIssues.find((item) => stageFromBody(item.body) === expectedStage);
    if (!issue) throw new Error(`Missing ${expectedStage} stage Issue.`);
    if (index < currentIndex && issue.state !== "closed") {
      throw new Error(`${metadata.stage} cannot start before ${expectedStage} is complete.`);
    }
    if (index > currentIndex && issue.state !== "open") {
      throw new Error(`Later ${expectedStage} stage is not waiting in an open state.`);
    }
  }
  if (
    !pullRequest.merged &&
    !stageIssue.assignees?.some(isCopilotActor)
  ) {
    throw new Error("The stage Issue is not assigned to Copilot Coding Agent.");
  }
  const repository = await githubRequest(token, `/repos/${owner}/${repo}`);
  if (pullRequest.head?.repo?.full_name?.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) {
    throw new Error("Stage pull requests must use a branch in this repository.");
  }
  const lifecycle = lifecycleBranch(parent.number);
  const allowedBase = metadata.stage === "implementation"
    ? [lifecycle, repository.default_branch]
    : [lifecycle];
  if (!allowedBase.includes(pullRequest.base.ref)) {
    throw new Error(
      `${metadata.stage} PR targets ${pullRequest.base.ref}; expected ${allowedBase.join(" or ")}.`,
    );
  }
  if (deliveryRetry && pullRequest.base.ref !== repository.default_branch) {
    throw new Error("Delivery requires an implementation merged into the default branch.");
  }
  if (!isCopilotActor(pullRequest.user)) {
    throw new Error("Stage pull requests must be created by Copilot Coding Agent.");
  }
  return { metadata, stageIssue, stageIssues, parent, repository };
}

export async function resolveTeamMembers(token, owner, teams) {
  const members = new Set();
  for (const team of teams) {
    const teamMembers = await listAll(
      token,
      `/orgs/${owner}/teams/${encodeURIComponent(team)}/members`,
    );
    for (const member of teamMembers) members.add(member.login);
  }
  return [...members];
}

export async function kickoff() {
  const event = readEvent();
  const config = loadConfig();
  const token = process.env.GITHUB_TOKEN;
  const copilotToken = process.env.COPILOT_ASSIGN_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  const issue = event.issue ?? (
    process.env.INTENT_ISSUE_NUMBER
      ? await githubRequest(
          token,
          `/repos/${owner}/${repo}/issues/${Number(process.env.INTENT_ISSUE_NUMBER)}`,
        )
      : null
  );
  if (!issue || !hasLabel(issue, intentLabel)) {
    throw new Error(`Kickoff requires a ${intentLabel} Issue.`);
  }
  if (!isAuthorizedAssociation(issue.author_association)) {
    throw new Error(`Unauthorized Intent author association: ${issue.author_association}`);
  }
  const repository = await githubRequest(token, `/repos/${owner}/${repo}`);
  const branch = await ensureLifecycleBranch(
    token,
    owner,
    repo,
    repository.default_branch,
    issue.number,
  );
  await ensureLabel(
    token,
    owner,
    repo,
    stageWorkItemLabel,
    "5319e7",
    "Brownfield human-gated delivery stage work item",
  );
  const colors = {
    spec: "1d76db",
    plan: "8250df",
    tests: "d4c5f9",
    implementation: "0e8a16",
  };
  for (const stage of stages) {
    await ensureLabel(
      token,
      owner,
      repo,
      `${stageLabelPrefix}${stage}`,
      colors[stage],
      `Brownfield human-gated delivery ${stage} stage`,
    );
  }
  const stageIssues = await ensureStageIssues(token, owner, repo, issue);
  await updateProgress(token, owner, repo, issue, stageIssues, {
    stage: "spec",
    status: "Copilot assignment pending",
  });
  await assignCopilot(
    copilotToken,
    owner,
    repo,
    stageIssues[0],
    "spec",
    issue.number,
    branch,
    config,
  );
  await updateProgress(token, owner, repo, issue, stageIssues, {
    stage: "spec",
    status: "Copilot working",
  });
}

export async function intake(currentPullRequest) {
  const event = readEvent();
  const config = loadConfig();
  const token = process.env.GITHUB_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  const pullRequest = currentPullRequest ?? event.pull_request;
  if (!pullRequest) throw new Error("Pull request event is required.");
  const body = normalizeCopilotStageBody(pullRequest.body, pullRequest.user);
  const context = await validateStageContext(token, owner, repo, { ...pullRequest, body });
  if (body !== pullRequest.body) {
    const current = await getPullRequest(token, owner, repo, pullRequest.number);
    if (policySnapshot(current) !== policySnapshot(pullRequest)) {
      throw new Error("PR changed before generated closing suffix repair; retry current metadata.");
    }
    // Persist the repair with the user token so body-edited CI runs again.
    await githubRequest(process.env.COPILOT_ASSIGN_TOKEN, `/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    return;
  }
  if (
    context.metadata.stage === "implementation" &&
    pullRequest.base.ref !== context.repository.default_branch
  ) {
    // A GITHUB_TOKEN edit suppresses the pull_request CI run for the new base.
    await githubRequest(process.env.COPILOT_ASSIGN_TOKEN, `/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
      method: "PATCH",
      body: JSON.stringify({ base: context.repository.default_branch }),
    });
  }
  if (["spec", "plan"].includes(context.metadata.stage)) {
    const title = stageIssueTitle(context.parent.number, context.metadata.stage, context.parent.title);
    if (pullRequest.title !== title) {
      await githubRequest(token, `/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
    }
  }
  if (pullRequest.draft) {
    await updateProgress(token, owner, repo, context.parent, context.stageIssues, {
      stage: context.metadata.stage,
      status: "Copilot working; draft PR",
      pullRequestUrl: pullRequest.html_url,
      headSha: pullRequest.head.sha,
    });
    return;
  }
  const policy = config.stages[context.metadata.stage];
  await githubRequest(
    token,
    `/repos/${owner}/${repo}/pulls/${pullRequest.number}/requested_reviewers`,
    {
      method: "POST",
      body: JSON.stringify({
        reviewers: policy.reviewers.users,
        team_reviewers: policy.reviewers.teams,
      }),
    },
  );
  await updateProgress(token, owner, repo, context.parent, context.stageIssues, {
    stage: context.metadata.stage,
    status: "Human review required",
    pullRequestUrl: pullRequest.html_url,
    headSha: pullRequest.head.sha,
  });
}

async function writePolicyStatus(token, owner, repo, pullRequest, state, description) {
  if (!pullRequest.head?.sha) throw new Error("Pull request head SHA is required.");
  await githubRequest(token, `/repos/${owner}/${repo}/statuses/${pullRequest.head.sha}`, {
    method: "POST",
    body: JSON.stringify({
      context: policyStatus,
      state,
      description: description.slice(0, 140),
      target_url: pullRequest.html_url,
    }),
  });
}

async function disableAutoMerge(token, pullRequest) {
  if (!pullRequest.auto_merge) return;
  await graphql(token, `
    mutation DisableAutoMerge($pullRequestId: ID!) {
      disablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId}) {
        pullRequest { id }
      }
    }
  `, { pullRequestId: pullRequest.node_id });
}

async function getPullRequest(token, owner, repo, number) {
  return githubRequest(token, `/repos/${owner}/${repo}/pulls/${number}`);
}

async function lifecycleRegistration(token, owner, repo, pullRequest, event) {
  const comments = await listAll(token, `/repos/${owner}/${repo}/issues/${pullRequest.number}/comments`);
  const registered = comments.some((comment) => comment.body?.includes(policyMarker));
  const candidate = registered || [
    pullRequest.body, event.pull_request?.body, event.changes?.body?.from,
  ].some((body) => /Delivery (?:Demo|Intent|Stage):/i.test(body ?? "")) ||
    [pullRequest.base?.ref, event.changes?.base?.ref?.from]
      .some((ref) => ref?.startsWith("brownfield-delivery/"));
  return { candidate, registered };
}

export async function classify() {
  const event = readEvent();
  const { owner, repo } = repositoryCoordinates();
  const token = process.env.GITHUB_TOKEN;
  const pullRequest = await getPullRequest(token, owner, repo, event.pull_request.number);
  const { candidate } = await lifecycleRegistration(token, owner, repo, pullRequest, event);
  appendOutput("lifecycle", candidate);
  if (!candidate) return;
  if (pullRequest.head.sha !== event.pull_request.head.sha) throw new Error("PR head changed; run current CI.");
  const metadata = parsePullRequestMetadata(pullRequest.body);
  appendOutput("intent", metadata.intentNumber);
  appendOutput("stage", metadata.stage);
  appendOutput("stage-issue", metadata.stageIssueNumber);
}

async function evaluateReview(token, mergeToken, owner, repo, pullRequest) {
  const config = loadConfig();
  const context = await validateStageContext(token, owner, repo, pullRequest);
  const files = await listAll(token, `/repos/${owner}/${repo}/pulls/${pullRequest.number}/files`);
  if (!Number.isInteger(pullRequest.changed_files) || files.length !== pullRequest.changed_files) {
    throw new Error("Incomplete PR file list; cannot enforce trusted stage scope.");
  }
  const paths = files.flatMap((file) => {
    if (!file || typeof file.filename !== "string" || !file.filename ||
        !["added", "modified", "removed", "renamed", "copied", "changed", "unchanged"].includes(file.status) ||
        (file.previous_filename !== undefined && (typeof file.previous_filename !== "string" || !file.previous_filename)) ||
        (file.status === "renamed" && !file.previous_filename)) {
      throw new Error("Malformed PR file or missing rename source.");
    }
    return file.previous_filename ? [file.previous_filename, file.filename] : [file.filename];
  });
  validateStageFiles(context.metadata.stage, paths, context.metadata.intentNumber, config.project.path,
    context.stageIssue.body.includes("Delivery Document Review: issue-v1"));
  const policy = config.stages[context.metadata.stage];
  const reviews = await listAll(token, `/repos/${owner}/${repo}/pulls/${pullRequest.number}/reviews`);
  const teamMembers = await resolveTeamMembers(mergeToken, owner, policy.reviewers.teams);
  const approval = countHumanApprovals(reviews, policy, pullRequest.user.login, teamMembers, pullRequest.head.sha);
  return {
    context,
    mergeMethod: config.mergeMethod.toUpperCase(),
    satisfied: approval.satisfied && !pullRequest.draft,
    status: pullRequest.draft ? "Draft PR requires review" : approval.changesRequested.length
      ? `Changes requested by ${approval.changesRequested.join(", ")}`
      : `${approval.approved.length}/${policy.minimumApprovals} human approvals`,
  };
}

function policySnapshot(pullRequest) {
  return JSON.stringify([
    pullRequest.head?.sha, pullRequest.base?.ref, pullRequest.base?.sha,
    pullRequest.body, pullRequest.draft, pullRequest.state,
  ]);
}

export async function coordinate() {
  const event = readEvent();
  const token = process.env.GITHUB_TOKEN;
  const mergeToken = process.env.COPILOT_ASSIGN_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  if (event.workflow_run && !["pull_request_review", "pull_request"].includes(event.workflow_run.event)) return;
  // Pending runs can be replaced. Reconcile all open PRs, aggregating by SHA:
  // commit statuses belong to a commit, not to an individual pull request.
  const candidates = await listAll(token, `/repos/${owner}/${repo}/pulls?state=open`);
  const groups = new Map();
  const failures = [];
  const changedHeads = new Set();
  async function recordCurrent(decision, current) {
    decision.current = current;
    if (policySnapshot(current) !== policySnapshot(decision.pr)) {
      changedHeads.add(decision.pr.head.sha);
      changedHeads.add(current.head.sha);
      await writePolicyStatus(token, owner, repo, current, "pending", "PR changed; waiting for current validation");
    }
  }
  async function refresh(decision) {
    await recordCurrent(decision, await getPullRequest(token, owner, repo, decision.pr.number));
  }
  for (const candidate of candidates) {
    const decision = { pr: candidate, current: candidate, satisfied: false };
    let group;
    try {
      decision.pr = await getPullRequest(token, owner, repo, candidate.number);
      decision.current = decision.pr;
      if (decision.pr.state !== "open") continue;
    } catch (error) {
      decision.error = error;
      failures.push(error);
    }
    try {
      const sha = decision.pr.head.sha;
      group = groups.get(sha);
      if (!group) {
        group = { pr: decision.pr, decisions: [] };
        groups.set(sha, group);
        await writePolicyStatus(token, owner, repo, group.pr, "pending", "Evaluating all pull requests sharing this head");
      }
      group.decisions.push(decision);
      if (decision.error) continue;
      const ownEvent = event.pull_request?.number === candidate.number ? event : {};
      const registration = await lifecycleRegistration(token, owner, repo, decision.pr, ownEvent);
      if (!registration.candidate) {
        decision.satisfied = true;
        continue;
      }
      if (!registration.registered) {
        await githubRequest(token, `/repos/${owner}/${repo}/issues/${candidate.number}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: `${policyMarker}\nThis PR is registered for lifecycle policy validation; removing body markers does not opt out.` }),
        });
      }
      if (!registration.registered || ownEvent.pull_request ||
          normalizeCopilotStageBody(decision.pr.body, decision.pr.user) !== decision.pr.body ||
          (stageFromBody(decision.pr.body) === "implementation" &&
           decision.pr.base.ref.startsWith("brownfield-delivery/"))) {
        await intake(decision.pr);
        const current = await getPullRequest(token, owner, repo, candidate.number);
        // Intake may intentionally retarget the base, but must not approve a different head or body.
        if (current.head.sha !== sha || current.body !== decision.pr.body ||
            current.draft !== decision.pr.draft || current.state !== "open") {
          await recordCurrent(decision, current);
          continue;
        }
        decision.pr = current;
        decision.current = current;
      }
      Object.assign(decision, await evaluateReview(token, mergeToken, owner, repo, decision.pr));
    } catch (error) {
      decision.error = error;
      if (group && !group.decisions.includes(decision)) group.decisions.push(decision);
      failures.push(error);
    }
  }
  // Complete every decision before publishing any success, including when heads converge.
  for (const group of groups.values()) {
    for (const decision of group.decisions) {
      try {
        await refresh(decision);
      } catch (error) {
        decision.error = error;
        failures.push(error);
      }
    }
  }
  for (const [sha, group] of groups) {
    let state = changedHeads.has(sha) ? "pending" :
      group.decisions.every((decision) => decision.satisfied && !decision.error) ? "success" : "failure";
    try {
      if (state === "success") {
        // Keep the aggregate required status pending until every auto-merge mutation completes.
        for (const decision of group.decisions) {
          if (!decision.context || decision.current.auto_merge) continue;
          await graphql(mergeToken, `
            mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
              enablePullRequestAutoMerge(input: {pullRequestId: $pullRequestId, mergeMethod: $mergeMethod}) {
                pullRequest { id autoMergeRequest { enabledAt } }
              }
            }
          `, { pullRequestId: decision.pr.node_id, mergeMethod: decision.mergeMethod });
          decision.current.auto_merge = true;
        }
        for (const decision of group.decisions) await refresh(decision);
        for (const decision of group.decisions) {
          if (!decision.context?.stageIssue.body?.includes("Delivery Document Review: issue-v1")) continue;
          const { RunControl } = await import("./runs.mjs");
          await new RunControl({ token, owner, repo, config: loadConfig() })
            .assertActive(decision.context.metadata.intentNumber);
        }
        if (changedHeads.has(sha)) state = "pending";
      }
      for (const decision of group.decisions) {
        if (!decision.context) continue;
        const { context } = decision;
        await updateProgress(token, owner, repo, context.parent, context.stageIssues, {
          stage: context.metadata.stage,
          status: state === "success" ? "Human approved; waiting for required checks and auto-merge" :
            `Shared-head policy blocked: ${decision.status}`,
          pullRequestUrl: decision.pr.html_url,
          headSha: decision.pr.head.sha,
        });
      }
    } catch (error) {
      state = "failure";
      failures.push(error);
    }
    if (state !== "success") {
      const results = await Promise.allSettled(group.decisions.map((decision) =>
        disableAutoMerge(mergeToken, decision.current)));
      for (const result of results) if (result.status === "rejected") failures.push(result.reason);
    }
    try {
      await writePolicyStatus(token, owner, repo, group.pr, state, state === "success"
        ? group.decisions.some((decision) => decision.context)
          ? "All lifecycle policies sharing this head are satisfied" : "Not a lifecycle pull request"
        : "One or more PRs sharing this head require validation or human approval");
    } catch (error) {
      failures.push(error);
      const results = await Promise.allSettled(group.decisions.map((decision) =>
        disableAutoMerge(mergeToken, decision.current)));
      for (const result of results) if (result.status === "rejected") failures.push(result.reason);
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
  }
}

export async function review() {
  return coordinate();
}

export async function advance() {
  const event = readEvent();
  const config = loadConfig();
  const token = process.env.GITHUB_TOKEN;
  const copilotToken = process.env.COPILOT_ASSIGN_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  const pullRequest = event.pull_request;
  if (!pullRequest?.merged) throw new Error("Advance requires a merged pull request.");
  const context = await validateStageContext(token, owner, repo, pullRequest);
  if (context.stageIssue.state !== "closed") {
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/issues/${context.stageIssue.number}`,
      {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      },
    );
  }
  const stageIssues = await listAll(
    token,
    `/repos/${owner}/${repo}/issues/${context.parent.number}/sub_issues`,
  );
  const followingStage = nextStage(context.metadata.stage);
  if (!followingStage) {
    await updateProgress(token, owner, repo, context.parent, stageIssues, {
      stage: "implementation",
      status: "Merged; delivery verification running",
      pullRequestUrl: pullRequest.html_url,
    });
    return;
  }
  const followingIssue = stageIssues.find(
    (issue) => stageFromBody(issue.body) === followingStage,
  );
  if (!followingIssue) throw new Error(`Missing ${followingStage} stage Issue.`);
  await assignCopilot(
    copilotToken,
    owner,
    repo,
    followingIssue,
    followingStage,
    context.parent.number,
    lifecycleBranch(context.parent.number),
    config,
  );
  await updateProgress(token, owner, repo, context.parent, stageIssues, {
    stage: followingStage,
    status: "Copilot working",
  });
}

export async function verify() {
  const event = readEvent();
  const token = process.env.GITHUB_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  if (!event.pull_request) throw new Error("Pull request event is required.");
  const context = await validateStageContext(
    token,
    owner,
    repo,
    event.pull_request,
    { deliveryRetry: process.env.DELIVERY_RETRY === "true" },
  );
  if (process.env.DELIVERY_RETRY === "true" &&
      context.stageIssue.body?.includes("Delivery Document Review: issue-v1")) {
    const { RunControl } = await import("./runs.mjs");
    await new RunControl({ token, owner, repo, config: loadConfig() }).assertActive(context.metadata.intentNumber);
  }
  appendOutput("intent", context.metadata.intentNumber);
  appendOutput("stage", context.metadata.stage);
  appendOutput("stage-issue", context.metadata.stageIssueNumber);
}

export async function delivery() {
  const event = readEvent();
  const token = process.env.GITHUB_TOKEN;
  const { owner, repo } = repositoryCoordinates();
  const pullRequest = event.pull_request;
  if (!pullRequest?.merged) throw new Error("Delivery requires a merged pull request.");
  const context = await validateStageContext(token, owner, repo, pullRequest, { deliveryRetry: true });
  if (context.metadata.stage !== "implementation") {
    throw new Error("Only an implementation PR can complete delivery.");
  }
  const success = process.env.DELIVERY_SUCCESS === "true";
  const runUrl = process.env.RUN_URL;
  const image = process.env.IMAGE;
  const digest = process.env.DIGEST;
  if (context.stageIssue.body?.includes("Delivery Document Review: issue-v1")) {
    const { RunControl } = await import("./runs.mjs");
    const control = new RunControl({ token, owner, repo, config: loadConfig() });
    const documents = await control.load(context.parent.number);
    const run = await control.verification(context.parent.number, documents.state.baseline, {
      runId: process.env.GITHUB_RUN_ID, runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      image: image || "", digest: digest || "", mergeSha: pullRequest.merge_commit_sha,
      pullNumber: pullRequest.number, runUrl, verified: success,
    });
    await updateProgress(token, owner, repo, context.parent, context.stageIssues, {
      stage: "implementation", status: run.state.status === "accepted" ? "Complete; Human accepted" :
        success ? "Verified; awaiting Human acceptance" : "Verification failed",
      pullRequestUrl: pullRequest.html_url,
    });
    if (!success) throw new Error("Delivery verification failed; Human acceptance remains blocked.");
    return;
  }
  const stageIssues = await listAll(
    token,
    `/repos/${owner}/${repo}/issues/${context.parent.number}/sub_issues`,
  );
  await updateProgress(token, owner, repo, context.parent, stageIssues, {
    stage: "implementation",
    status: success ? "Delivered and smoke-tested" : "Delivery failed; remediation required",
    pullRequestUrl: pullRequest.html_url,
  });
  const body = success
    ? [
        "### Delivery verified",
        "",
        `- **Image:** \`${image}@${digest}\``,
        "- **Smoke test:** Passed",
        `- **Workflow:** [View run](${runUrl})`,
        "",
        "The reviewed implementation was published to GHCR and the exact digest passed the temporary deployment smoke test.",
      ].join("\n")
    : [
        "### Delivery verification failed",
        "",
        `- **Image publish:** ${process.env.PUBLISH_RESULT}`,
        `- **Smoke test:** ${process.env.VERIFY_RESULT}`,
        `- **Workflow:** [Inspect the failed run](${runUrl})`,
        "",
        "The Intent remains open and the lifecycle branch is retained for remediation.",
      ].join("\n");
  const receiptMarker = `<!-- ${demoName}-delivery:${pullRequest.number} -->`;
  const comments = await listAll(token, `/repos/${owner}/${repo}/issues/${context.parent.number}/comments`);
  const receipt = comments.find((comment) => comment.body?.includes(receiptMarker));
  await githubRequest(token, receipt
    ? `/repos/${owner}/${repo}/issues/comments/${receipt.id}`
    : `/repos/${owner}/${repo}/issues/${context.parent.number}/comments`, {
    method: receipt ? "PATCH" : "POST",
    body: JSON.stringify({ body: `${receiptMarker}\n${body}` }),
  });
  if (!success) {
    try {
      await githubRequest(token,
        `/repos/${owner}/${repo}/git/ref/heads/${lifecycleBranch(context.parent.number)}`);
    } catch (error) {
      if (!error.message.includes("(404)")) throw error;
      await githubRequest(token, `/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${lifecycleBranch(context.parent.number)}`,
          sha: pullRequest.merge_commit_sha,
        }),
      });
    }
    if (context.parent.state === "closed") {
      await githubRequest(
        token,
        `/repos/${owner}/${repo}/issues/${context.parent.number}`,
        {
          method: "PATCH",
          body: JSON.stringify({ state: "open", state_reason: "reopened" }),
        },
      );
    }
    throw new Error("Delivery verification failed; Intent remains open.");
  }
  if (context.stageIssue.state !== "closed") {
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/issues/${context.stageIssue.number}`,
      {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      },
    );
  }
  if (context.parent.state !== "closed") {
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/issues/${context.parent.number}`,
      {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      },
    );
  }
  try {
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/git/refs/heads/${lifecycleBranch(context.parent.number)}`,
      { method: "DELETE" },
    );
  } catch (error) {
    // An already-deleted ref is success; permissions and other failures must still surface.
    if (!/\((404|422)\)/.test(error.message)) throw error;
    try {
      await githubRequest(token,
        `/repos/${owner}/${repo}/git/ref/heads/${lifecycleBranch(context.parent.number)}`);
    } catch (readError) {
      if (readError.message.includes("(404)")) return;
      throw readError;
    }
    throw error;
  }
}

const commands = { kickoff, intake, review, advance, verify, delivery, classify, coordinate };
commands["route-kickoff"] = async () => {
  const { routeDocumentKickoff } = await import("./documents.mjs");
  await routeDocumentKickoff();
};
const command = process.argv[2];
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  command
) {
  if (!commands[command]) {
    throw new Error(`Unknown brownfield delivery command: ${command}`);
  }
  // Let this module finish evaluating before a command imports a module that
  // uses the shared GitHub helpers; top-level await would deadlock that cycle.
  commands[command]().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
