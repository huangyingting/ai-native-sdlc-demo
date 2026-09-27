import { readFileSync } from "node:fs";

export const stages = Object.freeze(["spec", "plan", "tests", "implementation"]);
export const authorizedAssociations = Object.freeze([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

const closingReferencePattern =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*(?:#\d+|[\w.-]+\/[\w.-]+#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i;
const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const teamPattern = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,98}[A-Za-z0-9])?$/;

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value;
}

function requireExactKeys(value, allowed, name) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unknown ${name} key: ${key}`);
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
}

export function validateConfig(input) {
  const config = requireObject(input, "config");
  requireExactKeys(config, ["version", "mergeMethod", "project", "stages"], "config");
  if (config.version !== 1) throw new Error(`Unsupported config version: ${config.version}`);
  if (!["merge", "squash", "rebase"].includes(config.mergeMethod)) {
    throw new Error(`Unsupported merge method: ${config.mergeMethod}`);
  }

  const project = requireObject(config.project, "project");
  requireExactKeys(
    project,
    ["path", "testCommand", "lintCommand", "buildCommand"],
    "project",
  );
  for (const key of ["path", "testCommand", "lintCommand", "buildCommand"]) {
    requireString(project[key], `project.${key}`);
  }
  if (project.path.startsWith("/") || project.path.includes("..")) {
    throw new Error("project.path must stay inside the repository.");
  }

  const policies = requireObject(config.stages, "stages");
  requireExactKeys(policies, stages, "stages");
  for (const stage of stages) {
    const policy = requireObject(policies[stage], `stages.${stage}`);
    requireExactKeys(
      policy,
      ["prompt", "minimumApprovals", "reviewers"],
      `stages.${stage}`,
    );
    const prompt = requireString(policy.prompt, `stages.${stage}.prompt`);
    if (
      !prompt.startsWith(
        ".github/brownfield-human-gated-delivery/prompts/",
      ) ||
      prompt.includes("..")
    ) {
      throw new Error(`Unsafe prompt path for ${stage}: ${prompt}`);
    }
    if (!Number.isInteger(policy.minimumApprovals) || policy.minimumApprovals < 1) {
      throw new Error(`${stage} minimumApprovals must be a positive integer.`);
    }
    const reviewers = requireObject(policy.reviewers, `${stage} reviewers`);
    requireExactKeys(reviewers, ["users", "teams"], `${stage} reviewers`);
    if (!Array.isArray(reviewers.users) || !Array.isArray(reviewers.teams)) {
      throw new Error(`${stage} reviewers users and teams must be arrays.`);
    }
    const users = [...new Set(reviewers.users)];
    const teams = [...new Set(reviewers.teams)];
    if (users.some((login) => !loginPattern.test(login))) {
      throw new Error(`${stage} contains an invalid reviewer login.`);
    }
    if (teams.some((slug) => !teamPattern.test(slug))) {
      throw new Error(`${stage} contains an invalid reviewer team.`);
    }
    if (!teams.length && users.length < policy.minimumApprovals) {
      throw new Error(`${stage} minimumApprovals exceeds configured reviewers.`);
    }
  }
  return config;
}

export function loadConfig(
  path = new URL("../config.json", import.meta.url),
) {
  return validateConfig(JSON.parse(readFileSync(path, "utf8")));
}

export function isAuthorizedAssociation(association) {
  return authorizedAssociations.includes(String(association ?? "").toUpperCase());
}

export function isCopilotActor(actor) {
  return (actor?.type ?? actor?.__typename) === "Bot" &&
    ["copilot", "copilot-swe-agent", "copilot-swe-agent[bot]"]
      .includes(String(actor.login ?? "").toLowerCase());
}

export function lifecycleBranch(intentNumber) {
  if (!Number.isInteger(intentNumber) || intentNumber < 1) {
    throw new Error("Intent number must be a positive integer.");
  }
  return `brownfield-delivery/${intentNumber}`;
}

export function artifactPaths(intentNumber) {
  const root =
    `docs/delivery-runs/brownfield-human-gated-delivery/${intentNumber}`;
  return {
    root,
    spec: `${root}/spec.md`,
    plan: `${root}/plan.md`,
    expectedFailures: `${root}/expected-failures.json`,
  };
}

export function nextStage(stage) {
  const index = stages.indexOf(stage);
  if (index < 0) throw new Error(`Unknown delivery stage: ${stage}`);
  return stages[index + 1] ?? null;
}

function extractSingleMarker(body, label, valuePattern) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...String(body ?? "").matchAll(
      new RegExp(`^${escaped}:\\s*${valuePattern}\\s*$`, "gim"),
    ),
  ];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one "${label}" marker, found ${matches.length}.`);
  }
  return matches[0][1];
}

