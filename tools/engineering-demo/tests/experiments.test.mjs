import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { approveImpact, benchmark, callAgent, proposalDigest, summarizeCells, validateDiagnosis, validateImpactProposal } from "../experiments.mjs";
import { CASE_IDS, getCase, IMPACT_CONTRACT } from "../cases.mjs";
import { exportFixture, root as source, treeHash, writeJson } from "../workspace.mjs";
import { parseTap } from "../validation.mjs";

test("diagnosis requires source-grounded citations rather than plausible prose", () => {
  const files = { "src/domain.mjs": "return ticket.owner === filter.owner;" };
  assert.equal(validateDiagnosis({ classification: "product", evidence: [{ path: "src/domain.mjs", quote: "ticket.owner === filter.owner" }] }, files), true);
  for (const value of [
    { classification: "product", evidence: [] },
    { classification: "product", evidence: [{ path: "src/domain.mjs", quote: "invented code" }] },
    { classification: "guessed", evidence: [{ path: "src/domain.mjs", quote: files["src/domain.mjs"] }] },
  ]) assert.equal(validateDiagnosis(value, files), false);
});

function proposalFixture() {
  const files = Object.fromEntries(IMPACT_CONTRACT.requiredSurfaces.map((path) => [path, "Existing source contract"]));
  const candidate = {
    impacts: Object.keys(files).map((path) => ({ path, quote: files[path], reason: "Needs compatible proxy semantics." })),
    decisions: [{ question: "one", selected: "one", rationale: "explicit contract" }, { question: "two", selected: "two", rationale: "preserve compatibility" }],
    acceptanceCriteria: ["one", "two", "three", "four"], plan: ["one", "two", "three"],
    spec: "The temporary proxy preserves the accountable owner and old rows.",
  };
  return { files, candidate };
}

test("impact analysis must cover every known surface with exact quotes", () => {
  const { files, candidate } = proposalFixture();
  validateImpactProposal(candidate, files);
  assert.throws(() => validateImpactProposal({ ...candidate, impacts: candidate.impacts.slice(1) }, files), /missed/);
  assert.throws(() => validateImpactProposal({ ...candidate, impacts: [...candidate.impacts, candidate.impacts[0]] }, files));
});

