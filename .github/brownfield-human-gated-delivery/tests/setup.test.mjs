import { test } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { desiredRulesets, parseOptions, setup, validateExistingRuleset } from "../scripts/setup.mjs";

const repo = "example/repo";
const root = `repos/${repo}`;
const script = new URL("../scripts/setup.mjs", import.meta.url);
const configPath = ".github/brownfield-human-gated-delivery/config.json";
const config = JSON.parse(readFileSync(new URL("../config.json", script), "utf8"));
const options = (args = []) => parseOptions(["--repo", repo, ...args]);

function fixture({ configured = false } = {}) {
  const githubDirectory = fileURLToPath(new URL("../../", script));
  // Scan only installed automation, never transient fixtures from parallel tests.
  const files = ["ISSUE_TEMPLATE", "workflows",
    "brownfield-human-gated-delivery/scripts", "brownfield-human-gated-delivery/prompts"]
    .flatMap((directory) => readdirSync(join(githubDirectory, directory), { recursive: true, withFileTypes: true }))
    .filter((item) => item.isFile())
    .map((item) => `.github/${relative(githubDirectory, join(item.parentPath, item.name)).split(sep).join("/")}`);
  const state = {
    repository: {
      permissions: { admin: true }, archived: false, default_branch: "main",
      has_issues: configured, allow_auto_merge: configured, allow_squash_merge: configured,
      allow_rebase_merge: false, delete_branch_on_merge: false,
    },
    config: structuredClone(config),
    tree: {
      truncated: false,
      tree: [...files, ...["package.json", "package-lock.json", "Dockerfile"].map((name) =>
        `demos/it-service-desk/${name}`)].map((path) => ({ path, type: "blob" })),
    },
    actions: { enabled: configured, allowed_actions: "all" },
    workflows: files.filter((path) => path.startsWith(".github/workflows/"))
      .map((path, id) => ({ id, path, state: configured ? "active" : "disabled_manually" })),
    labels: configured ? [{ name: "brownfield-human-gated-delivery:intent" }] : [],
    environments: configured ? [{ name: "it-service-desk-demo", protection_rules: [{ type: "required_reviewers" }] }] : [],
    secrets: configured ? [{ name: "COPILOT_ASSIGN_TOKEN" }] : [],
    rulesets: configured ? desiredRulesets(15368).map((rule, id) => ({ ...rule, id })) : [],
    issue: { state: "open", author_association: "OWNER", labels: [] },
    access: { permission: "admin", user: { type: "User" } },
    actors: { data: { repository: { suggestedActors: { nodes: [{ __typename: "Bot", login: "Copilot" }] } } } },
    app: { id: 15368, slug: "github-actions" },
  };
  const calls = [];
  const messages = [];
  const secretCalls = [];
  const api = (method, endpoint, body) => {
    calls.push({ method, endpoint, body: structuredClone(body) });
    const url = new URL(endpoint, "https://api.github.com/");
    const path = url.pathname.slice(1);
    if (method === "POST" && path === "graphql") {
      assert.match(body.query, /^query/);
      assert.deepEqual(body.variables, { owner: "example", name: "repo" });
      return structuredClone(state.actors);
    }
    if (method === "GET") {
      if (path === root) return structuredClone(state.repository);
      if (path === "apps/github-actions") return structuredClone(state.app);
      if (path === `${root}/contents/${configPath}`) {
        assert.equal(url.searchParams.get("ref"), "main");
        return { encoding: "base64", content: Buffer.from(JSON.stringify(state.config)).toString("base64") };
      }
      if (path === `${root}/git/trees/main`) return structuredClone(state.tree);
      if (path === `${root}/actions/permissions`) return structuredClone(state.actions);
      if (path.startsWith(`${root}/collaborators/`)) return structuredClone(state.access);
      if (path === `${root}/issues/7`) return structuredClone(state.issue);
      if (path.startsWith(`${root}/rulesets/`)) {
        return structuredClone(state.rulesets.find((item) => item.id === Number(path.split("/").at(-1))));
      }
      const lists = {
        [`${root}/actions/workflows`]: ["workflows", state.workflows],
        [`${root}/labels`]: [null, state.labels],
        [`${root}/environments`]: ["environments", state.environments],
        [`${root}/actions/secrets`]: ["secrets", state.secrets],
        [`${root}/rulesets`]: [null, state.rulesets],
      };
      if (lists[path]) {
        const [key, items] = lists[path];
        const page = Number(url.searchParams.get("page"));
        assert.equal(url.searchParams.get("per_page"), "100");
        const batch = structuredClone(items.slice((page - 1) * 100, page * 100));
        return key ? { [key]: batch, total_count: items.length } : batch;
      }
    }
    if (method === "PATCH" && path === root) return Object.assign(state.repository, body);
    if (method === "PUT" && path === `${root}/actions/permissions`) return Object.assign(state.actions, body);
    if (method === "PUT" && path.endsWith("/enable")) {
      const id = Number(path.split("/").at(-2));
      state.workflows.find((item) => item.id === id).state = "active";
      return null;
    }
    if (method === "POST" && path === `${root}/labels`) return state.labels.push(structuredClone(body));
    if (method === "PUT" && path === `${root}/environments/it-service-desk-demo`) {
      return state.environments.push({ name: "it-service-desk-demo" });
    }
    if (method === "POST" && path === `${root}/rulesets`) {
      return state.rulesets.push({ ...structuredClone(body), id: state.rulesets.length });
    }
    if (method === "PUT" && path.startsWith(`${root}/rulesets/`)) {
      const ruleset = state.rulesets.find((item) => item.id === Number(path.split("/").at(-1)));
      return Object.assign(ruleset, structuredClone(body));
    }
    if (method === "POST" && path === `${root}/issues/7/labels`) {
      state.issue.labels.push(...body.labels.map((name) => ({ name })));
      return null;
    }
    throw new Error(`Unexpected API call: ${method} ${endpoint}`);
  };
  return {
    state, calls, messages, secretCalls,
    writes: () => calls.filter((call) => call.method !== "GET" && call.endpoint !== "graphql"),
    deps: {
      api,
      log: (message) => messages.push(message),
      setToken: (target) => {
        secretCalls.push(target);
        state.secrets = [{ name: "COPILOT_ASSIGN_TOKEN" }];
      },
    },
  };
}

