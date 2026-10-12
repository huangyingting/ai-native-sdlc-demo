import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runOracle, runVisible } from "../validation.mjs";
import { writeTree } from "../workspace.mjs";

const tap = "# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
const success = { stdout: tap, stderr: "", exitCode: 0, timedOut: false, cleaned: true, wallMs: 1 };

test("visible verification requires complete real counts, normal exit and cleanup", () => {
  const root = mkdtempSync(join(tmpdir(), "engineering-validation-"));
  try {
    const workspace = join(root, "candidate");
    writeTree(workspace, { "src/a.mjs": "fixture" });
    const options = { workspace, expectedTests: 1, visibleTests: ["tests/a.test.mjs"] };
    assert.equal(runVisible(options, { sandbox: () => success }).passed, true);
    for (const override of [
      { cleaned: false }, { timedOut: true }, { exitCode: 1 },
      { stdout: tap.replace("# pass 1", "# pass 0") },
      { stdout: tap.replace("# skipped 0", "# skipped 1") },
      { stdout: tap + "# tests 1\n" },
      { stdout: "Fake success" },
    ]) assert.equal(runVisible(options, { sandbox: () => ({ ...success, ...override }) }).passed, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("independent oracle needs the exact success envelope and check count", () => {
  const root = mkdtempSync(join(tmpdir(), "engineering-oracle-result-"));
  try {
    const workspace = join(root, "candidate");
    writeTree(workspace, { "src/a.mjs": "fixture" });
    const options = { workspace, caseId: "case-1", oracleChecks: 20 };
    const stdout = JSON.stringify({ kind: "engineering-oracle", passed: true, checks: 20 });
    assert.equal(runOracle(options, { sandbox: () => ({ ...success, stdout }) }).passed, true);
    for (const output of ["not json", "{}", stdout.replace('"checks":20', '"checks":19')]) {
      assert.equal(runOracle(options, { sandbox: () => ({ ...success, stdout: output }) }).passed, false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