test("impact analysis accepts multiple distinct facts per file and unchanged consumers", () => {
  const { files, candidate } = proposalFixture();
  files["src/cli.mjs"] = "console.log(JSON.stringify(listTickets(store)));";
  candidate.impacts.push(
    { path: "src/domain.mjs", quote: "Existing source", reason: "A separate existing fact from the same domain file." },
    { path: "src/cli.mjs", quote: files["src/cli.mjs"], reason: "Unchanged consumer must keep serializing compatible fields." },
  );
  validateImpactProposal(candidate, files);
  assert.throws(() => validateImpactProposal({
    ...candidate, impacts: [...candidate.impacts, { path: "hidden-oracle.mjs", quote: "invented", reason: "An unavailable hidden file." }],
  }, files));
});
test("review binds current proposal, source fixture and acceptance contract and cannot be replayed", () => {
  const dir = mkdtempSync(join(tmpdir(), "engineering-review-"));
  try {
    const { files, candidate } = proposalFixture();
    const source = { commit: "a".repeat(40), fixtureHash: treeHash(files) };
    const proposal = { version: 1, source, contractHash: proposalDigest(IMPACT_CONTRACT), candidate };
    const hash = proposalDigest(proposal);
    writeJson(join(dir, "baseline.json"), files);
    writeJson(join(dir, "proposal.json"), proposal);
    writeJson(join(dir, "report.json"), { status: "awaiting-operator-review", kind: "engineering-impact-review", source, proposalHash: hash });
    assert.throws(() => approveImpact({ run: dir, proposalHash: "wrong", reviewer: "operator" }), /stale/);
    const result = approveImpact({ run: dir, proposalHash: hash, reviewer: "operator" });
    assert.equal(result.independentHumanReview, false);
    assert.throws(() => approveImpact({ run: dir, proposalHash: hash, reviewer: "operator" }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("TAP parser rejects missing or duplicate totals and preserves failed test counts", () => {
  const output = "# tests 3\n# pass 2\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n";
  assert.deepEqual(parseTap(output), { tests: 3, pass: 2, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
  assert.equal(parseTap(output + "# tests 3\n").tests, null);
  assert.equal(parseTap("no evidence").tests, null);
});

test("comparison retains failed cells and does not turn missing costs into zero", () => {
  const summary = summarizeCells([
    { strategy: "direct", passed: true, calls: [{}], wallMs: 10 },
    { strategy: "direct", passed: false, falseCompletion: true, calls: [{}], wallMs: 20 },
    { strategy: "diagnose-first", passed: true, calls: [{}, {}], wallMs: 40 },
  ]);
  assert.equal(summary[0].passed, 1);
  assert.equal(summary[0].falseCompletionClaims, 1);
  assert.equal(summary[0].dollarCost, null);
  assert.equal(summary[1].calls, 2);
});

test("verified fixes with rejected citations are not mislabeled as false repair claims", () => {
  const summary = summarizeCells([{
    strategy: "direct", calls: [], wallMs: 1, evaluated: true,
    repairVerified: true, diagnosisValid: false, passed: false,
    falseCompletion: false, unacceptedCompletion: true,
  }])[0];
  assert.equal(summary.repairsVerified, 1);
  assert.equal(summary.evidenceAccepted, 0);
  assert.equal(summary.falseCompletionClaims, 0);
  assert.equal(summary.unacceptedCompletionClaims, 1);
  assert.equal(summary.passed, 0);
});

test("failed paid calls retain telemetry and consume the same bounded call budget", async () => {
  const calls = [];
  const metrics = { inputTokens: 100, outputTokens: 40, premiumRequestCost: 1, models: ["observed-model"] };
  const agent = async () => { throw Object.assign(new Error("invalid response"), { metrics, status: "invalid-response" }); };
  const budget = { calls, started: performance.now() };
  await assert.rejects(callAgent("synthetic", "/unused", budget, agent), /invalid response/);
  assert.deepEqual(calls[0].metrics, metrics);
  assert.equal(calls[0].failureStatus, "invalid-response");
  const summary = summarizeCells([{ strategy: "direct", calls, wallMs: 1 }])[0];
  assert.equal(summary.usage.inputTokens, 100);
  assert.equal(summary.usage.premiumRequestCost, 1);
  assert.deepEqual(summary.observedModels, ["observed-model"]);
  await assert.rejects(callAgent("synthetic", "/unused", budget, agent), /invalid response/);
  await assert.rejects(callAgent("synthetic", "/unused", budget, agent), /exhausted/);
  assert.equal(calls.length, 2);
});

test("infrastructure failures abort as exit one without grading unexecuted trials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "engineering-infrastructure-"));
  try {
    let verifications = 0;
    let calls = 0;
    const result = await benchmark({
      source, sourceRef: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      image: "sha256:" + "a".repeat(64), dest: join(directory, "run"),
    }, {
      agent: async () => { calls += 1; throw new Error("Must not invoke the model."); },
      visible: () => {
        if (verifications++ === 0) return { valid: true, passed: true };
        throw new Error("Docker unavailable");
      },
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.status, "failed");
    assert.equal(calls, 0);
    assert.equal(result.cells.length, 1);
    assert.equal(result.cells[0].status, "infrastructure-error");
    assert.equal(result.summary[0].evaluated, 0);
    assert.equal(result.summary[0].infrastructureFailures, 1);
    assert.equal(result.summary[1].cells, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("full fixed matrix separates valid repairs from rejected evidence without extra calls", async () => {
  const directory = mkdtempSync(join(tmpdir(), "engineering-matrix-"));
  try {
    const sourceRef = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const baseline = exportFixture(source, sourceRef);
    let calls = 0;
    const result = await benchmark({ source, sourceRef, image: "sha256:" + "a".repeat(64), dest: join(directory, "run") }, {
      agent: async ({ prompt }) => {
        calls += 1;
        assert.match(prompt, /literal "test-output"/);
        assert.match(prompt, /exact contiguous substring/);
        const scenario = CASE_IDS.map(getCase).find((item) => prompt.includes(item.request));
        return { answer: {
          classification: scenario.classification, claimedFixed: true,
          evidence: [{ path: "contract.md", quote: "An invented quotation that must not pass." }],
          files: scenario.allowedPaths.map((path) => ({ path, content: baseline[path] })),
        }, metrics: { inputTokens: 1, outputTokens: 1 } };
      },
      visible: ({ workspace }) => ({
        valid: true, passed: !workspace.endsWith("/before"),
        fail: workspace.endsWith("/before") ? 1 : 0, output: "# fail 1",
      }),
      oracle: () => ({ passed: true, checks: 20 }),
    });
    assert.equal(calls, 9);
    assert.equal(result.cells.length, 6);
    assert.equal(result.exitCode, 2);
    for (const cell of result.cells) {
      assert.equal(cell.repairVerified, true);
      assert.equal(cell.passed, false);
      assert.equal(cell.falseCompletion, false);
      assert.equal(cell.unacceptedCompletion, true);
    }
    for (const summary of result.summary) {
      assert.equal(summary.repairsVerified, 3);
      assert.equal(summary.falseCompletionClaims, 0);
      assert.equal(summary.evidenceAccepted, 0);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