export function parsePullRequestMetadata(body) {
  const text = String(body ?? "");
  if (closingReferencePattern.test(text)) {
    throw new Error("Closing keywords are not allowed in delivery demo pull requests.");
  }
  const demo = extractSingleMarker(
    text,
    "Delivery Demo",
    "(brownfield-human-gated-delivery)",
  );
  const intentNumber = Number(
    extractSingleMarker(text, "Delivery Intent", "#([1-9]\\d*)"),
  );
  const stage = extractSingleMarker(
    text,
    "Delivery Stage",
    `(${stages.join("|")})`,
  ).toLowerCase();
  const stageIssueNumber = Number(
    extractSingleMarker(text, "Delivery Stage Issue", "#([1-9]\\d*)"),
  );
  return { demo, intentNumber, stage, stageIssueNumber };
}

export function normalizeCopilotStageBody(body, author) {
  if (!isCopilotActor(author) || typeof body !== "string") return body;
  const suffix = /((?:^|\r?\n)<!-- START COPILOT CODING AGENT SUFFIX -->\r?\n\r?\n- )Fixes #([1-9]\d*)([ \t]*(?:\r?\n)*)$/;
  const match = body.match(suffix);
  if (!match) return body;
  const normalized = body.replace(suffix, "$1References #$2$3");
  const metadata = parsePullRequestMetadata(normalized);
  if (Number(match[2]) !== metadata.stageIssueNumber) {
    throw new Error("Copilot closing suffix must reference only the current stage Issue.");
  }
  return normalized;
}

export function renderPrompt(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`Missing prompt value: ${key}`);
    return String(values[key]);
  });
}

export function countHumanApprovals(reviews, policy, pullRequestAuthor, teamMembers = [], headSha) {
  const latestByReviewer = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    if (!login || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)) continue;
    const key = login.toLowerCase();
    const current = latestByReviewer.get(key);
    if (!current || Number(review.id) > Number(current.id)) {
      latestByReviewer.set(key, review);
    }
  }

  const configured = new Set([
    ...policy.reviewers.users,
    ...teamMembers,
  ].map((login) => login.toLowerCase()));
  const author = String(pullRequestAuthor ?? "").toLowerCase();
  const approved = [];
  const changesRequested = [];
  for (const review of latestByReviewer.values()) {
    const login = review.user.login;
    const lower = login.toLowerCase();
    if (
      lower === author ||
      review.user?.type === "Bot" ||
      lower.endsWith("[bot]") ||
      lower.includes("copilot") ||
      lower === "github-actions"
    ) {
      continue;
    }
    if (!configured.has(lower)) continue;
    if (review.state === "APPROVED" && (!headSha || review.commit_id === headSha)) approved.push(login);
    if (review.state === "CHANGES_REQUESTED") changesRequested.push(login);
  }
  return {
    approved,
    changesRequested,
    satisfied:
      changesRequested.length === 0 &&
      approved.length >= policy.minimumApprovals,
  };
}

export function section(content, heading) {
  const marker = `## ${heading}`;
  const markerIndex = content.split(/\r?\n/).findIndex((line) => line === marker);
  if (markerIndex < 0) throw new Error(`Missing or empty section: ${heading}`);
  const lines = content.split(/\r?\n/).slice(markerIndex + 1);
  const nextSection = lines.findIndex((line) => line.startsWith("## "));
  const value = lines.slice(0, nextSection < 0 ? undefined : nextSection).join("\n");
  if (!value.trim()) throw new Error(`Missing or empty section: ${heading}`);
  return value;
}