test("setup CLI requires explicit safe coordinates and write opt-in", () => {
  for (const args of [[], ["--repo", "https://github.com/a/b"], ["--repo", "a/.."],
    ["--repo", "a/b/c"], ["--repo", "-a/b"], ["--repo", "a/b", "--set-token"],
    ["--repo", "a/b", "--intent", "0"], ["--repo", "a/b", "--intent", "1e2"],
    ["--repo", "a/b", "--intent", "9007199254740992"], ["--unknown"]]) {
    assert.throws(() => parseOptions(args));
  }
  assert.equal(options().apply, false);
  assert.equal(options()["single-owner"], false);
  assert.equal(options(["--single-owner"])["single-owner"], true);
  assert.equal(options(["--apply", "--set-token", "--intent", "7"]).intent, "7");
  const help = execFileSync(process.execPath, [fileURLToPath(script), "--help"], { encoding: "utf8" });
  assert.match(help, /read-only preview/i);
  assert.match(help, /Exit codes/);
});

test("preview discovers missing prerequisites without mutations or secret entry", () => {
  const mock = fixture();
  const before = structuredClone(mock.state);
  const result = setup(options(["--intent", "7"]), mock.deps);
  assert.equal(result.ready, false);
  assert.equal(result.changes.filter((change) => change.path === `${root}/rulesets`).length, 2);
  assert.ok(result.blockers.some((text) => text.includes("COPILOT_ASSIGN_TOKEN")));
  assert.deepEqual(mock.state, before);
  assert.deepEqual(mock.writes(), []);
  assert.deepEqual(mock.secretCalls, []);
  assert.ok(mock.messages.some((text) => text.includes("issue_number=7")));
});

test("apply configures and reads back all supported prerequisites, then reruns without writes", () => {
  const mock = fixture();
  assert.equal(setup(options(["--apply", "--set-token", "--intent", "7"]), mock.deps).ready, true);
  assert.deepEqual(mock.secretCalls, [repo]);
  assert.equal(mock.state.repository.allow_auto_merge, true);
  assert.equal(mock.state.repository.has_issues, true);
  assert.equal(mock.state.repository.allow_squash_merge, true);
  assert.equal(mock.state.repository.allow_rebase_merge, false);
  assert.equal(mock.state.repository.delete_branch_on_merge, false);
  assert.equal(mock.state.actions.enabled, true);
  assert.deepEqual(mock.state.rulesets.map(({ id, ...rule }) => rule), desiredRulesets(15368));
  assert.equal(mock.state.issue.labels[0].name, "brownfield-human-gated-delivery:intent");
  assert.equal(mock.state.workflows.find((item) => item.path.endsWith("copilot-cli-agent-demos.yml")).state, "disabled_manually");
  const writes = mock.writes().length;
  assert.equal(setup(options(["--apply", "--intent", "7"]), mock.deps).ready, true);
  assert.equal(mock.writes().length, writes);
  assert.equal(mock.secretCalls.length, 1);
  assert.ok(!mock.calls.some((call) => /dispatches|\/reviews|\/merges|\/assignees/.test(call.endpoint)));
});

