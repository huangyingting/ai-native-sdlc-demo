import { test } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { validateApprovedFiles } from "../scripts/validate-stage.mjs";
import LifecycleErrorsReporter from "../scripts/vitest-errors-reporter.mjs";
import {
  artifactPaths,
  countHumanApprovals,
  isAuthorizedAssociation,
  isCopilotActor,
  lifecycleBranch,
  nextStage,
  normalizeCopilotStageBody,
  parsePullRequestMetadata,
  renderPrompt,
  validateConfig,
  validateExpectedFailures,
  validateImplementationPlan,
  validateSpecification,
  validateStageFiles,
  validateVitestGreen,
  validateVitestRed,
  validateVitestRunErrors,
} from "../scripts/core.mjs";

function redFixture() {
  return JSON.parse(readFileSync(new URL("./fixtures/vitest-red.json", import.meta.url), "utf8"));
}

function reportFor(assertions) {
  const report = redFixture();
  report.testResults[0].assertionResults = assertions;
  report.numTotalTests = assertions.length;
  report.numFailedTests = assertions.filter((test) => test.status === "failed").length;
  report.numPassedTests = assertions.filter((test) => test.status === "passed").length;
  report.numPendingTests = assertions.filter((test) => ["pending", "skipped"].includes(test.status)).length;
  report.numTodoTests = assertions.filter((test) => test.status === "todo").length;
  report.success = report.numFailedTests === 0;
  report.numPassedTestSuites = report.success ? 2 : 0;
  report.numFailedTestSuites = report.success ? 0 : 2;
  report.testResults[0].status = report.success ? "passed" : "failed";
  return report;
}

const config = {
  version: 1,
  mergeMethod: "squash",
  project: {
    path: "demos/it-service-desk",
    testCommand: "npm test",
    lintCommand: "npm run lint",
    buildCommand: "npm run build",
  },
  stages: Object.fromEntries(
    ["spec", "plan", "tests", "implementation"].map((stage) => [
      stage,
      {
        prompt: `.github/brownfield-human-gated-delivery/prompts/${stage}.md`,
        minimumApprovals: 1,
        reviewers: { users: ["reviewer"], teams: [] },
      },
    ]),
  ),
};

const specification = `# Specification

## Intent
Improve ownership.

## Scope
Ticket assignment.

## Non-goals
Notifications.

## Actors
Support agents.

## Constraints
Unassigned tickets remain valid.

## Acceptance scenarios

### AC-1: Assign a ticket
**Given** an unassigned ticket
**When** an agent selects an assignee
**Then** the assignee is persisted

### AC-2: Filter tickets
**Given** assigned tickets
**When** an agent filters by assignee
**Then** matching tickets are shown
`;

const plan = `# Implementation plan

## Acceptance mapping
AC-1 and AC-2 are implemented by the tasks below.

## Tasks

### TASK-1: Persist assignment
Depends on: none
Acceptance: AC-1
Surfaces: ticket store
Validation: store tests

### TASK-2: Add filtering
Depends on: TASK-1
Acceptance: AC-2
Surfaces: dashboard
Validation: filter tests

## Risks and migrations
Additive SQLite migration.

## Validation
Run tests, lint, and build.
`;

test("validates the checked-in lifecycle configuration shape", () => {
  assert.equal(validateConfig(config), config);
  assert.throws(
    () => validateConfig({ ...config, unknown: true }),
    /Unknown config key/,
  );
  const invalid = structuredClone(config);
  invalid.stages.spec.minimumApprovals = 2;
  assert.throws(() => validateConfig(invalid), /exceeds configured reviewers/);
});

test("authorizes only trusted repository associations", () => {
  assert.equal(isAuthorizedAssociation("OWNER"), true);
  assert.equal(isAuthorizedAssociation("member"), true);
  assert.equal(isAuthorizedAssociation("COLLABORATOR"), true);
  assert.equal(isAuthorizedAssociation("CONTRIBUTOR"), false);
});

test("recognizes current and legacy Copilot bot actors without accepting lookalike users", () => {
  for (const login of ["Copilot", "copilot-swe-agent", "copilot-swe-agent[bot]"]) {
    assert.equal(isCopilotActor({ login, type: "Bot" }), true);
    assert.equal(isCopilotActor({ login, __typename: "Bot" }), true);
    assert.equal(isCopilotActor({ login, type: "User" }), false);
    assert.equal(isCopilotActor({ login }), false);
  }
  for (const login of ["my-copilot-swe-agent", "copilot-reviewer[bot]", "dependabot[bot]"]) {
    assert.equal(isCopilotActor({ login, type: "Bot" }), false);
  }
  assert.equal(isCopilotActor(null), false);
});

