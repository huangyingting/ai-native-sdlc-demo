import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { isAuthorizedAssociation, isCopilotActor, validateConfig } from "./core.mjs";

const label = "brownfield-human-gated-delivery:intent";
const environment = "it-service-desk-demo";
const configPath = ".github/brownfield-human-gated-delivery/config.json";
const workflowFiles = [
  "kickoff", "documents", "pr-coordinator", "review-signal", "stage-ci", "advance", "publish",
].map((name) => `brownfield-human-gated-delivery-${name}.yml`).concat("it-service-desk-ci.yml");

export function parseOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: "string" },
      apply: { type: "boolean", default: false },
      "set-token": { type: "boolean", default: false },
      "single-owner": { type: "boolean", default: false },
      intent: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return values;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(values.repo ?? "") ||
      [".", ".."].includes(values.repo.split("/")[1])) {
    throw new Error("Specify a GitHub.com repository with --repo OWNER/REPO.");
  }
  if (values["set-token"] && !values.apply) {
    throw new Error("--set-token requires --apply; preview never changes secrets.");
  }
  if (values.intent !== undefined &&
      (!/^[1-9]\d*$/.test(values.intent) || !Number.isSafeInteger(Number(values.intent)))) {
    throw new Error("--intent must be a positive Issue number.");
  }
  return values;
}

export function githubApi(method, endpoint, body) {
  const args = [
    "api", "--hostname", "github.com", "--method", method, endpoint,
    "--header", "Accept: application/vnd.github+json",
    "--header", "X-GitHub-Api-Version: 2026-03-10",
    "--header", "GraphQL-Features: issues_copilot_assignment_api_support",
  ];
  if (body !== undefined) args.push("--input", "-");
  let output;
  try {
    output = execFileSync("gh", args, {
      encoding: "utf8",
      input: body === undefined ? undefined : JSON.stringify(body),
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      `GitHub ${method} ${endpoint} failed. Install gh and authenticate an administrator ` +
      `with gh auth login --hostname github.com. Check repository permissions and plan support.\n` +
      (error.stderr?.toString().trim() || error.message),
    );
  }
  return output.trim() ? JSON.parse(output) : null;
}

function setCopilotToken(repo) {
  if (!process.stdin.isTTY) {
    throw new Error("--set-token requires an interactive terminal. Use gh secret set separately in CI.");
  }
  // gh reads the secret without placing its value in argv, files, or our logs.
  execFileSync("gh", ["secret", "set", "COPILOT_ASSIGN_TOKEN", "--repo", repo], {
    stdio: "inherit",
    env: { ...process.env, GH_HOST: "github.com" },
  });
}

export function desiredRulesets(actionsId, { singleOwner = false } = {}) {
  return [false, true].map((lifecycle) => ({
    name: `Brownfield delivery - ${lifecycle ? "lifecycle branches" : "main"}`,
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: {
      ref_name: {
        include: [`refs/heads/${lifecycle ? "brownfield-delivery/**" : "main"}`],
        exclude: [],
      },
    },
    rules: [
      ...(lifecycle ? [] : [{ type: "deletion" }]),
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: singleOwner ? 0 : 1,
          dismiss_stale_reviews_on_push: true,
          required_review_thread_resolution: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: lifecycle,
          required_status_checks: [
            "Brownfield delivery policy", "stage-validation",
            ...(lifecycle ? [] : ["validate", "container-smoke"]),
          ].map((context) => ({ context, integration_id: actionsId })),
        },
      },
    ],
  }));
}