test("existing settings, protected Environments, stronger rules, and unrelated rulesets are untouched", () => {
  const mock = fixture({ configured: true });
  const main = mock.state.rulesets[0];
  main.rules.find((rule) => rule.type === "pull_request").parameters.required_approving_review_count = 2;
  main.rules.find((rule) => rule.type === "required_status_checks").parameters.required_status_checks.push({ context: "extra-check" });
  mock.state.rulesets.push({ id: 99, name: "Organization policy", rules: [{ type: "creation" }] });
  const before = structuredClone(mock.state);
  assert.equal(setup(options(["--apply"]), mock.deps).ready, true);
  assert.deepEqual(mock.state, before);
  assert.deepEqual(mock.writes(), []);
});

test("pagination finds existing labels, secrets, workflows, Environments, and rulesets on later pages", () => {
  const mock = fixture({ configured: true });
  for (const key of ["labels", "secrets", "workflows", "environments", "rulesets"]) {
    mock.state[key].unshift(...Array.from({ length: 100 }, (_, id) => ({ name: `unrelated-${id}`, id: id + 100 })));
  }
  assert.equal(setup(options(["--apply"]), mock.deps).ready, true);
  assert.deepEqual(mock.writes(), []);
  assert.equal(mock.calls.filter((call) => call.endpoint.includes("page=2")).length, 10);
});

test("rulesets have exact check sources and lifecycle creation exemption without bypasses", () => {
  const [main, lifecycle] = desiredRulesets(15368);
  assert.deepEqual(main.bypass_actors, []);
  assert.deepEqual(lifecycle.bypass_actors, []);
  const mainChecks = main.rules.find((rule) => rule.type === "required_status_checks").parameters;
  const lifecycleChecks = lifecycle.rules.find((rule) => rule.type === "required_status_checks").parameters;
  assert.equal(mainChecks.do_not_enforce_on_create, false);
  assert.equal(lifecycleChecks.do_not_enforce_on_create, true);
  assert.deepEqual(mainChecks.required_status_checks.map((item) => item.context),
    ["Brownfield delivery policy", "stage-validation", "validate", "container-smoke"]);
  assert.deepEqual(lifecycleChecks.required_status_checks.map((item) => item.context),
    ["Brownfield delivery policy", "stage-validation"]);
  assert.ok(mainChecks.required_status_checks.every((item) => item.integration_id === 15368));
  assert.ok(main.rules.some((rule) => rule.type === "deletion"));
  assert.ok(!lifecycle.rules.some((rule) => ["creation", "deletion", "update"].includes(rule.type)));
});

test("single-owner creation changes only the native floor, not Human stage approval or checks", () => {
  const expected = desiredRulesets(15368);
  for (const rule of expected) {
    rule.rules.find((item) => item.type === "pull_request").parameters.required_approving_review_count = 0;
  }
  assert.deepEqual(desiredRulesets(15368, { singleOwner: true }), expected);
  const mock = fixture();
  assert.equal(setup(options(["--single-owner", "--apply", "--set-token"]), mock.deps).ready, true);
  assert.deepEqual(mock.state.rulesets.map(({ id, ...rule }) => rule), expected);
  assert.deepEqual(mock.state.config, config);
  assert.ok(Object.values(mock.state.config.stages).every((stage) => stage.minimumApprovals >= 1));
  assert.ok(mock.messages.some((message) => message.includes("not independent two-person review")));
});

