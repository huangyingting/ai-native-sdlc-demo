import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions } from "../cli.mjs";

test("CLI requires explicit commands and every declared option", () => {
  assert.equal(parseOptions([]).command, "help");
  assert.equal(parseOptions(["--help"]).command, "help");
  assert.throws(() => parseOptions(["unknown"]));
  assert.throws(() => parseOptions(["benchmark", "--source", "/tmp"]));
  assert.throws(() => parseOptions(["impact-implement", "--run", "/tmp/run", "--force"]));
  const options = parseOptions(["impact-propose", "--source", "/tmp/repo", "--source-ref", "a".repeat(40), "--image", "sha256:123", "--dest", "/tmp/new"]);
  assert.equal(options.sourceRef, "a".repeat(40));
});