export function validateExistingRuleset(actual, expected, mergeMethod) {
  const fail = (reason) => {
    throw new Error(
      `Ruleset "${expected.name}" conflicts with setup: ${reason}. ` +
      "Resolve it in Settings > Rules > Rulesets and rerun; setup only changes native approval counts with explicit --single-owner.",
    );
  };
  if (actual.target !== "branch" || actual.enforcement !== "active" ||
      !Array.isArray(actual.bypass_actors) || actual.bypass_actors.length) {
    fail("an active branch ruleset without bypass actors is required");
  }
  const refs = actual.conditions?.ref_name;
  if (Object.keys(actual.conditions ?? {}).length !== 1 ||
      refs?.include?.length !== 1 || refs.include[0] !== expected.conditions.ref_name.include[0] ||
      !Array.isArray(refs.exclude) || refs.exclude.length) {
    fail("branch scope differs");
  }
  const rules = actual.rules ?? [];
  if (expected.name.endsWith("lifecycle branches") &&
      rules.some((rule) => ["creation", "deletion", "update"].includes(rule.type))) {
    fail("lifecycle branches must allow creation, updates, and cleanup");
  }
  for (const wanted of expected.rules) {
    const rule = rules.find((item) => item.type === wanted.type);
    if (!rule) fail(`missing ${wanted.type}`);
    const params = rule.parameters;
    if (wanted.type === "pull_request" &&
        (wanted.parameters.required_approving_review_count === 0
          ? params?.required_approving_review_count !== 0
          : !(params?.required_approving_review_count >= 1))) {
      fail("native approval count differs from the selected mode; single-owner demo rules require --single-owner");
    }
    if (wanted.type === "pull_request" &&
        (params.dismiss_stale_reviews_on_push !== true ||
         params.required_review_thread_resolution !== true ||
         (params.allowed_merge_methods && !params.allowed_merge_methods.includes(mergeMethod)))) {
      fail("review requirements or allowed merge methods differ");
    }
    if (wanted.type === "required_status_checks" &&
        (params?.strict_required_status_checks_policy !== true ||
         params.do_not_enforce_on_create !== wanted.parameters.do_not_enforce_on_create ||
         !wanted.parameters.required_status_checks.every((check) =>
           params.required_status_checks?.some((item) =>
             item.context === check.context && item.integration_id === check.integration_id)))) {
      fail("required checks, their GitHub Actions source, or branch-creation exemption differ");
    }
  }
}

function rulesetSettings({ name, target, enforcement, bypass_actors, conditions, rules }) {
  return { name, target, enforcement, bypass_actors, conditions, rules };
}