test("single-owner opt-in previews then updates only approval counts and is idempotent", () => {
  const mock = fixture({ configured: true });
  for (const rule of mock.state.rulesets) {
    const review = rule.rules.find((item) => item.type === "pull_request").parameters;
    review.required_approving_review_count = 2;
    review.require_extra_approval_for_unattributed_changes = true;
    review.allowed_merge_methods = ["squash"];
    rule.rules.find((item) => item.type === "required_status_checks").parameters.required_status_checks.push({ context: "additional-check", integration_id: 15368 });
  }
  mock.state.rulesets.push({ id: 99, name: "Unrelated policy", rules: [{ type: "creation" }] });
  const before = structuredClone(mock.state);
  const preview = setup(options(["--single-owner"]), mock.deps);
  assert.equal(preview.changes.length, 2);
  assert.equal(preview.ready, false);
  assert.deepEqual(mock.writes(), []);
  assert.deepEqual(mock.state, before);
  assert.equal(setup(options(["--single-owner", "--apply"]), mock.deps).ready, true);
  const expected = structuredClone(before);
  for (const ruleset of expected.rulesets.slice(0, 2)) {
    ruleset.rules.find((item) => item.type === "pull_request").parameters.required_approving_review_count = 0;
  }
  assert.deepEqual(mock.state, expected);
  assert.deepEqual(mock.writes().map(({ method, endpoint }) => ({ method, endpoint })), [
    { method: "PUT", endpoint: `${root}/rulesets/0` },
    { method: "PUT", endpoint: `${root}/rulesets/1` },
  ]);
  assert.equal(setup(options(["--single-owner", "--apply"]), mock.deps).ready, true);
  assert.equal(mock.writes().length, 2);
  assert.throws(() => setup(options(["--apply"]), mock.deps), /single-owner demo rules require --single-owner/);
  assert.equal(mock.writes().length, 2);
});

