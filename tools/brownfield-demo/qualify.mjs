import { createHash } from "node:crypto";
import {
  lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execute, fullSha, newDestination, safePath, sha256 } from "./common.mjs";
import { archiveFiles } from "./prepare.mjs";
import {
  isTestFile, validateVitestGreen, validateVitestRed, validateVitestRunErrors,
} from "../../.github/brownfield-human-gated-delivery/scripts/core.mjs";

const project = "demos/it-service-desk";
const route = `${project}/src/app/api/ready/route.ts`;
const routeTests = `${project}/src/app/api/ready/route.test.ts`;
const boundaryTests = `${project}/src/app/api/ready/error-boundary.test.ts`;
const reporter = fileURLToPath(new URL(
  "../../.github/brownfield-human-gated-delivery/scripts/vitest-errors-reporter.mjs", import.meta.url,
));
const requiredTests = new Map([
  [routeTests, [
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
  ].map((name) => `GET /api/ready ${name}`)],
  [boundaryTests, ["initialization", "summary"].map((stage) =>
    `readiness error boundary handles a frozen ${stage} error without mutating it`)],
]);
const names = [...requiredTests.values()].flat();
const catchAnchor = '  } catch {\n    console.error("Service desk readiness check failed");';
const mutants = [
  {
    id: "skip-summary-read",
    before: "    getTicketStore().summary();",
    after: "    getTicketStore();",
    kills: [names[0], names[2], names[5]],
  },
  {
    id: "failure-returns-200",
    before: '      { status: 503, headers: { "Cache-Control": "no-store" } },',
    after: '      { status: 200, headers: { "Cache-Control": "no-store" } },',
    kills: [names[1], names[2]],
  },
  {
    id: "ready-missing-no-store",
    before: '      { status: "ready" },\n      { headers: { "Cache-Control": "no-store" } },',
    after: '      { status: "ready" },\n      { headers: {} },',
    kills: [names[0]],
  },
  {
    id: "failure-missing-no-store",
    before: '      { status: 503, headers: { "Cache-Control": "no-store" } },',
    after: "      { status: 503, headers: {} },",
    kills: [names[1], names[2]],
  },
  {
    id: "raw-error-logging",
    before: catchAnchor,
    after: "  } catch (error) {\n    console.error(error);",
    kills: [names[3]],
  },
  {
    id: "mutate-frozen-error",
    before: catchAnchor,
    after: '  } catch (error) {\n    (error as Error).message = "Service desk readiness check failed";\n' +
      '    console.error("Service desk readiness check failed");',
    kills: requiredTests.get(boundaryTests),
  },
];

function replaceOnce(original, mutant) {
  const index = original.indexOf(mutant.before);
  if (index < 0 || original.indexOf(mutant.before, index + mutant.before.length) >= 0) {
    throw new Error(`Unsupported readiness route: ${mutant.id} requires one exact, unambiguous anchor.`);
  }
  return original.slice(0, index) + mutant.after + original.slice(index + mutant.before.length);
}