function inspect(options, api) {
  const root = `repos/${options.repo}`;
  const changes = [];
  const blockers = [];
  const notes = [];
  const add = (description, method, path, body, before) =>
    changes.push({ description, method, path, body, before });
  const list = (path, key) => {
    const items = [];
    for (let page = 1; ; page++) {
      const result = api("GET", `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      const batch = key ? result[key] : result;
      if (!Array.isArray(batch)) throw new Error(`Expected a list from ${path}.`);
      items.push(...batch);
      if (batch.length < 100) return items;
    }
  };
  const repository = api("GET", root);
  if (!repository.permissions?.admin || repository.archived || repository.default_branch !== "main") {
    throw new Error("Setup requires administrator access to an unarchived repository with main as its default branch.");
  }
  const content = api("GET", `${root}/contents/${configPath}?ref=main`);
  if (content.encoding !== "base64") throw new Error("Cannot read delivery configuration from main.");
  const config = validateConfig(JSON.parse(Buffer.from(content.content, "base64").toString("utf8")));
  const tree = api("GET", `${root}/git/trees/main?recursive=1`);
  if (tree.truncated) throw new Error("Repository tree is truncated; cannot verify installed automation safely.");
  const paths = new Set(tree.tree.filter((item) => item.type === "blob").map((item) => item.path));
  const required = [
    ".github/ISSUE_TEMPLATE/brownfield-human-gated-delivery-intent.yml",
    ...["core", "github", "documents", "document-core", "state-store", "runs", "run-core", "validate-stage", "vitest-errors-reporter"].map((name) =>
      `.github/brownfield-human-gated-delivery/scripts/${name}.mjs`),
    `${config.project.path}/package.json`,
    `${config.project.path}/package-lock.json`,
    `${config.project.path}/Dockerfile`,
    ...Object.values(config.stages).map((stage) => stage.prompt),
    ".github/brownfield-human-gated-delivery/prompts/spec-issue.md",
    ".github/brownfield-human-gated-delivery/prompts/plan-issue.md",
    ...workflowFiles.map((file) => `.github/workflows/${file}`),
  ];
  const missing = required.filter((path) => !paths.has(path));
  if (missing.length) {
    throw new Error(`Publish the demo automation to main before installing branch protections. Missing: ${missing.join(", ")}`);
  }
  const mergeSetting = `allow_${config.mergeMethod === "merge" ? "merge_commit" : `${config.mergeMethod}_merge`}`;
  const settings = {};
  if (!repository.has_issues) settings.has_issues = true;
  if (!repository.allow_auto_merge) settings.allow_auto_merge = true;
  if (!repository[mergeSetting]) settings[mergeSetting] = true;
  if (Object.keys(settings).length) add("Enable Issues, auto-merge, and configured merge method", "PATCH", root, settings);

  const actions = api("GET", `${root}/actions/permissions`);
  if (!actions.enabled) add("Enable GitHub Actions (preserving action policy)", "PUT", `${root}/actions/permissions`, { enabled: true });
  if (actions.allowed_actions !== "all") {
    blockers.push("Restricted Actions policy: an administrator must verify it allows every action used by the demo; setup will not broaden it.");
  }
  const workflows = list(`${root}/actions/workflows`, "workflows");
  for (const file of workflowFiles) {
    const workflow = workflows.find((item) => item.path === `.github/workflows/${file}`);
    if (!workflow) {
      blockers.push(`GitHub has not registered ${file}; enable Actions and verify the workflow on main, then rerun.`);
    } else if (["disabled_manually", "disabled_inactivity"].includes(workflow.state)) {
      add(`Enable ${file}`, "PUT", `${root}/actions/workflows/${workflow.id}/enable`);
    } else if (workflow.state !== "active") {
      blockers.push(`${file} has unsupported state ${workflow.state}; resolve it in GitHub Actions.`);
    }
  }
  if (!list(`${root}/labels`).some((item) => item.name === label)) {
    add("Create Intent label", "POST", `${root}/labels`, {
      name: label, color: "5319e7", description: "Human-authored Intent for the brownfield delivery demo",
    });
  }
  if (!list(`${root}/environments`, "environments").some((item) => item.name === environment)) {
    add("Create temporary verification Environment", "PUT", `${root}/environments/${environment}`, {});
  }
  if (!list(`${root}/actions/secrets`, "secrets").some((item) => item.name === "COPILOT_ASSIGN_TOKEN")) {
    blockers.push("COPILOT_ASSIGN_TOKEN is missing. Use --apply --set-token or gh secret set COPILOT_ASSIGN_TOKEN --repo " + options.repo);
  }
  const reviewers = new Map();
  for (const [stage, policy] of Object.entries(config.stages)) {
    notes.push(`${stage}: ${policy.minimumApprovals} approval(s); users [${policy.reviewers.users.join(", ")}]; teams [${policy.reviewers.teams.join(", ")}]`);
    for (const user of policy.reviewers.users) {
      if (!reviewers.has(user)) {
        reviewers.set(user, api("GET", `${root}/collaborators/${encodeURIComponent(user)}/permission`));
      }
      const access = reviewers.get(user);
      if (!["admin", "maintain", "write"].includes(access.permission) || access.user?.type !== "User") {
        blockers.push(`${stage}: reviewer ${user} must be a Human with repository write access. Edit ${configPath} through a reviewed PR.`);
      }
    }
    if (policy.reviewers.teams.length) {
      blockers.push(`${stage}: team membership and write access require manual verification with the automation token; setup only verifies individual reviewers.`);
    }
  }
  const [owner, name] = options.repo.split("/");
  const actors = api("POST", "graphql", {
    query: `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100) {
          nodes { __typename ... on Bot { login } }
        }
      }
    }`,
    variables: { owner, name },
  });
  if (actors.errors?.length) throw new Error(`Copilot availability query failed: ${JSON.stringify(actors.errors)}`);
  if (!actors.data?.repository?.suggestedActors?.nodes?.some(isCopilotActor)) {
    blockers.push("Copilot Coding Agent is not available to the authenticated administrator. Check Copilot access, billing, and repository/organization policy.");
  }
  const app = api("GET", "apps/github-actions");
  if (app.slug !== "github-actions" || !Number.isSafeInteger(app.id) || app.id <= 0) {
    throw new Error("Cannot verify the GitHub Actions app identity for required checks.");
  }
  const rulesets = list(`${root}/rulesets?includes_parents=false`);
  for (const expected of desiredRulesets(app.id, { singleOwner: options["single-owner"] })) {
    const matches = rulesets.filter((rule) => rule.name === expected.name);
    if (matches.length > 1) throw new Error(`Duplicate rulesets named "${expected.name}"; resolve them manually.`);
    if (matches.length) {
      const path = `${root}/rulesets/${matches[0].id}`;
      const before = rulesetSettings(api("GET", path));
      const candidate = structuredClone(before);
      const review = candidate.rules.find((rule) => rule.type === "pull_request");
      if (options["single-owner"] && review?.parameters?.required_approving_review_count > 0) {
        review.parameters.required_approving_review_count = 0;
      }
      validateExistingRuleset(candidate, expected, config.mergeMethod);
      if (!isDeepStrictEqual(candidate, before)) {
        add(`Use policy-based Human approval for ${expected.name} (native approvals: 0)`,
          "PUT", path, candidate, before);
      }
    } else {
      add(`Create ${expected.name}`, "POST", `${root}/rulesets`, expected);
    }
  }
  if (options.intent) {
    const issue = api("GET", `${root}/issues/${options.intent}`);
    if (issue.pull_request || issue.state !== "open" || !isAuthorizedAssociation(issue.author_association)) {
      throw new Error("--intent must identify an open Issue authored by an OWNER, MEMBER, or COLLABORATOR.");
    }
    if (!issue.labels.some((item) => item.name === label)) {
      add(`Label Intent #${options.intent} (does not start kickoff)`, "POST", `${root}/issues/${options.intent}/labels`, { labels: [label] });
    }
  }
  return { changes, blockers: [...new Set(blockers)], notes };
}

