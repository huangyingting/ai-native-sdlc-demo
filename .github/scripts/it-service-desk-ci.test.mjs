import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(".github/workflows/it-service-desk-ci.yml", "utf8");
const stageCi = readFileSync(".github/workflows/brownfield-human-gated-delivery-stage-ci.yml", "utf8");
const pullRequestTrigger = workflow.match(/^  pull_request:([\s\S]*?)(?=^  push:)/m)?.[1];

test("required application checks run for documentation and tooling pull requests", () => {
  assert.ok(pullRequestTrigger, "The application CI workflow must handle pull requests.");
  assert.doesNotMatch(pullRequestTrigger, /\b(?:paths|paths-ignore|branches|branches-ignore):/);
  assert.match(workflow, /^  validate:/m);
  assert.match(workflow, /^  container-smoke:/m);
});

test("application checks re-evaluate edited TDD metadata without requiring another commit", () => {
  const types = pullRequestTrigger?.match(/types:\s*\[([^\]]+)\]/)?.[1]
    .split(",").map((type) => type.trim()) ?? [];
  for (const type of ["opened", "reopened", "synchronize", "edited", "ready_for_review"]) {
    assert.ok(types.includes(type), `Missing pull_request event: ${type}`);
  }
});

test("application CI retains path-scoped main pushes", () => {
  const pushTrigger = workflow.match(/^  push:([\s\S]*?)(?=^permissions:)/m)?.[1];
  assert.ok(pushTrigger);
  assert.match(pushTrigger, /branches: \[main\]/);
  assert.match(pushTrigger, /paths:[\s\S]*"demos\/it-service-desk\/\*\*"/);
});

test("operators can validate a prepared baseline without a dummy application change", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
});

test("application jobs skip only pre-implementation lifecycle stages, never default-branch checks", () => {
  const conditions = ["validate", "container-smoke"].map((job) => {
    const condition = workflow.match(new RegExp(`^  ${job}:\\n(?:    needs: [^\\n]+\\n)?    if: >-\\n([\\s\\S]*?)(?=^    runs-on:)`, "m"))?.[1];
    assert.ok(condition, `${job} must have a routing condition`);
    return condition;
  });
  const cases = [];
  for (const stage of ["spec", "plan", "tests", "implementation", "unknown"]) {
    const body = `Delivery Demo: brownfield-human-gated-delivery\nDelivery Stage: ${stage}`;
    const preImplementation = ["spec", "plan", "tests"].includes(stage);
    cases.push(
      { base: "brownfield-delivery/7", body, expected: !preImplementation },
      { base: "brownfield-delivery/7", body: body.toUpperCase(), expected: !preImplementation },
      { base: "main", body, expected: true },
      { base: "release", body, expected: true },
      { base: "brownfield-delivery/7", body: `Delivery Stage: ${stage}`, expected: true },
    );
  }
  cases.push(
    { base: "main", body: "Documentation update", expected: true },
    { base: "brownfield-delivery/7", body: "", expected: true },
    { event: "push", expected: true },
    { event: "workflow_dispatch", expected: true },
  );
  for (const condition of conditions) {
    for (const { base, body, expected, event = "pull_request" } of cases) {
      const actual = runInNewContext(condition, {
        github: { event_name: event, event: {
          repository: { default_branch: "main" },
          pull_request: event === "pull_request" ? { base: { ref: base }, body } : undefined,
        } },
        contains: (value, search) => String(value ?? "").toLowerCase().includes(search.toLowerCase()),
        startsWith: (value, search) => String(value ?? "").toLowerCase().startsWith(search.toLowerCase()),
      }, { timeout: 100 });
      assert.equal(actual, expected, `Unexpected application CI for ${event}, ${base}, ${body}`);
    }
  }
});

test("Spec and Plan stage validation is document-only, not application build or test execution", () => {
  const artifactJob = stageCi.match(/^  artifact-gate:\n([\s\S]*?)(?=^  tdd-red:)/m)?.[1];
  assert.ok(artifactJob);
  assert.match(artifactJob, /outputs.stage == 'spec' \|\|\s+needs.classify.outputs.stage == 'plan'/);
  assert.match(artifactJob, /validate-stage.mjs" artifacts/);
  assert.doesNotMatch(artifactJob, /\b(?:npm|npx|docker|vitest)\b/);
});

test("default-branch PRs cannot skip required Green checks through body text", () => {
  const defaultBranchGuard =
    "github.event.pull_request.base.ref == github.event.repository.default_branch";
  assert.equal(workflow.split(defaultBranchGuard).length - 1, 2);
});

test("CI exercises real Vitest hook regressions after installing demo dependencies", () => {
  assert.match(workflow, /- run: npm ci[\s\S]*?name: Verify lifecycle hook reporter against installed Vitest/);
  assert.match(workflow, /working-directory: \.\n\s+run: >-\n\s+node --test --test-name-pattern="installed Vitest runtime"\n\s+\.github\/brownfield-human-gated-delivery\/tests\/core\.test\.mjs/);
});

for (const [phase, job, captureName, validationName] of [
  ["red", "tdd-red", "Capture expected Red", "Validate exact Red evidence"],
  ["green", "implementation-contract", "Capture Green test evidence", "Validate expected Red tests are Green"],
]) {
  test(`${phase} CI preserves attempt-specific reports without weakening validation`, () => {
    const definition = stageCi.match(new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [\\w-]+:)`, "m"))?.[1];
    assert.ok(definition);
    const steps = definition.split(/^      - /m).slice(1);
    const captureIndex = steps.findIndex((step) => step.startsWith(`name: ${captureName}\n`));
    const validationIndex = steps.findIndex((step) => step.startsWith(`name: ${validationName}\n`));
    const uploads = steps.filter((step) => step.includes("uses: actions/upload-artifact@v7"));
    assert.equal(uploads.length, 1, "Each test stage must preserve its report pair.");
    const upload = uploads[0];
    assert.ok(captureIndex >= 0 && validationIndex > captureIndex);
    assert.ok(steps.indexOf(upload) > validationIndex, "Upload failures must not prevent validation.");
    assert.match(steps[captureIndex], new RegExp(`\\bid: ${phase}\\b`));
    assert.match(upload, new RegExp(`name: brownfield-${phase}-\\$\\{\\{ github.run_id \\}\\}-attempt-\\$\\{\\{ github.run_attempt \\}\\}`));
    assert.match(upload, /if-no-files-found: error/);
    assert.match(upload, /retention-days: 14\b/);
    assert.doesNotMatch(upload, /overwrite: true|archive: false/);
    assert.doesNotMatch(definition, /continue-on-error:/);

    const paths = upload.match(/          path: \|\n((?:            [^\n]+\n)+)/)?.[1]
      .trim().split("\n").map((path) => path.trim());
    assert.deepEqual(paths, [
      `\${{ runner.temp }}/vitest-${phase}.json`,
      `\${{ runner.temp }}/vitest-${phase}-errors.json`,
    ]);

    const condition = upload.match(/if: \$\{\{ (.+) \}\}/)?.[1];
    assert.ok(condition, "Report upload needs an explicit failure-aware condition.");
    for (const cancelled of [false, true]) {
      for (const outcome of ["success", "failure", "skipped", "cancelled", ""]) {
        const actual = runInNewContext(condition, {
          cancelled: () => cancelled,
          steps: { [phase]: { outcome } },
        }, { timeout: 100 });
        assert.equal(actual, !cancelled && ["success", "failure"].includes(outcome),
          `Unexpected upload for ${phase}: cancelled=${cancelled}, capture=${outcome}`);
      }
    }
  });
}
