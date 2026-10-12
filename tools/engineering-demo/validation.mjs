import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSandbox } from "./sandbox.mjs";
import { readTree, treeHash, writeJson } from "./workspace.mjs";

export const oracleRoot = fileURLToPath(new URL("./", import.meta.url));

export function parseTap(stdout) {
  const number = (name) => {
    const matches = [...stdout.matchAll(new RegExp(`^# ${name} (\\d+)\\s*$`, "gm"))];
    return matches.length === 1 ? Number(matches[0][1]) : null;
  };
  return Object.fromEntries(["tests", "pass", "fail", "cancelled", "skipped", "todo"].map((name) => [name, number(name)]));
}

export function runVisible({ image, workspace, visibleTests, expectedTests, dest, timeoutMs = 30000 }, { sandbox = runSandbox } = {}) {
  const before = treeHash(readTree(workspace));
  const execution = sandbox({
    image, workspace, oracleRoot,
    args: ["--test", "--test-reporter=tap", ...visibleTests.map((path) => `/work/${path}`)], timeoutMs,
  });
  if (treeHash(readTree(workspace)) !== before) throw new Error("Readonly verification unexpectedly changed candidate files.");
  const counts = parseTap(execution.stdout);
  const valid = [0, 1].includes(execution.exitCode) && !execution.timedOut && execution.cleaned &&
    counts.tests === expectedTests && counts.cancelled === 0 && counts.skipped === 0 && counts.todo === 0 &&
    counts.pass + counts.fail === counts.tests;
  const result = {
    valid, passed: valid && execution.exitCode === 0 && counts.fail === 0,
    ...counts, exitCode: execution.exitCode, timedOut: execution.timedOut,
    cleaned: execution.cleaned, wallMs: execution.wallMs,
    ...(execution.imageId ? { imageId: execution.imageId } : {}),
  };
  if (dest) writeJson(join(dest, "visible-execution.json"), { result, execution }, { exclusive: true });
  return { ...result, output: execution.stdout.slice(0, 30_000) };
}

export function runOracle({ image, workspace, caseId, oracleChecks, dest, timeoutMs = 30000 }, { sandbox = runSandbox } = {}) {
  const before = treeHash(readTree(workspace));
  const execution = sandbox({
    image, workspace, oracleRoot,
    args: ["/oracle/oracle.mjs", caseId, "/work"], timeoutMs,
  });
  let value;
  try { value = JSON.parse(execution.stdout); } catch { value = null; }
  const result = {
    passed: execution.exitCode === 0 && execution.cleaned && !execution.timedOut &&
      value?.kind === "engineering-oracle" && value.passed === true && value.checks === oracleChecks &&
      treeHash(readTree(workspace)) === before,
    checks: value?.checks ?? null, expectedChecks: oracleChecks, exitCode: execution.exitCode,
    timedOut: execution.timedOut, cleaned: execution.cleaned, wallMs: execution.wallMs,
  };
  if (dest) writeJson(join(dest, "oracle-execution.json"), { result, execution }, { exclusive: true });
  return result;
}
