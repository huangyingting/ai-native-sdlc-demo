import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bindQualification, validateQualification } from "../reliability.mjs";
import { parseOptions } from "../cli.mjs";

function qualification() {
  const control = { status: "passed", total: 13, passed: 13, failed: 0, exitCode: 0 };
  return {
    kind: "readiness-test-qualification", profile: "readiness-v1",
    qualified: true, exitCode: 0, baseline: { ...control }, final: { ...control },
    restored: true, testBlobsUnchanged: true,
    source: { repository: "/example/repo", commit: "a".repeat(40) },
    mutants: ["skip-summary-read", "failure-returns-200", "ready-missing-no-store",
      "failure-missing-no-store", "raw-error-logging", "mutate-frozen-error"].map((id) => ({ id, status: "killed" })),
  };
}

test("rehearsal requires all controls, six unique known mutants and immutable source", () => {
  validateQualification(qualification());
  for (const mutate of [
    (r) => { r.qualified = false; }, (r) => { r.final.total = 0; },
    (r) => { r.baseline.failed = 1; }, (r) => { r.testBlobsUnchanged = false; },
    (r) => { r.mutants[0].status = "survived"; }, (r) => { r.mutants[0].id = r.mutants[1].id; },
    (r) => { r.restored = false; }, (r) => { r.source.commit = "main"; },
  ]) {
    const value = qualification();
    mutate(value);
    assert.throws(() => validateQualification(value));
  }
});

test("binding compares application trees rather than unrelated documentation commits", () => {
  const value = qualification();
  const imageRevision = "b".repeat(40);
  const tree = "c".repeat(40);
  const binding = bindQualification(value, Buffer.from(JSON.stringify(value)), imageRevision, {
    run(command, args, options) {
      assert.equal(command, "git");
      assert.equal(options.env.GIT_NO_REPLACE_OBJECTS, "1");
      assert.ok(args.at(-1).endsWith(":demos/it-service-desk"));
      return tree;
    },
  });
  assert.equal(binding.applicationTree, tree);
  assert.equal(binding.imageRevision, imageRevision);
  assert.throws(() => bindQualification(value, Buffer.from("{}"), "main"), /full source revision/);
  assert.throws(() => bindQualification(value, Buffer.from("{}"), imageRevision, {
    run: (_command, args) => args.at(-1).startsWith(imageRevision) ? "d".repeat(40) : tree,
  }), /differs/);
});

test("CLI requires explicit qualification, identities and output paths", () => {
  assert.throws(() => parseOptions(["rehearse", "--image", "image", "--repo", "o/r", "--owner", "user", "--dest", "/tmp/new"]), /qualification/);
  const parsed = parseOptions(["qualify", "--source", "/repo", "--source-ref", "a".repeat(40), "--dest", "/new"]);
  assert.equal(parsed.sourceRef, "a".repeat(40));
  assert.throws(() => parseOptions(["verify-image", "--image", "image", "--dest", "/new"]), /profile/);
});