test("normalizes only the recognized Copilot suffix referencing this stage Issue", () => {
  const metadata = [
    "Delivery Demo: brownfield-human-gated-delivery",
    "Delivery Intent: #7",
    "Delivery Stage: spec",
    "Delivery Stage Issue: #8",
  ].join("\n");
  const suffix = "\n\n<!-- START COPILOT CODING AGENT SUFFIX -->\n\n- Fixes #8";
  const author = { login: "Copilot", type: "Bot" };
  for (const newline of ["\n", "\r\n"]) {
    const body = (metadata + suffix).replaceAll("\n", newline);
    const normalized = normalizeCopilotStageBody(body, author);
    assert.equal(normalized, body.replace("- Fixes #8", "- References #8"));
    assert.equal(parsePullRequestMetadata(normalized).stageIssueNumber, 8);
    assert.throws(() => parsePullRequestMetadata(body), /Closing keywords/);
    assert.equal(normalizeCopilotStageBody(normalized, author), normalized);
  }
  assert.equal(normalizeCopilotStageBody(metadata, author), metadata);
  assert.equal(normalizeCopilotStageBody(metadata + suffix, { login: "Copilot", type: "User" }), metadata + suffix);
  for (const body of [
    metadata + suffix.replace("Fixes #8", "Fixes #7"),
    metadata + suffix.replace("Fixes #8", "Fixes #999"),
    metadata + "\n\nFixes #8",
    metadata + "\n\nFixes #99" + suffix,
    metadata + suffix + "\n\nFixes #7",
    metadata + suffix.replace("Fixes #8", "Fixes other/repo#8"),
    metadata + suffix.replace("Fixes #8", "Fixes https://github.com/example/repo/issues/7"),
  ]) {
    assert.throws(
      () => parsePullRequestMetadata(normalizeCopilotStageBody(body, author)),
      /Closing keywords|stage Issue/,
    );
  }
});

test("builds lifecycle names and ordered transitions", () => {
  assert.equal(lifecycleBranch(42), "brownfield-delivery/42");
  assert.deepEqual(artifactPaths(42), {
    root: "docs/delivery-runs/brownfield-human-gated-delivery/42",
    spec: "docs/delivery-runs/brownfield-human-gated-delivery/42/spec.md",
    plan: "docs/delivery-runs/brownfield-human-gated-delivery/42/plan.md",
    expectedFailures:
      "docs/delivery-runs/brownfield-human-gated-delivery/42/expected-failures.json",
  });
  assert.equal(nextStage("spec"), "plan");
  assert.equal(nextStage("implementation"), null);
});

test("parses strict PR metadata and rejects closing references", () => {
  assert.deepEqual(parsePullRequestMetadata(`Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #42
Delivery Stage: tests
Delivery Stage Issue: #45`), {
    demo: "brownfield-human-gated-delivery",
    intentNumber: 42,
    stage: "tests",
    stageIssueNumber: 45,
  });
  assert.throws(
    () => parsePullRequestMetadata(`Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #42
Delivery Stage: tests
Delivery Stage Issue: #45
Fixes #45`),
    /Closing keywords/,
  );
  assert.throws(
    () => parsePullRequestMetadata(
      "Delivery Demo: brownfield-human-gated-delivery",
    ),
    /Delivery Intent/,
  );
});

test("renders stage prompts without leaving unknown placeholders", () => {
  assert.equal(
    renderPrompt("Intent {{intent}}, issue {{stage_issue}}", {
      intent: 42,
      stage_issue: 45,
    }),
    "Intent 42, issue 45",
  );
  assert.throws(() => renderPrompt("{{missing}}", {}), /Missing prompt value/);
});