function regularPath(root, path, { allowMissing = false, allowLeafLink = false } = {}) {
  const parts = safePath(path).split("/");
  let current = root;
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("Scratch root changed.");
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    let stat;
    try { stat = lstatSync(current); } catch (error) {
      if (allowMissing && index === parts.length - 1 && error.code === "ENOENT") return current;
      throw error;
    }
    if (allowLeafLink && index === parts.length - 1 && stat.isSymbolicLink()) return current;
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Scratch path is not a regular ${index < parts.length - 1 ? "directory" : "file"}: ${path}`);
    }
  }
  return current;
}

function checkTree(destination, files, expectedRoute) {
  for (const [path, entry] of files) {
    const data = readFileSync(regularPath(destination, path));
    if (!data.equals(path === route ? expectedRoute : entry.data)) {
      throw new Error(`Exported ${isTestFile(path) ? "test blob" : "file"} changed: ${path}`);
    }
  }
}

function exportFiles(source, commit, run) {
  const git = (args, options = {}) => run("git", ["-C", source, ...args], {
    ...options, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
  });
  if (realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) !== source) {
    throw new Error("--source must be the repository root.");
  }
  if (git(["rev-parse", "--verify", `${commit}^{commit}`]).trim() !== commit) {
    throw new Error("Source commit did not resolve exactly.");
  }
  const tracked = new Map();
  for (const entry of git(["ls-tree", "-rz", commit, "--", project]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error("App tree contains a symlink, submodule, or unsupported entry.");
    const path = safePath(match[3]);
    if (!path.startsWith(`${project}/`) || path.split("/").includes("node_modules")) {
      throw new Error(`Unexpected app tree path: ${path}`);
    }
    if (tracked.has(path)) throw new Error(`Duplicate tracked path: ${path}`);
    tracked.set(path, { mode: match[1], blob: match[2] });
  }
  const files = archiveFiles(git(["archive", "--format=tar", commit, "--", project], {
    encoding: null, maxBuffer: 128 * 1024 * 1024,
  }));
  if (files.size !== tracked.size) throw new Error("Git archive omitted tracked app files (export-ignore is not supported).");
  for (const [path, entry] of files) {
    const blob = createHash("sha1").update(`blob ${entry.data.length}\0`).update(entry.data).digest("hex");
    if (tracked.get(path)?.blob !== blob ||
        (tracked.get(path).mode === "100755") !== (entry.mode === 0o755)) {
      throw new Error(`Git archive differs from committed blob: ${path}`);
    }
  }
  return { files, tracked };
}

function classify(report, lifecycle, exitCode, destination, mutant) {
  validateVitestRunErrors(lifecycle);
  if (!Array.isArray(report.testResults) || report.testResults.length !== requiredTests.size) {
    throw new Error("Required readiness suites were not executed exactly once.");
  }
  const assertions = [];
  const seen = new Set();
  for (const suite of report.testResults) {
    const path = typeof suite.name === "string" ? relative(destination, resolve(suite.name)) : "";
    if (!requiredTests.has(path) || seen.has(path)) throw new Error(`Unexpected or duplicate test suite: ${path}`);
    seen.add(path);
    if (!Array.isArray(suite.assertionResults)) throw new Error("Missing test assertions.");
    const expected = requiredTests.get(path);
    const found = new Set();
    for (const assertion of suite.assertionResults) {
      // Vitest JSON can prefix fullName with whitespace from the root suite.
      const name = typeof assertion.fullName === "string" ? assertion.fullName.trim() : "";
      if (!expected.includes(name) || found.has(name)) throw new Error(`Unexpected or duplicate assertion: ${name}`);
      found.add(name);
      if (!["passed", "failed"].includes(assertion.status)) throw new Error(`Required test did not execute: ${name}`);
      if (!Array.isArray(assertion.failureMessages) ||
          assertion.failureMessages.some((message) => typeof message !== "string") ||
          (assertion.status === "passed" && assertion.failureMessages.length)) {
        throw new Error(`Malformed assertion failures: ${name}`);
      }
      assertion.fullName = name;
      assertions.push({ ...assertion, file: path });
    }
    if (found.size !== expected.length) throw new Error(`Required tests missing from ${path}.`);
  }
  const failed = assertions.filter((test) => test.status === "failed");
  if (report.success !== !failed.length || exitCode !== (failed.length ? 1 : 0) ||
      lifecycle.reason !== (failed.length ? "failed" : "passed") || report.snapshot?.failure) {
    throw new Error("Vitest exit, lifecycle, snapshot, and assertion results disagree.");
  }
  if (failed.length) validateVitestRed(report, new Set(failed.map((test) => test.fullName)));
  else validateVitestGreen(report, new Set(names));
  const testFailures = failed.map((test) => {
    if (!test.failureMessages.length) throw new Error(`Missing failure evidence: ${test.fullName}`);
    const expectedApplicationError = mutant?.id === "mutate-frozen-error" && mutant.kills.includes(test.fullName);
    for (const message of test.failureMessages) {
      if (!expectedApplicationError && /^AssertionError(?:\s|\[|:)/.test(message)) continue;
      // These two approved test bodies call GET directly. The deliberate assignment
      // must produce this bounded application TypeError, NOT an assertion kill.
      // Lifecycle validation above still rejects hook, import, and run failures.
      if (expectedApplicationError &&
          /^TypeError: Cannot assign to read only property 'message'/.test(message) &&
          message.includes(join(destination, route))) {
        continue;
      }
      throw new Error(`Non-assertion test/infrastructure failure: ${test.fullName}`);
    }
    return {
      file: test.file, name: test.fullName,
      kind: expectedApplicationError ? "expected-application-type-error" : "assertion",
      count: test.failureMessages.length,
    };
  });
  if (mutant && failed.length && mutant.kills.some((name) => !failed.some((test) => test.fullName === name))) {
    throw new Error(`Mutant ${mutant.id} did not fail its required contract assertions.`);
  }
  return {
    status: mutant ? (failed.length ? "killed" : "survived") : (failed.length ? "failed" : "passed"),
    ...(mutant ? { detectionKind: !failed.length ? "none" :
      mutant.id === "mutate-frozen-error" ? "expected-application-type-error" : "assertion" } : {}),
    total: assertions.length, passed: assertions.length - failed.length, failed: failed.length,
    assertionFailures: testFailures.filter((test) => test.kind === "assertion"),
    expectedApplicationErrors: testFailures.filter((test) => test.kind === "expected-application-type-error"),
  };
}

/**
 * Qualify only the committed readiness-v1 profile (11 route + 2 frozen-error tests).
 * Usage: qualifyReadiness({ source: "/repo", sourceRef: "<40-hex commit>", dest: "/new-scratch" }).
 * Invalid/unsafe input throws before export. After export, failures return exitCode: 1
 * and persist qualification-report.json; callers MUST propagate exitCode.
 *
 * run uses execute's synchronous contract, including thrown errors with status/stdout/stderr.
 * Dependencies are restored ONLY with npm ci in scratch, never linked to source. npm's
 * cache and test TMPDIR are inside scratch; no source tests or dependency files are written.
 * This is development-test evidence, not Human acceptance. Public summaries contain
 * failure names/kinds/counts only; raw Vitest output and diagnostics stay in private
 * scratch evidence. Frozen-error detection is an expected application TypeError in
 * two known test bodies, not an assertion kill or a permitted infrastructure error.
 */
export function qualifyReadiness(options, { run = execute, now = () => new Date() } = {}) {
  if (!options || typeof options.source !== "string" || !options.source) throw new Error("Specify an explicit --source.");
  if (!fullSha(options.sourceRef)) throw new Error("--source-ref must be a full lowercase immutable 40-hex Git commit.");
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Readiness qualification requires Node.js 24 or newer.");
  const source = realpathSync(options.source);
  const destination = newDestination(options.dest, source);
  const { files, tracked } = exportFiles(source, options.sourceRef, run);
  for (const path of [route, routeTests, boundaryTests, `${project}/package.json`, `${project}/package-lock.json`]) {
    if (!files.has(path)) throw new Error(`Required committed readiness qualification file missing: ${path}`);
  }
  const original = files.get(route).data;
  const variants = mutants.map((mutant) => ({ ...mutant, data: Buffer.from(replaceOnce(original.toString("utf8"), mutant)) }));
  const manifest = JSON.parse(files.get(`${project}/package.json`).data.toString("utf8"));
  if (!manifest.dependencies?.next || !manifest.devDependencies?.vitest) {
    throw new Error("App must declare Next.js and Vitest dependencies.");
  }
  const app = join(destination, project);
  const evidence = join(destination, "qualification-evidence");
  const reportPath = join(destination, "qualification-report.json");
  const summary = {
    version: 1, kind: "readiness-test-qualification", profile: "readiness-v1",
    executionMode: "development-test", humanAcceptance: false,
    source: { repository: source, commit: options.sourceRef }, destination, reportPath,
    startedAt: now().toISOString(), status: "failed", qualified: false, exitCode: 1,
    original: { path: route, gitBlob: tracked.get(route).blob, sha256: sha256(original) },
    tests: Object.fromEntries([...files].filter(([path]) => isTestFile(path)).map(([path, entry]) =>
      [path, { gitBlob: tracked.get(path).blob, sha256: sha256(entry.data) }])),
    requiredTests: Object.fromEntries(requiredTests),
    dependencies: { strategy: "npm-ci-scratch", status: "not-run" },
    baseline: { status: "not-run" }, final: { status: "not-run" },
    mutants: variants.map(({ id, before, after, data, kills }) => ({
      id, status: "not-run", replacement: { before, after }, sha256: sha256(data), requiredFailures: kills,
    })),
    restored: false, testBlobsUnchanged: false, errors: [],
  };
  mkdirSync(destination, { mode: 0o700 });
  mkdirSync(evidence, { mode: 0o700 });
  const persist = () => writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
  const errorAt = (phase, error, kind = "qualification-error") => {
    const path = join(evidence, `error-${summary.errors.length + 1}.json`);
    writeFileSync(path, `${JSON.stringify({
      message: error.message ?? String(error), stack: error.stack,
      stdout: error.stdout?.toString(), stderr: error.stderr?.toString(),
      code: error.code, signal: error.signal, status: error.status,
    }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    const diagnostic = { phase, kind, evidence: relative(destination, path) };
    summary.errors.push(diagnostic);
    return diagnostic;
  };
  let exported = false;
  let dependenciesReady = false;
  let phase = "export";
  const env = { ...process.env, CI: "true", NO_COLOR: "1", NODE_ENV: "test" };
  delete env.FORCE_COLOR;
  const runSuite = (id, expectedRoute, mutant) => {
    const result = { id, status: "error", exitCode: null, assertionFailures: [], expectedApplicationErrors: [] };
    let errorKind = "export-integrity";
    try {
      checkTree(destination, files, expectedRoute);
      errorKind = "runner-setup";
      const work = join(evidence, id);
      mkdirSync(work, { mode: 0o700 });
      const jsonPath = join(work, "vitest.json");
      const errorsPath = join(work, "lifecycle.json");
      result.evidence = {
        json: relative(destination, jsonPath), lifecycle: relative(destination, errorsPath),
        stdout: relative(destination, join(work, "stdout.txt")), stderr: relative(destination, join(work, "stderr.txt")),
      };
      let stdout = "";
      let stderr = "";
      let infrastructureError;
      try {
        stdout = run(process.execPath, [
          join(app, "node_modules/vitest/vitest.mjs"), "run",
          ...[...requiredTests.keys()].map((path) => relative(project, path)),
          "--reporter=json", `--reporter=${join(evidence, "vitest-errors-reporter.mjs")}`,
          `--outputFile=${jsonPath}`, "--maxWorkers=1", "--no-file-parallelism",
          "--retry=0", "--bail=0", "--no-allowOnly", "--no-passWithNoTests",
        ], {
          cwd: app, timeout: 60_000,
          env: {
            ...env, TMPDIR: work, TMP: work, TEMP: work, VITEST_ERRORS_REPORT: errorsPath,
            SERVICE_DESK_DB_PATH: join(work, "service-desk.db"),
          },
        });
        result.exitCode = 0;
      } catch (error) {
        stdout = error.stdout ?? "";
        stderr = error.stderr ?? "";
        result.exitCode = Number.isInteger(error.status) ? error.status : null;
        if (result.exitCode !== 1 || error.signal || error.code) infrastructureError = error;
      }
      writeFileSync(join(work, "stdout.txt"), stdout, { mode: 0o600 });
      writeFileSync(join(work, "stderr.txt"), stderr, { mode: 0o600 });
      errorKind = "export-integrity";
      checkTree(destination, files, expectedRoute);
      errorKind = "test-process";
      if (infrastructureError) throw new Error(`Vitest process infrastructure error: ${infrastructureError.message}`);
      errorKind = "test-evidence";
      const json = JSON.parse(readFileSync(regularPath(destination, relative(destination, jsonPath)), "utf8"));
      const lifecycle = JSON.parse(readFileSync(regularPath(destination, relative(destination, errorsPath)), "utf8"));
      Object.assign(result, classify(json, lifecycle, result.exitCode, destination, mutant));
    } catch (error) {
      result.error = errorAt(id, error, errorKind);
    }
    return result;
  };
  try {
    for (const [path, entry] of files) {
      const target = join(destination, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.data, { flag: "wx", mode: entry.mode });
    }
    exported = true;
    const reporterData = readFileSync(reporter);
    writeFileSync(join(evidence, "vitest-errors-reporter.mjs"), reporterData, { flag: "wx" });
    summary.reporterSha256 = sha256(reporterData);
    persist();
    phase = "dependencies";
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(evidence, "npm-cache")], {
      cwd: app, timeout: 180_000, env: { ...env, TMPDIR: evidence, TMP: evidence, TEMP: evidence },
    });
    const vitest = JSON.parse(readFileSync(regularPath(destination, `${project}/node_modules/vitest/package.json`), "utf8"));
    regularPath(destination, `${project}/node_modules/vitest/vitest.mjs`);
    regularPath(destination, `${project}/node_modules/next/package.json`);
    if (!/^5\./.test(vitest.version)) throw new Error("This bounded reporter profile requires Vitest 5.");
    summary.dependencies = { strategy: "npm-ci-scratch", status: "installed", vitest: vitest.version };
    dependenciesReady = true;
    phase = "baseline";
    summary.baseline = runSuite("baseline", original);
    persist();
    if (summary.baseline.status === "passed") {
      for (const [index, mutant] of variants.entries()) {
        phase = mutant.id;
        checkTree(destination, files, original);
        writeFileSync(regularPath(destination, route), mutant.data);
        try {
          Object.assign(summary.mutants[index], runSuite(mutant.id, mutant.data, mutant));
        } finally {
          restore();
        }
        persist();
        if (summary.mutants[index].status === "error") break;
      }
    }
  } catch (error) {
    errorAt(phase, error);
    if (phase === "dependencies") summary.dependencies.status = "error";
  } finally {
    if (exported) {
      try {
        restore();
        summary.restored = true;
        checkTree(destination, files, original);
        summary.testBlobsUnchanged = true;
        if (dependenciesReady) summary.final = runSuite("final", original);
        checkTree(destination, files, original);
      } catch (error) {
        summary.testBlobsUnchanged = false;
        errorAt("restore/final-integrity", error);
      } finally {
        try {
          restore();
          summary.restored = true;
        } catch (error) {
          summary.restored = false;
          errorAt("restore-after-final", error);
        }
      }
    }
    summary.qualified = summary.restored && summary.testBlobsUnchanged &&
      !summary.errors.length && summary.baseline.status === "passed" && summary.final.status === "passed" &&
      summary.mutants.every((mutant) => mutant.status === "killed");
    summary.status = summary.qualified ? "qualified" : "failed";
    summary.exitCode = summary.qualified ? 0 : 1;
    summary.finishedAt = now().toISOString();
    persist();
  }
  return summary;

  function restore() {
    // Never follow a runner-created link when putting the controlled route back.
    const target = regularPath(destination, route, { allowMissing: true, allowLeafLink: true });
    try {
      if (lstatSync(target).isSymbolicLink()) unlinkSync(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    writeFileSync(regularPath(destination, route, { allowMissing: true }), original, { mode: files.get(route).mode });
  }
}
