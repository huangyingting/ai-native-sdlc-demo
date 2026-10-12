import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { qualifyReadiness } from "../qualify.mjs";
import { sha256 } from "../common.mjs";
import { artifacts, commit, tar } from "./helpers.mjs";

const project = "demos/it-service-desk";
const route = `${project}/src/app/api/ready/route.ts`;
const routeTests = `${project}/src/app/api/ready/route.test.ts`;
const boundaryTests = `${project}/src/app/api/ready/error-boundary.test.ts`;
const original = `import { getTicketStore } from "@/lib/ticket-store";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getTicketStore().summary();
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Service desk readiness check failed");
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
`;
const routeNames = [
  "reports exact readiness after an application ticket summary read",
  "reports exact unavailability when the store cannot initialize",
  "reports exact unavailability when the summary read fails",
  "logs one fixed generic failure without sensitive details",
  "retries failed initialization after storage is repaired",
  "performs a fresh summary read on every successful request",
  "forces dynamic evaluation rather than prerendering readiness",
  "rejects an invalid database path while preserving liveness",
  "allows first-use schema creation and database seeding",
  "allows nullable ownership migration during first readiness",
  "preserves every persisted ticket field across repeated probes",
].map((name) => `GET /api/ready ${name}`);
const boundaryNames = ["initialization", "summary"].map((stage) =>
  `readiness error boundary handles a frozen ${stage} error without mutating it`);
const kills = {
  "skip-summary-read": [routeNames[0], routeNames[2], routeNames[5]],
  "failure-returns-200": [routeNames[1], routeNames[2]],
  "ready-missing-no-store": [routeNames[0]],
  "failure-missing-no-store": [routeNames[1], routeNames[2]],
  "raw-error-logging": [routeNames[3]],
  "mutate-frozen-error": boundaryNames,
};
const gitBlob = (data) => createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");

function totals(report) {
  const all = report.testResults.flatMap((suite) => suite.assertionResults);
  for (const suite of report.testResults) {
    suite.status = suite.assertionResults.some((assertion) => assertion.status === "failed") ? "failed" : "passed";
  }
  Object.assign(report, {
    success: !all.some((assertion) => assertion.status === "failed"),
    numTotalTests: all.length,
    numPassedTests: all.filter((assertion) => assertion.status === "passed").length,
    numFailedTests: all.filter((assertion) => assertion.status === "failed").length,
    numPendingTests: all.filter((assertion) => ["pending", "skipped"].includes(assertion.status)).length,
    numTodoTests: all.filter((assertion) => assertion.status === "todo").length,
    numTotalTestSuites: report.testResults.length * 2,
    numPassedTestSuites: report.testResults.filter((suite) => suite.status === "passed").length * 2,
    numFailedTestSuites: report.testResults.filter((suite) => suite.status === "failed").length * 2,
    numPendingTestSuites: 0,
  });
  return report;
}

function evidence(destination, id, failures = kills[id] ?? []) {
  const report = totals({
    snapshot: { failure: false },
    testResults: [[routeTests, routeNames], [boundaryTests, boundaryNames]].map(([path, names]) => ({
      name: join(destination, path), message: "", status: "passed",
      assertionResults: names.map((name) => ({
        fullName: ` ${name}`, status: failures.includes(name) ? "failed" : "passed",
        failureMessages: failures.includes(name) ? [
          id === "mutate-frozen-error" && boundaryNames.includes(name)
            ? `TypeError: Cannot assign to read only property 'message' of object 'Error: private storage failure'\n    at GET (${join(destination, route)}:13:5)`
            : "AssertionError: expected readiness contract to hold",
        ] : [],
      })),
    })),
  });
  return {
    report,
    lifecycle: { reason: report.success ? "passed" : "failed", unhandledErrors: [], suiteErrors: [], hookErrors: [] },
    status: report.success ? 0 : 1,
  };
}