test("single-owner opt-in does not allow weakening required policy checks or granting bypasses", () => {
  for (const modify of [
    (rule) => { rule.bypass_actors.push({ actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" }); },
    (rule) => { rule.rules.find((item) => item.type === "required_status_checks").parameters.required_status_checks.shift(); },
    (rule) => { rule.rules.find((item) => item.type === "required_status_checks").parameters.required_status_checks[0].integration_id = null; },
    (rule) => { rule.rules.find((item) => item.type === "pull_request").parameters.required_review_thread_resolution = false; },
  ]) {
    const mock = fixture({ configured: true });
    modify(mock.state.rulesets[1]);
    assert.throws(() => setup(options(["--single-owner", "--apply"]), mock.deps), /conflicts with setup/);
    assert.deepEqual(mock.writes(), []);
  }
});

test("single-owner updates reject concurrent policy edits and verify persisted approval counts", () => {
  const mock = fixture({ configured: true });
  let reads = 0;
  assert.throws(() => setup(options(["--single-owner", "--apply"]), {
    ...mock.deps,
    api: (method, path, body) => {
      if (method === "GET" && path === `${root}/rulesets/0` && ++reads === 2) {
        mock.state.rulesets[0].rules.push({ type: "required_signatures" });
      }
      return mock.deps.api(method, path, body);
    },
  }), /Ruleset changed since inspection/);
  assert.deepEqual(mock.writes(), []);
  const unchanged = fixture({ configured: true });
  assert.throws(() => setup(options(["--single-owner", "--apply"]), {
    ...unchanged.deps,
    api: (method, path, body) => method === "PUT" && path.includes("/rulesets/") ? {} : unchanged.deps.api(method, path, body),
  }), /Read-back verification failed/);
});

test("conflicting rulesets stop all writes rather than replacing or weakening protections", () => {
  const modifications = [
    (rule) => { rule.enforcement = "disabled"; },
    (rule) => { rule.target = "tag"; },
    (rule) => { rule.bypass_actors = [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }]; },
    (rule) => { rule.conditions.ref_name.exclude = ["refs/heads/main"]; },
    (rule) => { rule.rules = []; },
    (rule) => { rule.rules.find((item) => item.type === "pull_request").parameters.dismiss_stale_reviews_on_push = false; },
    (rule) => { rule.rules.find((item) => item.type === "pull_request").parameters.required_approving_review_count = 0; },
    (rule) => { rule.rules.find((item) => item.type === "pull_request").parameters.required_review_thread_resolution = false; },
    (rule) => { rule.rules.find((item) => item.type === "pull_request").parameters.allowed_merge_methods = ["rebase"]; },
    (rule) => { rule.rules.find((item) => item.type === "required_status_checks").parameters.strict_required_status_checks_policy = false; },
    (rule) => { rule.rules.find((item) => item.type === "required_status_checks").parameters.required_status_checks[0].integration_id = null; },
  ];
  for (const modify of modifications) {
    const mock = fixture({ configured: true });
    mock.state.repository.allow_auto_merge = false;
    modify(mock.state.rulesets[0]);
    assert.throws(() => setup(options(["--apply"]), mock.deps), /conflicts with setup/);
    assert.deepEqual(mock.writes(), []);
  }
  for (const type of ["creation", "deletion", "update"]) {
    const expected = desiredRulesets(15368)[1];
    const actual = structuredClone(expected);
    actual.rules.push({ type });
    assert.throws(() => validateExistingRuleset(actual, expected, "squash"), /cleanup/);
  }
  const expected = desiredRulesets(15368)[1];
  const actual = structuredClone(expected);
  actual.rules.find((rule) => rule.type === "required_status_checks").parameters.do_not_enforce_on_create = false;
  assert.throws(() => validateExistingRuleset(actual, expected, "squash"), /branch-creation exemption/);
});

test("missing automation, invalid defaults, truncated trees, and ambiguous rulesets fail before writes", () => {
  for (const modify of [
    (state) => { state.repository.default_branch = "master"; },
    (state) => { state.repository.permissions.admin = false; },
    (state) => { state.repository.archived = true; },
    (state) => { state.tree.truncated = true; },
    (state) => { state.tree.tree = state.tree.tree.filter((item) => !item.path.endsWith("validate-stage.mjs")); },
    (state) => { state.config.stages.spec.minimumApprovals = 99; },
    (state) => { state.rulesets.push(structuredClone(state.rulesets[0])); },
    (state) => { state.app.id = null; },
  ]) {
    const mock = fixture({ configured: true });
    modify(mock.state);
    assert.throws(() => setup(options(["--apply"]), mock.deps));
    assert.deepEqual(mock.writes(), []);
  }
});

test("missing secrets and unverified reviewers, Copilot, teams, or action policies never report readiness", () => {
  for (const [modify, message] of [
    [(state) => { state.secrets = []; }, /COPILOT_ASSIGN_TOKEN/],
    [(state) => { state.access.permission = "read"; }, /write access/],
    [(state) => { state.access.user.type = "Bot"; }, /Human/],
    [(state) => { state.config.stages.spec.reviewers.teams = ["approvers"]; }, /team membership/],
    [(state) => { state.actors.data.repository.suggestedActors.nodes = [{ __typename: "User", login: "Copilot" }]; }, /not available/],
    [(state) => { state.actions.allowed_actions = "selected"; }, /Restricted Actions policy/],
    [(state) => { state.workflows = state.workflows.filter((item) => !item.path.endsWith("stage-ci.yml")); }, /not registered/],
  ]) {
    const mock = fixture({ configured: true });
    modify(mock.state);
    const result = setup(options(["--apply"]), mock.deps);
    assert.equal(result.ready, false);
    assert.ok(result.blockers.some((text) => message.test(text)));
    assert.deepEqual(mock.writes(), []);
  }
});

test("Intent repair requires an authorized open Issue and never dispatches kickoff", () => {
  for (const patch of [{ state: "closed" }, { author_association: "CONTRIBUTOR" }, { pull_request: {} }]) {
    const mock = fixture();
    Object.assign(mock.state.issue, patch);
    assert.throws(() => setup(options(["--apply", "--intent", "7"]), mock.deps), /open Issue/);
    assert.deepEqual(mock.writes(), []);
  }
});

test("API errors and secret failures surface, partial setup can be retried, and writes are verified", () => {
  const mock = fixture();
  const api = mock.deps.api;
  assert.throws(() => setup(options(["--apply"]), {
    ...mock.deps,
    api: (method, path, body) => {
      if (method === "POST" && path === `${root}/labels`) throw new Error("HTTP 403");
      return api(method, path, body);
    },
  }), /HTTP 403/);
  assert.equal(mock.state.repository.allow_auto_merge, true);
  assert.throws(() => setup(options(["--apply", "--set-token"]), {
    ...mock.deps, setToken: () => { throw new Error("secret upload failed"); },
  }), /secret upload failed/);
  assert.equal(setup(options(["--apply", "--set-token"]), mock.deps).ready, true);
  mock.state.labels = [];
  assert.throws(() => setup(options(["--apply"]), {
    ...mock.deps,
    api: (method, path, body) => method === "POST" && path === `${root}/labels` ? {} : api(method, path, body),
  }), /Read-back verification failed/);
  mock.state.actors = { errors: [{ message: "denied" }] };
  assert.throws(() => setup(options(), mock.deps), /Copilot availability query failed/);
});