export function setup(options, { api = githubApi, setToken = setCopilotToken, log = console.log } = {}) {
  log(`${options.apply ? "Apply" : "Read-only preview"}: https://github.com/${options.repo}`);
  if (options["single-owner"]) {
    log("Single-owner demo mode: both managed rulesets use zero native approvals. Delivery stages still require configured Human approval through Brownfield delivery policy; this is not independent two-person review.");
    log("Applying may unblock already-approved PRs and protected auto-merge. Unrelated PRs have no native approval floor.");
  }
  let result = inspect(options, api);
  for (const note of result.notes) log(`Reviewer policy: ${note}`);
  for (const change of result.changes) log(`${options.apply ? "Applying" : "Would apply"}: ${change.description}`);
  if (options.apply) {
    for (const change of result.changes) {
      if (change.before && !isDeepStrictEqual(rulesetSettings(api("GET", change.path)), change.before)) {
        throw new Error(`Ruleset changed since inspection: ${change.path}. Rerun setup to review the current settings.`);
      }
      api(change.method, change.path, change.body);
    }
    if (options["set-token"]) setToken(options.repo);
    result = inspect(options, api);
    if (result.changes.length) {
      throw new Error(`Read-back verification failed: ${result.changes.map((item) => item.description).join("; ")}. Setup may be partially applied; resolve the error and rerun.`);
    }
  }
  for (const blocker of result.blockers) log(`ACTION REQUIRED: ${blocker}`);
  log("Manual checks: verify the PAT's scopes, expiry, and Copilot entitlement; Copilot CLI usage and copilot-requests permission; sub-issues and GHCR publication; additional/inherited rules and branch protection; and any existing Environment approval gates. Trusted document automation must be allowed to write brownfield-documents/** without changing the protected engineering branch rules.");
  log("Setup never retrieves secret values from GitHub, grants bypasses, approves PRs, installs app dependencies, or dispatches kickoff. Rule changes can unblock existing auto-merge.");
  const ready = !result.changes.length && !result.blockers.length;
  log(ready ? "Automated prerequisites verified. Complete the manual checks before starting the demo." :
    "Setup is incomplete. Apply the previewed changes or resolve the actions above, then rerun.");
  if (options.intent) {
    log("After setup and manual checks, resume explicitly: " +
      `gh workflow run brownfield-human-gated-delivery-kickoff.yml --repo ${options.repo} --ref main -f issue_number=${options.intent}`);
  }
  return { ...result, ready };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
      console.log("Usage: npm run setup:brownfield -- --repo OWNER/REPO [--apply] [--single-owner] [--set-token] [--intent NUMBER]\n" +
        "Requires Node.js 24+, gh authenticated as a GitHub.com repository administrator, and demo automation on main.\n" +
        "Default: read-only preview. --apply writes missing settings and verifies them. --set-token securely prompts through gh.\n" +
        "--single-owner explicitly uses zero native approvals on both managed rulesets; configured Human stage approval remains mandatory through Brownfield delivery policy.\n" +
        "Exit codes: 0 = automated checks passed (manual checks remain), 2 = incomplete, 1 = error/conflict. Safe to rerun after partial failure.");
    } else {
      if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Use Node.js 24 or newer.");
      process.exitCode = setup(options).ready ? 0 : 2;
    }
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