function fixture(t, { onRun = () => {}, onInstall = () => {} } = {}) {
  const directory = artifacts(t);
  const source = join(directory, "source");
  const destination = join(directory, "qualification");
  mkdirSync(source);
  const files = new Map([
    [route, original],
    [routeTests, "// approved route tests\n"],
    [boundaryTests, "// approved frozen error tests\n"],
    [`${project}/src/lib/unrelated.spec.ts`, "// approved unrelated tests\n"],
    [`${project}/package.json`, JSON.stringify({
      dependencies: { next: "^16.3.5" }, devDependencies: { vitest: "^5.0.1" },
    })],
    [`${project}/package-lock.json`, '{"lockfileVersion":3}\n'],
    [`${project}/vitest.config.mts`, "export default {};\n"],
  ].map(([path, data]) => [path, { data: Buffer.from(data), mode: 0o644 }]));
  for (const [path, entry] of files) {
    mkdirSync(dirname(join(source, path)), { recursive: true });
    writeFileSync(join(source, path), entry.data);
  }
  const calls = [];
  const fixture = {
    source, destination, directory, files, calls,
    options: { source, sourceRef: commit, dest: destination },
    archive: () => tar(files),
    tree: () => [...files].map(([path, entry]) => `100644 blob ${gitBlob(entry.data)}\t${path}\0`).join(""),
    resolved: commit,
  };
  fixture.run = (command, args, options) => {
    calls.push({ command, args, options });
    if (command === "git") {
      assert.deepEqual(args.slice(0, 2), ["-C", source]);
      assert.equal(options.env.GIT_NO_REPLACE_OBJECTS, "1");
      if (args[2] === "rev-parse") return args.includes("--show-toplevel") ? `${source}\n` : `${fixture.resolved}\n`;
      if (args[2] === "ls-tree") {
        assert.deepEqual(args.slice(3), ["-rz", commit, "--", project]);
        return fixture.tree();
      }
      if (args[2] === "archive") {
        assert.deepEqual(args.slice(3), ["--format=tar", commit, "--", project]);
        return fixture.archive();
      }
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    }
    assert.equal(options.cwd, join(destination, project));
    assert.ok(options.env.TMPDIR.startsWith(`${destination}/`));
    assert.ok(options.timeout > 0 && options.timeout <= 180_000);
    if (command === "npm") {
      assert.deepEqual(args.slice(0, 5), ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--cache"]);
      onInstall(fixture);
      for (const [path, data] of [
        ["vitest/package.json", '{"version":"5.0.1"}'],
        ["vitest/vitest.mjs", "// synthetic runner\n"],
        ["next/package.json", '{"version":"16.3.5"}'],
      ]) {
        const target = join(destination, project, "node_modules", path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, data);
      }
      return "";
    }
    assert.equal(command, process.execPath);
    assert.deepEqual(args.slice(1, 4), ["run", "src/app/api/ready/route.test.ts", "src/app/api/ready/error-boundary.test.ts"]);
    assert.ok(args.includes("--no-allowOnly"));
    assert.ok(args.includes("--no-passWithNoTests"));
    const jsonPath = args.find((arg) => arg.startsWith("--outputFile=")).slice("--outputFile=".length);
    const id = basename(dirname(jsonPath));
    const value = evidence(destination, id);
    onRun({ ...fixture, id, value, options, args });
    if (value.throw) throw value.throw;
    if (!value.omitJson) writeFileSync(jsonPath, value.invalidJson ? "{" : JSON.stringify(value.report));
    if (!value.omitLifecycle) writeFileSync(options.env.VITEST_ERRORS_REPORT, JSON.stringify(value.lifecycle));
    if (value.status) throw Object.assign(new Error("Synthetic assertion failure"), { status: value.status, stdout: "", stderr: "" });
    return "";
  };
  return fixture;
}

const run = (fixture) => qualifyReadiness(fixture.options, {
  run: fixture.run, now: () => new Date("2026-09-28T06:00:00Z"),
});
const firstFailure = (value) => value.report.testResults.flatMap((suite) => suite.assertionResults)
  .find((assertion) => assertion.status === "failed");
function assertFailed(result) {
  assert.equal(result.qualified, false);
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(readFileSync(result.reportPath, "utf8")), result);
}

