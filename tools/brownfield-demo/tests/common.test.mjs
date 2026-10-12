import test from "node:test";
import assert from "node:assert/strict";
import { substituteReviewer, validateHumanConfig } from "../common.mjs";
import { config } from "./helpers.mjs";

test("Spec readiness profile is optional, explicit, and preserved by reviewer substitution", () => {
  assert.equal(validateHumanConfig(config), config);
  for (const specReadiness of ["structural", "decisions-v1"]) {
    const original = { ...structuredClone(config), specReadiness };
    assert.equal(validateHumanConfig(original), original);
    assert.equal(substituteReviewer(original, "another-reviewer").specReadiness, specReadiness);
  }
  for (const specReadiness of [null, "", "decisions-v2", "Structural", 1, {}]) {
    assert.throws(() => validateHumanConfig({ ...config, specReadiness }), /Unsupported Spec readiness profile/);
    assert.throws(() => substituteReviewer({ ...config, specReadiness }, "reviewer"), /Unsupported Spec readiness profile/);
  }
});