export function validateSpecification(content) {
  if (!content.startsWith("# Specification\n")) {
    throw new Error("Specification must start with '# Specification'.");
  }
  for (const heading of [
    "Intent",
    "Scope",
    "Non-goals",
    "Actors",
    "Constraints",
    "Acceptance scenarios",
  ]) {
    section(content, heading);
  }
  const acceptance = section(content, "Acceptance scenarios");
  const ids = [...acceptance.matchAll(/^### (AC-\d+):\s+\S.+$/gm)].map(
    (match) => match[1],
  );
  if (!ids.length || new Set(ids).size !== ids.length) {
    throw new Error("Acceptance scenarios need unique AC-n identifiers.");
  }
  for (const [index, id] of ids.entries()) {
    const start = acceptance.indexOf(`### ${id}:`);
    const endId = ids[index + 1];
    const end = endId ? acceptance.indexOf(`### ${endId}:`) : acceptance.length;
    const scenario = acceptance.slice(start, end);
    for (const keyword of ["Given", "When", "Then"]) {
      if (!scenario.includes(`**${keyword}**`)) {
        throw new Error(`${id} is missing ${keyword}.`);
      }
    }
  }
  return ids;
}

export function validateImplementationPlan(content, acceptanceIds) {
  if (!content.startsWith("# Implementation plan\n")) {
    throw new Error("Plan must start with '# Implementation plan'.");
  }
  for (const heading of [
    "Acceptance mapping",
    "Tasks",
    "Risks and migrations",
    "Validation",
  ]) {
    section(content, heading);
  }
  const tasksSection = section(content, "Tasks");
  const matches = [...tasksSection.matchAll(/^### (TASK-\d+):\s+\S.+$/gm)];
  if (!matches.length) throw new Error("Plan must define at least one task.");
  const tasks = new Map();
  for (const [index, match] of matches.entries()) {
    const id = match[1];
    if (tasks.has(id)) throw new Error(`Duplicate task ID: ${id}`);
    const end = matches[index + 1]?.index ?? tasksSection.length;
    const body = tasksSection.slice(match.index, end);
    const dependencies = body.match(/^Depends on:\s*(.+)$/m)?.[1];
    const acceptance = body.match(/^Acceptance:\s*(.+)$/m)?.[1];
    if (!dependencies || !acceptance || !/^Surfaces:\s*\S/m.test(body) ||
        !/^Validation:\s*\S/m.test(body)) {
      throw new Error(`${id} is missing required task fields.`);
    }
    const dependencyIds = dependencies.toLowerCase() === "none"
      ? []
      : [...dependencies.matchAll(/TASK-\d+/g)].map((item) => item[0]);
    const mappedAcceptance = [...acceptance.matchAll(/AC-\d+/g)].map(
      (item) => item[0],
    );
    if (!mappedAcceptance.length) throw new Error(`${id} has no acceptance mapping.`);
    for (const ac of mappedAcceptance) {
      if (!acceptanceIds.includes(ac)) throw new Error(`${id} references unknown ${ac}.`);
    }
    tasks.set(id, { dependencies: dependencyIds, acceptance: mappedAcceptance });
  }
  for (const [id, task] of tasks) {
    for (const dependency of task.dependencies) {
      if (!tasks.has(dependency)) throw new Error(`${id} depends on unknown ${dependency}.`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`Task dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of tasks.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of tasks.keys()) visit(id);
  for (const ac of acceptanceIds) {
    if (![...tasks.values()].some((task) => task.acceptance.includes(ac))) {
      throw new Error(`No task implements ${ac}.`);
    }
  }
  return tasks;
}

export function validateExpectedFailures(input, intentNumber, acceptanceIds) {
  const manifest = requireObject(input, "expected failures");
  requireExactKeys(manifest, ["version", "intent", "tests"], "expected failures");
  if (manifest.version !== 1 || manifest.intent !== intentNumber) {
    throw new Error("Expected-failure manifest version or Intent does not match.");
  }
  if (!Array.isArray(manifest.tests) || !manifest.tests.length) {
    throw new Error("Expected-failure manifest must list at least one test.");
  }
  const names = new Set();
  for (const test of manifest.tests) {
    requireObject(test, "expected test");
    requireExactKeys(test, ["name", "acceptance"], "expected test");
    requireString(test.name, "expected test name");
    if (names.has(test.name)) throw new Error(`Duplicate expected test: ${test.name}`);
    names.add(test.name);
    if (!Array.isArray(test.acceptance) || !test.acceptance.length) {
      throw new Error(`${test.name} must map to acceptance scenarios.`);
    }
    for (const ac of test.acceptance) {
      if (!acceptanceIds.includes(ac)) {
        throw new Error(`${test.name} references unknown ${ac}.`);
      }
    }
  }
  return names;
}

function vitestAssertions(report) {
  requireObject(report, "Vitest report");
  if (!Array.isArray(report.testResults) || !report.testResults.length ||
      typeof report.success !== "boolean") {
    throw new Error("Malformed Vitest report.");
  }
  for (const key of ["numRuntimeErrorTestSuites", "numUnhandledErrors"]) {
    if (key in report && report[key] !== 0) throw new Error(`Vitest runtime errors: ${key}.`);
  }
  for (const key of ["unhandledErrors", "errors"]) {
    if (key in report && (!Array.isArray(report[key]) || report[key].length)) {
      throw new Error(`Vitest runtime errors: ${key}.`);
    }
    const suiteCounts = ["numTotalTestSuites", "numPassedTestSuites", "numFailedTestSuites", "numPendingTestSuites"];
    if (suiteCounts.some((key) => !Number.isInteger(report[key]) || report[key] < 0) ||
        report.numTotalTestSuites !== report.numPassedTestSuites + report.numFailedTestSuites + report.numPendingTestSuites) {
      throw new Error("Malformed Vitest suite totals.");
    }
  }
  const assertions = [];
  for (const suite of report.testResults) {
    if (!suite || !Array.isArray(suite.assertionResults) ||
        !["passed", "failed", "pending", "skipped"].includes(suite.status) ||
        typeof suite.message !== "string") {
      throw new Error("Malformed Vitest suite.");
    }
    if (suite.message || suite.testExecError ||
        (suite.status === "failed" && !suite.assertionResults.some((test) => test.status === "failed"))) {
      throw new Error("Vitest collection or runtime error.");
    }
    for (const assertion of suite.assertionResults) {
      if (!assertion || typeof assertion.fullName !== "string" || !assertion.fullName.trim() ||
          !["passed", "failed", "pending", "skipped", "todo"].includes(assertion.status)) {
        throw new Error("Malformed Vitest assertion.");
      }
      if (assertion.status === "failed" && suite.status !== "failed") {
        throw new Error("Inconsistent Vitest suite status.");
      }
      assertions.push(assertion);
    }
  }
  if (!assertions.length) throw new Error("Vitest report contains no test assertions.");
  const totals = {
    numTotalTests: assertions.length,
    numPassedTests: assertions.filter((test) => test.status === "passed").length,
    numFailedTests: assertions.filter((test) => test.status === "failed").length,
    numPendingTests: assertions.filter((test) => ["pending", "skipped"].includes(test.status)).length,
    numTodoTests: assertions.filter((test) => test.status === "todo").length,
  };
  for (const [key, count] of Object.entries(totals)) {
    if (report[key] !== count) throw new Error(`Inconsistent Vitest report: ${key}.`);
  }
  if (report.success && (totals.numFailedTests || report.numFailedTestSuites)) {
    throw new Error("Inconsistent Vitest success.");
  }
  return assertions;
}

function uniqueExpectedAssertions(assertions, expectedNames) {
  for (const name of expectedNames) {
    if (assertions.filter((test) => test.fullName === name).length > 1) {
      throw new Error(`Duplicate expected test evidence: ${name}`);
    }
  }
}

export function validateVitestRunErrors(evidence) {
  requireObject(evidence, "Vitest run evidence");
  if (!["passed", "failed"].includes(evidence.reason) ||
      !Array.isArray(evidence.unhandledErrors) || evidence.unhandledErrors.length ||
      !Array.isArray(evidence.suiteErrors) || evidence.suiteErrors.length ||
      !Array.isArray(evidence.hookErrors) || evidence.hookErrors.length) {
    throw new Error("Vitest collection, runtime, unhandled, or interrupted run error.");
  }
}

export function validateVitestRed(report, expectedNames) {
  const assertions = vitestAssertions(report);
  uniqueExpectedAssertions(assertions, expectedNames);
  const failed = assertions
    .filter((assertion) => assertion.status === "failed")
    .map((assertion) => assertion.fullName);
  const unexpected = failed.filter((name) => !expectedNames.has(name));
  const missing = [...expectedNames].filter((name) => !failed.includes(name));
  if (!assertions.length) throw new Error("Vitest report contains no test assertions.");
  if (unexpected.length || missing.length) {
    throw new Error(
      `Red test mismatch. Missing: ${missing.join(", ") || "none"}; ` +
      `unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }
  return failed;
}

export function validateVitestGreen(report, expectedNames) {
  const assertions = vitestAssertions(report);
  uniqueExpectedAssertions(assertions, expectedNames);
  if (!report.success || report.snapshot?.failure) throw new Error("Vitest run did not succeed.");
  const byName = new Map(assertions.map((assertion) => [assertion.fullName, assertion.status]));
  const missing = [...expectedNames].filter((name) => !byName.has(name));
  const notGreen = [...expectedNames].filter((name) =>
    byName.has(name) && byName.get(name) !== "passed");
  const failed = assertions
    .filter((assertion) => assertion.status === "failed")
    .map((assertion) => assertion.fullName);
  if (missing.length || notGreen.length || failed.length) {
    throw new Error(
      `Green test mismatch. Missing: ${missing.join(", ") || "none"}; ` +
      `not Green: ${notGreen.join(", ") || "none"}; ` +
      `failed: ${failed.join(", ") || "none"}.`,
    );
  }
  return [...expectedNames];
}

export function isTestFile(path) {
  return /(?:^|\/)(?:[^/]+\.(?:test|spec)\.[^/]+|__tests__\/.+)$/.test(path);
}

export function validateStageFiles(stage, changedFiles, intentNumber, projectPath, issueDocuments = false) {
  const artifacts = artifactPaths(intentNumber);
  const files = [...new Set(changedFiles)];
  if (!files.length) throw new Error(`${stage} PR has no changed files.`);
  if (stage === "spec" && (files.length !== 1 || files[0] !== artifacts.spec)) {
    throw new Error(`Spec PR may change only ${artifacts.spec}.`);
  }
  if (stage === "plan" && (files.length !== 1 || files[0] !== artifacts.plan)) {
    throw new Error(`Plan PR may change only ${artifacts.plan}.`);
  }
  if (stage === "tests") {
    for (const file of files) {
      if (file === artifacts.expectedFailures) continue;
      if (!file.startsWith(`${projectPath}/`) || !isTestFile(file)) {
        throw new Error(`Tests PR contains a non-test change: ${file}`);
      }
    }
    if (!files.includes(artifacts.expectedFailures)) {
      throw new Error(`Tests PR must change ${artifacts.expectedFailures}.`);
    }
    if (!files.some((file) => isTestFile(file))) {
      throw new Error("Tests PR must add or update executable tests.");
    }
  }
  if (stage === "implementation") {
    const approvedArtifacts = new Set([
      artifacts.spec,
      artifacts.plan,
      artifacts.expectedFailures,
      ...(issueDocuments ? [`${artifacts.root}/document-review.json`] : []),
    ]);
    for (const file of files) {
      if (!file.startsWith(`${projectPath}/`) && !approvedArtifacts.has(file)) {
        throw new Error(`Implementation PR contains an out-of-scope change: ${file}`);
      }
    }
    if (!files.some((file) => file.startsWith(`${projectPath}/`))) {
      throw new Error("Implementation PR must change the configured project.");
    }
  }
  if (!stages.includes(stage)) throw new Error(`Unknown delivery stage: ${stage}`);
  return files;
}