test("qualifies only two green controls and six contract-killed mutants; persists immutable provenance", (t) => {
  const observed = [];
  const f = fixture(t, { onRun({ destination, id }) {
    const text = readFileSync(join(destination, route), "utf8");
    observed.push([id, text]);
    if (["baseline", "final"].includes(id)) assert.equal(text, original);
    else assert.notEqual(text, original);
  } });
  writeFileSync(join(f.source, route), "// uncommitted source content must be ignored\n");
  const result = run(f);
  assert.equal(result.version, 1);
  assert.equal(result.profile, "readiness-v1");
  assert.equal(result.executionMode, "development-test");
  assert.equal(result.humanAcceptance, false);
  assert.equal(result.source.commit, commit);
  assert.equal(result.qualified, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.restored, true);
  assert.equal(result.testBlobsUnchanged, true);
  assert.equal(result.dependencies.strategy, "npm-ci-scratch");
  assert.equal(result.baseline.total, 13);
  assert.equal(result.final.passed, 13);
  assert.equal(result.original.sha256, sha256(original));
  assert.equal(result.original.gitBlob, gitBlob(Buffer.from(original)));
  assert.equal(Object.keys(result.tests).length, 3);
  assert.deepEqual(observed.map(([id]) => id), ["baseline", ...Object.keys(kills), "final"]);
  assert.deepEqual(result.mutants.map(({ id, status }) => [id, status]), Object.keys(kills).map((id) => [id, "killed"]));
  for (const mutant of result.mutants) {
    assert.equal(sha256(observed.find(([id]) => id === mutant.id)[1]), mutant.sha256);
    assert.ok(mutant.assertionFailures.length + mutant.expectedApplicationErrors.length);
    assert.ok(existsSync(join(f.destination, mutant.evidence.json)));
    assert.ok(existsSync(join(f.destination, mutant.evidence.lifecycle)));
    assert.equal(original.split(mutant.replacement.before).length, 2);
    assert.equal(
      observed.find(([id]) => id === mutant.id)[1],
      original.replace(mutant.replacement.before, mutant.replacement.after),
    );
  }
  assert.equal(result.mutants.at(-1).detectionKind, "expected-application-type-error");
  assert.equal(result.mutants.at(-1).assertionFailures.length, 0);
  assert.deepEqual(result.mutants.at(-1).expectedApplicationErrors, boundaryNames.map((name) => ({
    file: boundaryTests, name, kind: "expected-application-type-error", count: 1,
  })));
  assert.equal(readFileSync(join(f.destination, route), "utf8"), original);
  assert.equal(readFileSync(join(f.source, route), "utf8"), "// uncommitted source content must be ignored\n");
  for (const [path, entry] of f.files) if (path !== route) {
    assert.deepEqual(readFileSync(join(f.destination, path)), entry.data);
    assert.deepEqual(readFileSync(join(f.source, path)), entry.data);
  }
  assert.deepEqual(JSON.parse(readFileSync(result.reportPath, "utf8")), result);
  assert.equal(f.calls.filter(({ command }) => command === "npm").length, 1);
  assert.equal(f.calls.filter(({ command }) => command === process.execPath).length, 8);
});