test("Spec and Plan prompts keep human feedback in the same stage until approval", () => {
  for (const stage of ["spec", "plan"]) {
    const prompt = renderPrompt(readFileSync(config.stages[stage].prompt, "utf8"), {
      intent: 42,
      stage_issue: stage === "spec" ? 43 : 44,
    });
    assert.match(prompt, /same pull request/i);
    assert.match(prompt, /open questions/i);
    assert.match(prompt, /explicit Human approval/);
    assert.match(prompt, /Do not start the next stage/);
    assert.match(prompt, /Do not use closing keywords/);
    const label = stage === "spec" ? "Spec review" : "Plan review";
    assert.ok(prompt.includes(`[Brownfield Delivery #42][${label}]`));
    for (const heading of ["Summary", "Review document", "Open questions", "Review checklist"]) {
      assert.ok(prompt.includes(`## ${heading}`), `${stage} needs a ${heading} PR section`);
    }
    assert.match(prompt, /\/blob\/<current-head-sha>\//);
    assert.match(prompt, /checklist.*not.*approval/i);
    assert.equal(parsePullRequestMetadata(prompt).stage, stage);
  }
  const spec = readFileSync(config.stages.spec.prompt, "utf8");
  assert.match(spec, /human-authored Intent/);
  assert.match(spec, /Do not rewrite the Intent/);
});

test("counts only current configured human approvals", () => {
  const policy = {
    minimumApprovals: 2,
    reviewers: { users: ["alice"], teams: ["maintainers"] },
  };
  const result = countHumanApprovals([
    { id: 1, state: "APPROVED", user: { login: "alice", type: "User" } },
    { id: 2, state: "CHANGES_REQUESTED", user: { login: "alice", type: "User" } },
    { id: 3, state: "APPROVED", user: { login: "bob", type: "User" } },
    { id: 4, state: "APPROVED", user: { login: "copilot-swe-agent[bot]", type: "Bot" } },
    { id: 5, state: "APPROVED", user: { login: "carol", type: "User" } },
  ], policy, "carol", ["bob"]);
  assert.deepEqual(result, {
    approved: ["bob"],
    changesRequested: ["alice"],
    satisfied: false,
  });
});

  test("comments and pending reviews preserve decisive decisions; dismissal and new heads invalidate approvals", () => {
    const policy = { minimumApprovals: 1, reviewers: { users: ["alice"], teams: [] } };
    const make = (id, state, login = "alice", commit_id = "head") =>
      ({ id, state, user: { login, type: "User" }, commit_id });
    const aggregate = (reviews) => countHumanApprovals(reviews, policy, "agent", [], "head");
    assert.equal(aggregate([make(1, "APPROVED"), make(2, "COMMENTED"), make(3, "PENDING")]).satisfied, true);
    assert.equal(aggregate([make(1, "CHANGES_REQUESTED"), make(2, "COMMENTED")]).satisfied, false);
    assert.equal(aggregate([make(1, "APPROVED"), make(2, "DISMISSED"), make(3, "COMMENTED")]).satisfied, false);
    assert.equal(aggregate([make(3, "APPROVED", "ALICE"), make(2, "DISMISSED"), make(1, "CHANGES_REQUESTED")]).satisfied, true);
    assert.equal(aggregate([make(1, "APPROVED", "alice", "old-head")]).satisfied, false);
    assert.deepEqual(aggregate([make(1, "CHANGES_REQUESTED", "alice", "old-head")]).changesRequested, ["alice"]);
  });

  test("rejects real Vitest collection errors alongside legitimate expected Red assertions", () => {
    const report = redFixture();
    const expected = new Set(["TicketStore assigns a ticket", "TicketStore filters assignees"]);
    assert.deepEqual(validateVitestRed(report, expected), [...expected]);
    report.testResults.push(JSON.parse(readFileSync(
      new URL("./fixtures/vitest-collection-error.json", import.meta.url), "utf8",
    )));
    assert.throws(() => validateVitestRed(report, expected), /collection or runtime error/);
    report.testResults[1].message = "";
    assert.throws(() => validateVitestRed(report, expected), /collection or runtime error/);
  });

  test("rejects malformed, runtime, skipped, duplicate and inconsistent Red evidence", () => {
    const expected = new Set(["TicketStore assigns a ticket", "TicketStore filters assignees"]);
    for (const bad of [
      null, {}, { testResults: [] },
      { ...redFixture(), numTotalTests: 900 },
      { ...redFixture(), unhandledErrors: ["Unhandled rejection"] },
      { ...redFixture(), numRuntimeErrorTestSuites: 1 },
      { ...redFixture(), testResults: [{ status: "failed", assertionResults: {} }] },
    ]) {
      assert.throws(() => validateVitestRed(bad, expected));
    }
    for (const status of ["skipped", "pending", "todo", "passed"]) {
      const assertions = redFixture().testResults[0].assertionResults;
      assertions[0].status = status;
      assert.throws(() => validateVitestRed(reportFor(assertions), expected), /Red test mismatch/);
    }
    const assertions = redFixture().testResults[0].assertionResults;
    assertions.push({ ...assertions[0], status: "passed" });
    assert.throws(() => validateVitestRed(reportFor(assertions), expected), /Duplicate expected/);
  });

  test("captures errors missing from the stock Vitest JSON reporter", () => {
    const path = join(import.meta.dirname, `.errors-${process.pid}.json`);
    const previous = process.env.VITEST_ERRORS_REPORT;
    process.env.VITEST_ERRORS_REPORT = path;
    try {
      const reporter = new LifecycleErrorsReporter();
      reporter.onTestRunEnd([], [], "failed");
      validateVitestRunErrors(JSON.parse(readFileSync(path, "utf8")));
      reporter.onTestRunEnd([{
        errors: () => [],
        children: { allSuites: () => [{ errors: () => [{ message: "beforeAll failed" }] }] },
      }], [{ message: "unhandled rejection" }], "failed");
      const evidence = JSON.parse(readFileSync(path, "utf8"));
      assert.deepEqual(evidence.suiteErrors, ["beforeAll failed"]);
      assert.deepEqual(evidence.unhandledErrors, ["unhandled rejection"]);
      assert.throws(() => validateVitestRunErrors(evidence), /runtime, unhandled/);
      assert.throws(() => validateVitestRunErrors({ reason: "interrupted", suiteErrors: [], unhandledErrors: [] }));
      assert.throws(() => validateVitestRunErrors({ reason: "failed" }));
    } finally {
      if (previous === undefined) delete process.env.VITEST_ERRORS_REPORT;
      else process.env.VITEST_ERRORS_REPORT = previous;
      rmSync(path, { force: true });
    }
  });

  test("freezes approved test blobs while allowing implementation and tests in new files", () => {
    const cwd = join(import.meta.dirname, `.git-fixture-${process.pid}`);
    mkdirSync(cwd);
    const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    const tree = (files) => {
      git("read-tree", "--empty");
      for (const [path, content] of Object.entries(files)) {
        const sha = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd, input: content, encoding: "utf8" }).trim();
        git("update-index", "--add", "--cacheinfo", "100644", sha, path);
      }
      return git("write-tree");
    };
    try {
      git("init", "--quiet");
      const paths = artifactPaths(42);
      const testPath = "demos/it-service-desk/src/ticket.test.ts";
      const approved = {
        [paths.spec]: specification, [paths.plan]: plan, [paths.expectedFailures]: "{}",
        [testPath]: 'test("approved acceptance", () => expect(actual).toBe("alice"))',
      };
      const approvedTree = tree(approved);
      const implementation = {
        ...approved,
        "demos/it-service-desk/src/ticket.ts": "export const actual = 'alice';",
        "demos/it-service-desk/src/new.test.ts": 'test("additional", () => expect(1).toBe(1))',
      };
      assert.equal(validateApprovedFiles(42, config.project.path, approvedTree, tree(implementation), cwd).length, 4);
      assert.throws(() => validateApprovedFiles(42, config.project.path, approvedTree, tree({
        ...implementation, [testPath]: 'test("approved acceptance", () => expect(true).toBe(true))',
      }), cwd), /Approved file was modified/);
      const renamed = { ...implementation, "demos/it-service-desk/src/renamed.test.ts": approved[testPath] };
      delete renamed[testPath];
      assert.throws(() => validateApprovedFiles(42, config.project.path, approvedTree, tree(renamed), cwd), /deleted or renamed/);
      delete renamed["demos/it-service-desk/src/renamed.test.ts"];
      assert.throws(() => validateApprovedFiles(42, config.project.path, approvedTree, tree(renamed), cwd), /deleted or renamed/);
      const receiptPath = `${paths.root}/document-review.json`;
      const issueApproved = { ...approved, [receiptPath]: '{"sealed":true}' };
      const issueImplementation = { ...implementation, [receiptPath]: issueApproved[receiptPath] };
      const issueTree = tree(issueApproved);
      assert.equal(validateApprovedFiles(42, config.project.path, issueTree, tree(issueImplementation), cwd).length, 5);
      assert.throws(() => validateApprovedFiles(42, config.project.path, issueTree, tree({
        ...issueImplementation, [receiptPath]: '{"sealed":false}',
      }), cwd), /Approved file was modified/);
      assert.throws(() => validateApprovedFiles(42, config.project.path, issueTree, tree(implementation), cwd), /deleted or renamed/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

test("trusted validators load their own configuration rather than PR-working-directory policy", () => {
  const cwd = join(import.meta.dirname, `.untrusted-config-${process.pid}`);
  const configDirectory = join(cwd, ".github/brownfield-human-gated-delivery");
  mkdirSync(configDirectory, { recursive: true });
  writeFileSync(join(configDirectory, "config.json"), '{"project":{"path":"untrusted"}}');
  try {
    const moduleUrl = new URL("../scripts/core.mjs", import.meta.url).href;
    const result = execFileSync(process.execPath, ["--input-type=module", "-e",
      `import {loadConfig} from ${JSON.stringify(moduleUrl)}; console.log(loadConfig().project.path);`,
    ], { cwd, encoding: "utf8" });
    assert.equal(result.trim(), "demos/it-service-desk");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("installed Vitest runtime distinguishes broken hooks from legitimate Red and Green", {
  skip: !existsSync("demos/it-service-desk/node_modules/vitest/vitest.mjs") &&
    "Install the demo dependencies to run the actual Vitest reporter regressions.",
}, async (t) => {
  const scratch = join(import.meta.dirname, `.vitest-runtime-${process.pid}`);
  const fixtures = join(import.meta.dirname, "fixtures/hooks");
  mkdirSync(scratch);
  try {
    for (const [file, hook] of [
      ["controlled-red", null],
      ["setup-failure", "beforeEach"],
      ["teardown-failure", "afterEach"],
      ["passing", null],
    ]) {
      await t.test(file, () => {
        const reportPath = join(scratch, `${file}.json`);
        const errorsPath = join(scratch, `${file}-errors.json`);
        const result = spawnSync(process.execPath, [
          resolve("demos/it-service-desk/node_modules/vitest/vitest.mjs"),
          "run", `${file}.test.js`, "--root", fixtures,
          "--config", join(fixtures, "vitest.config.mjs"),
          "--reporter=json",
          `--reporter=${resolve(".github/brownfield-human-gated-delivery/scripts/vitest-errors-reporter.mjs")}`,
          `--outputFile=${reportPath}`,
        ], {
          encoding: "utf8", timeout: 30000,
          env: { ...process.env, VITEST_ERRORS_REPORT: errorsPath, LIFECYCLE_RUNTIME_SCRATCH: join(scratch, "cache") },
        });
        assert.equal(result.status, file === "passing" ? 0 : 1, result.stderr || result.stdout);
        const report = JSON.parse(readFileSync(reportPath, "utf8"));
        const evidence = JSON.parse(readFileSync(errorsPath, "utf8"));
        const expected = new Set(["expected behavior"]);
        if (hook) {
          assert.ok(evidence.hookErrors.some((error) => error.name === hook));
          assert.throws(() => {
            validateVitestRunErrors(evidence);
            validateVitestRed(report, expected);
          }, /runtime, unhandled/);
        } else {
          validateVitestRunErrors(evidence);
          if (file === "passing") validateVitestGreen(report, expected);
          else validateVitestRed(report, expected);
        }
      });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("validates specification scenarios and implementation plan dependencies", () => {
  const acceptance = validateSpecification(specification);
  assert.deepEqual(acceptance, ["AC-1", "AC-2"]);
  const tasks = validateImplementationPlan(plan, acceptance);
  assert.deepEqual([...tasks.keys()], ["TASK-1", "TASK-2"]);
  assert.throws(
    () => validateImplementationPlan(
      plan.replace("Depends on: TASK-1", "Depends on: TASK-2"),
      acceptance,
    ),
    /dependency cycle/,
  );
});

test("validates expected failures and exact Vitest Red evidence", () => {
  const expected = validateExpectedFailures({
    version: 1,
    intent: 42,
    tests: [
      { name: "TicketStore assigns a ticket", acceptance: ["AC-1"] },
      { name: "TicketStore filters assignees", acceptance: ["AC-2"] },
    ],
  }, 42, ["AC-1", "AC-2"]);
  assert.deepEqual([...expected], [
    "TicketStore assigns a ticket",
    "TicketStore filters assignees",
  ]);
  assert.deepEqual(validateVitestRed(reportFor([
        { fullName: "TicketStore assigns a ticket", status: "failed" },
        { fullName: "TicketStore filters assignees", status: "failed" },
        { fullName: "TicketStore creates tickets", status: "passed" },
      ]), expected), [...expected]);
  assert.throws(
    () => validateVitestRed(reportFor([
          { fullName: "TicketStore assigns a ticket", status: "failed" },
          { fullName: "unrelated regression", status: "failed" },
        ]), expected),
    /Red test mismatch/,
  );
  assert.deepEqual(validateVitestGreen(reportFor([
        { fullName: "TicketStore assigns a ticket", status: "passed" },
        { fullName: "TicketStore filters assignees", status: "passed" },
        { fullName: "TicketStore creates tickets", status: "passed" },
      ]), expected), [...expected]);
});

test("restricts files by lifecycle stage", () => {
  assert.deepEqual(
    validateStageFiles(
      "spec",
      ["docs/delivery-runs/brownfield-human-gated-delivery/42/spec.md"],
      42,
      config.project.path,
    ),
    ["docs/delivery-runs/brownfield-human-gated-delivery/42/spec.md"],
  );
  assert.deepEqual(
    validateStageFiles("tests", [
      "docs/delivery-runs/brownfield-human-gated-delivery/42/expected-failures.json",
      "demos/it-service-desk/src/lib/ticket-store.test.ts",
    ], 42, config.project.path),
    [
      "docs/delivery-runs/brownfield-human-gated-delivery/42/expected-failures.json",
      "demos/it-service-desk/src/lib/ticket-store.test.ts",
    ],
  );
  assert.throws(
    () => validateStageFiles("tests", [
      "demos/it-service-desk/src/lib/ticket-store.ts",
      "docs/delivery-runs/brownfield-human-gated-delivery/42/expected-failures.json",
    ], 42, config.project.path),
    /non-test change/,
  );
  assert.throws(
    () => validateStageFiles("implementation", [
      "docs/delivery-runs/brownfield-human-gated-delivery/42/spec.md",
      ".github/workflows/untrusted.yml",
      "demos/it-service-desk/src/lib/ticket.ts",
    ], 42, config.project.path),
    /out-of-scope change/,
  );
});

test("prefills a complete editable brownfield demo intent rather than placeholder hints", () => {
  const issueForm = readFileSync(
    ".github/ISSUE_TEMPLATE/brownfield-human-gated-delivery-intent.yml",
    "utf8",
  );

  assert.match(issueForm, /^title: "\[Brownfield delivery\] Clarify ticket ownership"$/m);
  const fields = issueForm.split(/^  - type: /m).slice(1);
  for (const id of ["problem", "outcome", "users", "constraints", "open_questions"]) {
    const field = fields.find((entry) => entry.includes(`\n    id: ${id}\n`));
    assert.ok(field?.startsWith("textarea\n"), `${id} must remain editable`);
    assert.match(field, /^      value: \|\n(?:        .+\n)+/m, `${id} needs submitted default text`);
    assert.doesNotMatch(field, /^      placeholder:/m, `${id} must not rely on a hint`);
    assert.match(field, /^      required: true$/m, `${id} must remain required`);
  }
  assert.match(issueForm, /label: Affected users and systems/);
  assert.match(issueForm, /label: Open questions/);
  assert.match(issueForm, /here in this Issue, not in document pull requests/);
  assert.match(issueForm, /\/sdlc approve spec vN/);
  assert.doesNotMatch(issueForm, /id: success|Given\/When\/Then|container smoke checks/);
});

test("keeps staged workflows and trusted boundaries synchronized", () => {
  const checkedConfig = validateConfig(
    JSON.parse(
      readFileSync(
        ".github/brownfield-human-gated-delivery/config.json",
        "utf8",
      ),
    ),
  );
  for (const stage of ["spec", "plan", "tests", "implementation"]) {
    assert.match(
      readFileSync(checkedConfig.stages[stage].prompt, "utf8"),
      /Delivery Demo: brownfield-human-gated-delivery/,
    );
  }

  const issueForm = readFileSync(
    ".github/ISSUE_TEMPLATE/brownfield-human-gated-delivery-intent.yml",
    "utf8",
  );
  const coordinator = readFileSync(
    ".github/workflows/brownfield-human-gated-delivery-pr-coordinator.yml",
    "utf8",
  );
  const stageCi = readFileSync(
    ".github/workflows/brownfield-human-gated-delivery-stage-ci.yml",
    "utf8",
  );
  const delivery = readFileSync(
    ".github/workflows/brownfield-human-gated-delivery-publish.yml",
    "utf8",
  );

  assert.match(
    issueForm,
    /labels: \["brownfield-human-gated-delivery:intent"\]/,
  );
  assert.match(coordinator, /pull_request_target:/);
  assert.match(coordinator, /types: \[opened, reopened, closed, edited, synchronize/);
  assert.doesNotMatch(coordinator, /pull_request\.head\.sha/);
  assert.match(coordinator, /COPILOT_ASSIGN_TOKEN/);
  assert.match(stageCi, /permissions:\s*\n  contents: read/);
  assert.doesNotMatch(stageCi, /COPILOT_ASSIGN_TOKEN/);
  assert.match(stageCi, /expected controlled Red/);
  assert.match(stageCi, /Validate expected Red tests are Green/);
  assert.match(delivery, /Delivery Stage: implementation/);
  assert.match(delivery, /grep --fixed-strings 'data-testid="service-desk-dashboard"'/);
  assert.doesNotMatch(delivery, /IT support tickets/);
  assert.match(delivery, /DELIVERY_RETRY: "true"/);
  assert.match(stageCi, /types: \[opened, reopened, synchronize, edited, ready_for_review, converted_to_draft\]/);
  assert.match(stageCi, /stage-validation:\s+if: always\(\)/);
  assert.doesNotMatch(stageCi, /if: contains\(github.event.pull_request.body/);
  assert.match(stageCi, /git diff --name-only --no-renames/);
  assert.match(stageCi, /base.sha }}\.\.\.\$\{\{ github.event.pull_request.head.sha/);
  assert.match(stageCi, /validate-stage.mjs" approved/);
  assert.equal((stageCi.match(/ref: \$\{\{ needs.classify.outputs.trusted-sha \}\}/g) ?? []).length, 3);
  assert.equal((stageCi.match(/path: trusted/g) ?? []).length, 3);
  assert.equal((stageCi.match(/working-directory: pr$/gm) ?? []).length, 3);
  assert.match(stageCi, /trusted-sha=\$\(git rev-parse HEAD\)/);
  assert.doesNotMatch(stageCi, /node \.github\/.*validate-stage|--reporter=\.\.\/\.\.\/\.github/);
  assert.match(stageCi, /node "\$GITHUB_WORKSPACE\/trusted\/\.github\/.*validate-stage.mjs" artifacts/);
  assert.match(stageCi, /--reporter="\$GITHUB_WORKSPACE\/trusted\/\.github\/.*vitest-errors-reporter.mjs"/);
  assert.match(stageCi, /vitest-errors-reporter.mjs/);
  assert.match(coordinator, /statuses: write/);
  assert.match(coordinator, /workflow_run:/);
  assert.match(coordinator, /every run reconciles all open PRs/);
  assert.match(coordinator, /cancel-in-progress: false/);
  assert.doesNotMatch(coordinator, /pull_request_review:/);
  const signal = readFileSync(".github/workflows/brownfield-human-gated-delivery-review-signal.yml", "utf8");
  assert.match(signal, /types: \[submitted, dismissed, edited\]/);
  assert.match(signal, /permissions: \{\}/);
  assert.doesNotMatch(signal, /checkout|secrets\./);
  const aggregate = stageCi.slice(stageCi.indexOf("  stage-validation:"))
    .split("run: |\n")[1].replace(/^ {10}/gm, "");
  const runAggregate = (env) => execFileSync("bash", ["-e", "-c", aggregate], {
    env: { ...process.env, CLASSIFY: "success", LIFECYCLE: "true", STAGE: "tests", RED: "success", ...env },
    stdio: "pipe",
  });
  assert.doesNotThrow(() => runAggregate({ LIFECYCLE: "false", STAGE: "", RED: "skipped" }));
  assert.doesNotThrow(() => runAggregate({}));
  assert.throws(() => runAggregate({ CLASSIFY: "failure", LIFECYCLE: "false" }));
  assert.throws(() => runAggregate({ RED: "skipped" }));
  assert.throws(() => runAggregate({ RED: "failure" }));
  assert.throws(() => runAggregate({ STAGE: "implementation", IMPLEMENTATION: "failure" }));
  assert.doesNotThrow(() => runAggregate({ STAGE: "implementation", IMPLEMENTATION: "success" }));
});
