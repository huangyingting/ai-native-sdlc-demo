import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyProposal, overlay, readTree, treeHash, writeTree } from "../workspace.mjs";

test("exact overlays reject missing and ambiguous fault anchors", () => {
  const files = { "a.mjs": "before" };
  assert.deepEqual(overlay(files, [{ path: "a.mjs", before: "before", after: "after" }]), { "a.mjs": "after" });
  assert.equal(files["a.mjs"], "before");
  assert.throws(() => overlay(files, [{ path: "a.mjs", before: "missing", after: "bad" }]));
  assert.throws(() => overlay({ "a.mjs": "xx" }, [{ path: "a.mjs", before: "x", after: "y" }]));
});

test("candidate changes cannot add paths, escape scope, duplicate files or overwrite tests", () => {
  const files = { "src/app.mjs": "before", "tests/app.test.mjs": "protected" };
  const answer = (path, content = "after") => ({ files: [{ path, content }] });
  assert.equal(applyProposal(files, answer("src/app.mjs"), ["src/app.mjs"])["tests/app.test.mjs"], "protected");
  for (const path of ["../x", "/tmp/x", "tests/app.test.mjs", "new.mjs"]) {
    assert.throws(() => applyProposal(files, answer(path), ["src/app.mjs"]));
  }
  assert.throws(() => applyProposal(files, { files: [] }, ["src/app.mjs"]));
  assert.throws(() => applyProposal(files, answer("src/app.mjs", "x".repeat(40001)), ["src/app.mjs"]));
});

test("candidate trees round trip and hashes cover all content", () => {
  const dir = mkdtempSync(join(tmpdir(), "engineering-tree-"));
  try {
    const path = join(dir, "candidate");
    const files = { "src/a.mjs": "export const a = 1;", "contract.md": "Contract" };
    writeTree(path, files);
    assert.deepEqual(readTree(path), files);
    assert.equal(treeHash(files), treeHash({ "contract.md": "Contract", "src/a.mjs": files["src/a.mjs"] }));
    assert.notEqual(treeHash(files), treeHash({ ...files, "contract.md": "changed" }));
    assert.throws(() => writeTree(path, files));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