test("a survived mutant is not qualification, even with green baseline/final; other mutants still run", (t) => {
  const f = fixture(t, { onRun({ id, value, destination }) {
    if (id === "skip-summary-read") Object.assign(value, evidence(destination, id, []));
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.mutants[0].status, "survived");
  assert.equal(result.mutants[1].status, "killed");
  assert.equal(result.final.status, "passed");
  assert.equal(result.restored, true);
});

test("public summaries retain failure identities and counts, never raw messages or stacks", (t) => {
  const privateText = "PRIVATE-FAILURE-BODY /private/example.db";
  const f = fixture(t, { onRun({ id, value }) {
    if (id === "skip-summary-read") {
      firstFailure(value).failureMessages = [`AssertionError: ${privateText}\n    at private-handler.ts:9:1`];
    }
  } });
  const result = run(f);
  assert.equal(result.qualified, true);
  assert.equal(result.humanAcceptance, false);
  const summary = JSON.stringify(result);
  assert.ok(!summary.includes(privateText));
  assert.ok(!summary.includes("private-handler.ts"));
  assert.ok(!summary.includes("failureMessages"));
  assert.ok(!summary.includes('"stack":'));
  const mutant = result.mutants[0];
  assert.equal(mutant.detectionKind, "assertion");
  assert.deepEqual(mutant.assertionFailures[0], {
    file: routeTests, name: routeNames[0], kind: "assertion", count: 1,
  });
  assert.match(readFileSync(join(f.destination, mutant.evidence.json), "utf8"), /PRIVATE-FAILURE-BODY/);
  assert.deepEqual(JSON.parse(readFileSync(result.reportPath, "utf8")), result);
});

for (const failureMode of ["dependency", "process", "untrusted-test-name"]) {
  test(`raw ${failureMode} diagnostics stay in private evidence, not public summaries`, (t) => {
    const privateText = "PRIVATE-INFRASTRUCTURE-BODY";
    const f = fixture(t, {
      onInstall() {
        if (failureMode === "dependency") {
          throw Object.assign(new Error(privateText), { stdout: privateText, stderr: privateText });
        }
      },
      onRun({ id, value }) {
        if (id !== "skip-summary-read") return;
        if (failureMode === "process") {
          value.throw = Object.assign(new Error(privateText), {
            code: "ETIMEDOUT", stdout: privateText, stderr: privateText,
          });
        } else if (failureMode === "untrusted-test-name") {
          firstFailure(value).fullName = privateText;
        }
      },
    });
    const result = run(f);
    assertFailed(result);
    assert.ok(!JSON.stringify(result).includes(privateText));
    assert.ok(!readFileSync(result.reportPath, "utf8").includes(privateText));
    assert.ok(result.errors.some(({ evidence }) =>
      readFileSync(join(f.destination, evidence), "utf8").includes(privateText)));
  });
}

for (const control of ["baseline", "final"]) {
  test(`${control} assertion failures cannot qualify`, (t) => {
    const f = fixture(t, { onRun({ id, value, destination }) {
      if (id === control) Object.assign(value, evidence(destination, id, [routeNames[0]]));
    } });
    const result = run(f);
    assertFailed(result);
    assert.equal(result[control].status, "failed");
    assert.equal(result[control].assertionFailures[0].name, routeNames[0]);
    assert.equal(result.restored, true);
    if (control === "baseline") assert.ok(result.mutants.every(({ status }) => status === "not-run"));
  });
}

const harnessFailures = [
  ["hook failure", ({ value }) => { value.lifecycle.hookErrors.push({ name: "afterEach" }); }],
  ["suite/import failure", ({ value }) => { value.lifecycle.suiteErrors.push("Failed to load route"); }],
  ["unhandled error", ({ value }) => { value.lifecycle.unhandledErrors.push("Unhandled rejection"); }],
  ["interrupted run", ({ value }) => { value.lifecycle.reason = "interrupted"; }],
  ["suite message", ({ value }) => { value.report.testResults[0].message = "SyntaxError: Unexpected token"; }],
  ["test syntax error", ({ value }) => { firstFailure(value).failureMessages = ["SyntaxError: Unexpected token"]; }],
  ["test import error", ({ value }) => { firstFailure(value).failureMessages = ["Error: Failed to resolve import"]; }],
  ["unrelated test body exception", ({ value }) => { firstFailure(value).failureMessages = ["TypeError: Cannot read property"]; }],
  ["missing failure messages", ({ value }) => { firstFailure(value).failureMessages = []; }],
  ["skipped test", ({ value }) => { value.report.testResults[0].assertionResults[4].status = "skipped"; }],
  ["pending test", ({ value }) => { value.report.testResults[0].assertionResults[4].status = "pending"; }],
  ["todo test", ({ value }) => { value.report.testResults[0].assertionResults[4].status = "todo"; }],
  ["missing required test", ({ value }) => { value.report.testResults[0].assertionResults.pop(); totals(value.report); }],
  ["duplicate test", ({ value }) => { value.report.testResults[0].assertionResults[4].fullName = ` ${routeNames[0]}`; }],
  ["no assertions", ({ value }) => { value.report.testResults[0].assertionResults = []; totals(value.report); }],
  ["missing boundary suite", ({ value }) => { value.report.testResults.pop(); totals(value.report); }],
  ["wrong suite path", ({ value }) => { value.report.testResults[1].name = "/another/error-boundary.test.ts"; }],
  ["duplicate suite", ({ value }) => { value.report.testResults[1] = value.report.testResults[0]; }],
  ["inconsistent totals", ({ value }) => { value.report.numFailedTests = 0; }],
  ["inconsistent suite totals", ({ value }) => { value.report.numTotalTestSuites = 9; }],
  ["exit zero on failed tests", ({ value }) => { value.status = 0; }],
  ["exit two on assertion failure", ({ value }) => { value.status = 2; }],
  ["lifecycle/result disagreement", ({ value }) => { value.lifecycle.reason = "passed"; }],
  ["missing JSON", ({ value }) => { value.omitJson = true; }],
  ["invalid JSON", ({ value }) => { value.invalidJson = true; }],
  ["missing lifecycle evidence", ({ value }) => { value.omitLifecycle = true; }],
  ["snapshot failure", ({ value }) => { value.report.snapshot.failure = true; }],
  ["runtime error count", ({ value }) => { value.report.numRuntimeErrorTestSuites = 1; }],
  ["timeout", ({ value }) => { value.throw = Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT", signal: "SIGTERM" }); }],
  ["spawn error", ({ value }) => { value.throw = Object.assign(new Error("ENOENT"), { code: "ENOENT" }); }],
  ["unexpected failing assertion", ({ value, destination, id }) => {
    Object.assign(value, evidence(destination, id, [routeNames[3]]));
  }],
];
for (const [label, fail] of harnessFailures) {
  test(`fails closed on ${label}; restores original and runs final control`, (t) => {
    const f = fixture(t, { onRun(context) { if (context.id === "skip-summary-read") fail(context); } });
    const result = run(f);
    assertFailed(result);
    assert.equal(result.mutants[0].status, "error");
    assert.ok(result.mutants[0].error);
    assert.equal(result.mutants[1].status, "not-run");
    assert.equal(result.final.status, "passed");
    assert.equal(result.restored, true);
    assert.equal(readFileSync(join(f.destination, route), "utf8"), original);
  });
}

for (const target of [routeTests, boundaryTests, `${project}/src/lib/unrelated.spec.ts`, `${project}/vitest.config.mts`]) {
  test(`detects mutation of committed ${target}, without restoring or accepting changed test inputs`, (t) => {
    const f = fixture(t, { onRun({ destination, id }) {
      if (id === "skip-summary-read") writeFileSync(join(destination, target), "// tampered\n");
    } });
    const result = run(f);
    assertFailed(result);
    assert.equal(result.testBlobsUnchanged, false);
    assert.equal(result.restored, true);
    assert.equal(result.final.status, "not-run");
    assert.equal(result.mutants[0].error.kind, "export-integrity");
    assert.equal(readFileSync(join(f.destination, route), "utf8"), original);
    assert.equal(readFileSync(join(f.destination, target), "utf8"), "// tampered\n");
    assert.deepEqual(readFileSync(join(f.source, target)), f.files.get(target).data);
  });
}

test("restores a deleted route, but refuses to treat it as a killed mutant", (t) => {
  const f = fixture(t, { onRun({ destination, id }) {
    if (id === "skip-summary-read") rmSync(join(destination, route));
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.restored, true);
  assert.equal(result.final.status, "passed");
  assert.equal(readFileSync(join(f.destination, route), "utf8"), original);
});

test("restores a symlink-swapped route without writing through to source", (t) => {
  const f = fixture(t, { onRun({ source, destination, id }) {
    if (id === "skip-summary-read") {
      rmSync(join(destination, route));
      symlinkSync(join(source, route), join(destination, route));
    }
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.restored, true);
  assert.equal(result.final.status, "passed");
  assert.equal(readFileSync(join(f.source, route), "utf8"), original);
});

test("refuses restoration through a replaced parent directory and reports the failure", (t) => {
  const f = fixture(t, { onRun({ source, destination, id }) {
    if (id === "skip-summary-read") {
      rmSync(dirname(join(destination, route)), { recursive: true });
      symlinkSync(dirname(join(source, route)), dirname(join(destination, route)));
    }
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.restored, false);
  assert.equal(result.final.status, "not-run");
  assert.ok(result.errors.some(({ phase }) => phase === "restore-after-final"));
  for (const path of [route, routeTests, boundaryTests]) {
    assert.deepEqual(readFileSync(join(f.source, path)), f.files.get(path).data);
  }
});

for (const failure of [
  "TypeError: Cannot assign to read only property 'message'\n    at setup.ts:1:1",
  "SyntaxError: Cannot assign to read only property 'message'",
]) {
  test(`frozen-error mutant accepts only its precise route-level TypeError: ${failure.split("\n")[0]}`, (t) => {
    const f = fixture(t, { onRun({ id, value }) {
      if (id === "mutate-frozen-error") firstFailure(value).failureMessages = [failure];
    } });
    const result = run(f);
    assertFailed(result);
    assert.equal(result.mutants.at(-1).status, "error");
    assert.equal(result.final.status, "passed");
  });
}

for (const failureMode of ["assertion-only", "hook", "unhandled", "suite"]) {
  test(`frozen-error detection cannot be substituted with ${failureMode} failures`, (t) => {
    const f = fixture(t, { onRun({ id, value }) {
      if (id !== "mutate-frozen-error") return;
      if (failureMode === "assertion-only") {
        firstFailure(value).failureMessages = ["AssertionError: not the expected application TypeError"];
      } else {
        const field = { hook: "hookErrors", unhandled: "unhandledErrors", suite: "suiteErrors" }[failureMode];
        value.lifecycle[field].push("TypeError: Cannot assign to read only property 'message'");
      }
    } });
    const result = run(f);
    assertFailed(result);
    assert.equal(result.mutants.at(-1).status, "error");
    assert.equal(result.mutants.at(-1).expectedApplicationErrors.length, 0);
    assert.equal(result.final.status, "passed");
  });
}

test("final test mutation invalidates an otherwise successful qualification", (t) => {
  const f = fixture(t, { onRun({ destination, id }) {
    if (id === "final") writeFileSync(join(destination, boundaryTests), "// changed\n");
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.testBlobsUnchanged, false);
  assert.equal(result.final.status, "error");
});

test("even the final runner cannot leave the controlled route modified", (t) => {
  const f = fixture(t, { onRun({ destination, id }) {
    if (id === "final") writeFileSync(join(destination, route), "// changed\n");
  } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.final.status, "error");
  assert.equal(result.restored, true);
  assert.equal(readFileSync(join(f.destination, route), "utf8"), original);
});

test("dependency restoration failure is explicit and never runs tests", (t) => {
  const f = fixture(t, { onInstall() { throw new Error("npm ci lockfile mismatch"); } });
  const result = run(f);
  assertFailed(result);
  assert.equal(result.dependencies.status, "error");
  assert.equal(result.baseline.status, "not-run");
  assert.equal(result.final.status, "not-run");
  assert.equal(result.restored, true);
  assert.match(readFileSync(join(f.destination, result.errors[0].evidence), "utf8"), /lockfile mismatch/);
  assert.equal(f.calls.filter(({ command }) => command === process.execPath).length, 0);
});

for (const change of ["missing-runner", "incompatible-vitest"]) {
  test(`requires usable installed dependencies after npm ci: ${change}`, (t) => {
    const f = fixture(t);
    const runner = f.run;
    f.run = (command, args, options) => {
      const result = runner(command, args, options);
      if (command === "npm") {
        if (change === "missing-runner") rmSync(join(f.destination, project, "node_modules/vitest/vitest.mjs"));
        else writeFileSync(join(f.destination, project, "node_modules/vitest/package.json"), '{"version":"2.0.0"}');
      }
      return result;
    };
    const result = run(f);
    assertFailed(result);
    assert.equal(result.dependencies.status, "error");
    assert.equal(result.baseline.status, "not-run");
    assert.equal(result.final.status, "not-run");
  });
}

test("rejects missing explicit source, immutable SHA, and unsafe destinations before commands or export", (t) => {
  const f = fixture(t);
  for (const sourceRef of [undefined, "main", "HEAD", "a".repeat(39), "A".repeat(40), `${commit}^{commit}`]) {
    assert.throws(() => qualifyReadiness({ ...f.options, sourceRef }, { run: f.run }), /full lowercase immutable/);
  }
  assert.throws(() => qualifyReadiness({ ...f.options, source: undefined }, { run: f.run }), /explicit --source/);
  for (const dest of [undefined, f.source, join(f.source, "child")]) {
    assert.throws(() => qualifyReadiness({ ...f.options, dest }, { run: f.run }), /--dest|already exists|outside/);
  }
  const alias = join(f.directory, "alias");
  symlinkSync(f.source, alias);
  assert.throws(() => qualifyReadiness({ ...f.options, dest: join(alias, "child") }, { run: f.run }), /outside/);
  assert.equal(f.calls.length, 0);
  assert.equal(existsSync(f.destination), false);
});

test("rejects a commit that resolves differently without creating destination", (t) => {
  const f = fixture(t);
  f.resolved = "b".repeat(40);
  assert.throws(() => run(f), /did not resolve exactly/);
  assert.equal(existsSync(f.destination), false);
});

for (const target of [route, routeTests, boundaryTests, `${project}/package.json`, `${project}/package-lock.json`]) {
  test(`refuses absent committed prerequisite ${target}, without silently using working tree files`, (t) => {
    const f = fixture(t);
    f.files.delete(target);
    assert.throws(() => run(f), /Required committed readiness qualification file missing/);
    assert.equal(existsSync(f.destination), false);
  });
}

for (const label of ["missing", "ambiguous"]) {
  test(`refuses ${label} exact mutation anchors`, (t) => {
    const f = fixture(t);
    f.files.get(route).data = Buffer.from(label === "missing"
      ? original.replace("getTicketStore().summary();", "getTicketStore().summary( );")
      : `${original}\n//     getTicketStore().summary();\n`);
    assert.throws(() => run(f), /exact, unambiguous anchor/);
    assert.equal(existsSync(f.destination), false);
  });
}

test("rejects export-ignore, export-subst, unknown paths, and non-regular Git entries", (t) => {
  const f = fixture(t);
  const originalArchive = f.archive;
  const originalTree = f.tree;
  f.archive = () => tar(new Map([...f.files].filter(([path]) => path !== routeTests)));
  assert.throws(() => run(f), /omitted tracked/);
  f.archive = () => tar(new Map([...f.files].map(([path, entry]) => [
    path, path === route ? { ...entry, data: Buffer.from("changed") } : entry,
  ])));
  assert.throws(() => run(f), /differs from committed blob/);
  f.archive = originalArchive;
  f.tree = () => originalTree().replace("100644 blob", "120000 blob");
  assert.throws(() => run(f), /symlink, submodule/);
  f.tree = () => originalTree().replace(route, "../outside");
  assert.throws(() => run(f), /Unsafe/);
  f.tree = () => originalTree().replace(route, ".github/workflows/unsafe.yml");
  assert.throws(() => run(f), /Unexpected app tree path/);
  assert.equal(existsSync(f.destination), false);
});
