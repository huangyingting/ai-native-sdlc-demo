import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execute, fullSha, newDestination, repository, reviewerLogin, sha256 } from "./common.mjs";
import { exactImage } from "./docker.mjs";
import { seedProbe, verifySeededDataset } from "./dataset.mjs";
import { createLab, immutableImage } from "./lab.mjs";
import { createGateway } from "./gateway.mjs";
import { probeService, requireHealthy, requireUnavailable } from "./probes.mjs";
import { monitorService, buildMaintenanceIntent, verifyRecovery } from "./operations.mjs";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const snapshotScript = `
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("/app/data/service-desk.db", { readOnly: true });
try {
  console.log(JSON.stringify({
    columns: db.prepare("PRAGMA table_info(tickets)").all(),
    rows: db.prepare("SELECT * FROM tickets ORDER BY id").all(),
  }));
} finally { db.close(); }
`;

export async function waitForProbe(url, { fault = false, readinessRequired = true, attempts = 30 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await probeService(url, { readinessRequired });
    if ((!fault && result.ok) || (fault && result.health.ok &&
        result.readiness.status === 503 && result.readiness.failure === "unavailable")) {
      return { attempts: attempt, result };
    }
    if (attempt < attempts) await sleep(1000);
  }
  throw new Error("Container did not meet the required HTTP contracts within the startup deadline.");
}

async function withLab(options, action) {
  immutableImage(options.image);
  const destination = newDestination(options.dest, sourceRoot);
  mkdirSync(destination, { mode: 0o700 });
  const lab = createLab(options.image);
  const report = {
    version: 1, kind: "brownfield-reliability-rehearsal", executionMode: "development-test",
    humanAcceptance: false, productionReady: false, image: options.image,
    imageIdentity: options.image.startsWith("ghcr.io/") ? "published-digest" : "local-image-id",
    startedAt: new Date().toISOString(), status: "running",
    resources: { run: lab.id, volume: lab.volume, containers: [] },
  };
  const reportPath = join(destination, "evidence.json");
  const save = () => writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  save();
  let failure;
  try {
    lab.initialize();
    report.imageRevision = lab.revision;
    await action(lab, report, destination, save);
    report.status = "passed";
  } catch (error) {
    failure = error;
    report.status = "failed";
    if (error.evidence?.kind === "brownfield-operations-monitor") report.operations = error.evidence;
    report.error = "Rehearsal failed. Inspect the command error locally; raw exceptions and logs are not exported.";
  } finally {
    try {
      lab.cleanup();
      report.resources.cleaned = true;
    } catch (error) {
      failure = failure ? new AggregateError([failure, error], "Rehearsal and cleanup failed.") : error;
      report.status = "failed";
      report.resources.cleaned = false;
    }
    report.resources.containers = lab.containers.map(({ id, name, role, fault }) => ({ id, name, role, fault }));
    report.finishedAt = new Date().toISOString();
    save();
  }
  if (failure) throw new Error(`${failure.message} Evidence: ${reportPath}`, { cause: failure });
  return { ...report, destination, reportPath };
}

async function verifyControls(lab, report, readinessRequired) {
  const stable = lab.start("stable");
  report.control = await waitForProbe(stable.url, { readinessRequired });
  requireHealthy(report.control.result);
  report.dataset = verifySeededDataset(JSON.parse(lab.exec(stable, seedProbe)));
  if (readinessRequired) {
    const fault = lab.start("bad-config", { fault: true });
    report.fault = await waitForProbe(fault.url, { fault: true });
    requireUnavailable(report.fault.result);
    return { stable, fault };
  }
  report.readiness = { status: "not-tested", reason: "Explicit ownership-free baseline profile." };
  return { stable };
}

export async function verifyImage(options) {
  if (!["baseline", "readiness"].includes(options.profile)) throw new Error("Choose explicit --profile baseline or readiness.");
  return withLab(options, async (lab, report) => {
    report.loop = "image-verification";
    report.profile = options.profile;
    await verifyControls(lab, report, options.profile === "readiness");
  });
}

function snapshot(lab, container) {
  const value = JSON.parse(lab.exec(container, snapshotScript));
  if (value.rows?.length !== 4 || !value.columns?.some((column) => column.name === "owner")) {
    throw new Error("Recovery rehearsal requires the known four-ticket ownership dataset.");
  }
  return { sha256: sha256(JSON.stringify(value)), count: value.rows.length };
}

function fixtureWrite(lab, container, id) {
  if (![1, 2].includes(id)) throw new Error("Only known fresh lab fixture IDs may be updated.");
  lab.exec(container, `
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("/app/data/service-desk.db");
try {
  const result = db.prepare("UPDATE tickets SET owner = ? WHERE id = ?").run(
    ${JSON.stringify(id === 1 ? "avery-stone" : "jordan-lee")}, ${id});
  if (result.changes !== 1) throw new Error("Fixture write must update exactly one row");
} finally { db.close(); }
`);
}

async function requireRouted(gateway, release) {
  requireHealthy(await probeService(gateway.url));
  const response = await fetch(`${gateway.url}/api/health`, { signal: AbortSignal.timeout(3000), redirect: "error" });
  await response.text();
  if (response.status !== 200 || response.headers.get("x-demo-release") !== release) {
    throw new Error("Actual gateway traffic did not reach the expected release.");
  }
}

export async function rehearseReliability(options) {
  exactImage(options.image);
  const repo = repository(options.repo);
  const owner = reviewerLogin(options.owner);
  const qualificationBytes = readFileSync(options.qualification);
  const qualification = JSON.parse(qualificationBytes);
  validateQualification(qualification);
  return withLab(options, async (lab, report, destination, save) => {
    report.loop = "verification-release-operations";
    report.repo = repo;
    report.qualification = bindQualification(qualification, qualificationBytes, lab.revision);
    report.scope = "Same-image configuration/process recovery, read-only loopback traffic, new isolated fixture data. No cross-version migration or production canary.";
    const { stable, fault } = await verifyControls(lab, report, true);
    fixtureWrite(lab, stable, 1);
    report.dataBefore = snapshot(lab, stable);
    const gateway = await createGateway();
    try {
      await gateway.promote({ ...stable, image: options.image, release: "stable" });
      await requireRouted(gateway, "stable");
      let rejected = false;
      try { await gateway.promote({ ...fault, image: options.image, release: "bad-config" }); }
      catch { rejected = true; }
      if (!rejected || gateway.active?.release !== "stable") throw new Error("Unhealthy configuration received traffic.");
      await requireRouted(gateway, "stable");
      report.admission = { unhealthyRejected: true, stableStillServing: true, badCandidateHadVolume: false };
      save();

      const candidate = lab.start("candidate");
      await waitForProbe(candidate.url);
      await gateway.promote({ ...candidate, image: options.image, release: "candidate" });
      await requireRouted(gateway, "candidate");
      fixtureWrite(lab, candidate, 2);
      report.dataAfterCandidateWrite = snapshot(lab, candidate);
      if (report.dataBefore.sha256 === report.dataAfterCandidateWrite.sha256) throw new Error("Controlled candidate write was not observed.");
      let index = 0;
      let rollbackCount = 0;
      report.operations = await monitorService({
        url: gateway.url, image: options.image, samples: 10, intervalMs: 200,
        failureThreshold: 2, recoveryThreshold: 3,
      }, {
        probe: async (url) => {
          if (index++ === 2) lab.pause(candidate);
          return probeService(url, { timeoutMs: 2500 });
        },
        onIncident: async () => {
          await gateway.rollback();
          rollbackCount++;
        },
      });
      if (rollbackCount !== 1) throw new Error("Expected exactly one threshold-triggered rollback.");
      await requireRouted(gateway, "stable");
      report.dataAfterRollback = snapshot(lab, stable);
      if (report.dataAfterCandidateWrite.sha256 !== report.dataAfterRollback.sha256) throw new Error("Rollback changed the controlled dataset.");
      lab.unpause(candidate);
      requireHealthy((await waitForProbe(candidate.url)).result);
      report.recoveryWindow = await monitorService({
        url: gateway.url, image: options.image, samples: 5, intervalMs: 200,
        failureThreshold: 2, recoveryThreshold: 3,
      }, { probe: probeService });
      report.recovery = verifyRecovery(report.operations, report.recoveryWindow);
      if (!report.recovery.recovered || report.operations.incidents.length !== 1 ||
          report.operations.incidents[0].status !== "resolved") {
        throw new Error("A single resolved incident and a passing independent recovery window are required.");
      }
      report.gateway = { events: gateway.events, rollbackCount, activeRelease: gateway.active.release };
      report.preventiveCheck = { repeatedBadAdmissionRejected: false };
      let rejectedAgain = false;
      try { await gateway.promote({ ...fault, image: options.image, release: "bad-config" }); }
      catch { rejectedAgain = true; }
      if (!rejectedAgain) throw new Error("Bad configuration was readmitted after recovery.");
      await requireRouted(gateway, "stable");
      report.preventiveCheck.repeatedBadAdmissionRejected = true;
      report.gateway.events = gateway.events;
      report.maintenance = {
        owner, status: "draft-awaiting-review", published: false, acceptance: false,
        note: "Observed recovery does not close preventive work. Review and publish the draft through the normal repository process.",
      };
      writeFileSync(join(destination, "maintenance-intent.md"), buildMaintenanceIntent(report.operations, {
        repo, owner, evidenceReference: report.operations.id,
      }), { flag: "wx", mode: 0o600 });
    } finally {
      await gateway.close();
    }
  });
}

export function validateQualification(qualification) {
  const controls = [qualification?.baseline, qualification?.final];
  const mutantIds = [
    "skip-summary-read", "failure-returns-200", "ready-missing-no-store",
    "failure-missing-no-store", "raw-error-logging", "mutate-frozen-error",
  ];
  if (qualification?.kind !== "readiness-test-qualification" || qualification.profile !== "readiness-v1" ||
      qualification.qualified !== true || qualification.exitCode !== 0 ||
      controls.some((control) => control?.status !== "passed" || control.total !== 13 ||
        control.passed !== 13 || control.failed !== 0 || control.exitCode !== 0) || qualification.restored !== true ||
      qualification.testBlobsUnchanged !== true || qualification.mutants?.length !== 6 ||
      mutantIds.some((id) => qualification.mutants.filter((mutant) => mutant.id === id && mutant.status === "killed").length !== 1) ||
      !fullSha(qualification.source?.commit) || typeof qualification.source?.repository !== "string") {
    throw new Error("A complete passing readiness-v1 qualification report is required before rehearsal.");
  }
  return qualification;
}

export function bindQualification(qualification, qualificationBytes, imageRevision, { run = execute } = {}) {
  validateQualification(qualification);
  if (!fullSha(imageRevision)) throw new Error("Published image must identify its full source revision.");
  const tree = (revision) => run("git", [
    "-C", qualification.source.repository, "rev-parse", "--verify", `${revision}:demos/it-service-desk`,
  ], { env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" } }).trim();
  const qualifiedTree = tree(qualification.source.commit);
  if (!fullSha(qualifiedTree) || tree(imageRevision) !== qualifiedTree) {
    throw new Error("Qualified application tree differs from the image's declared source revision.");
  }
  return {
    reportSha256: sha256(qualificationBytes), commit: qualification.source.commit,
    applicationTree: qualifiedTree, imageRevision,
    note: "Git application-tree match to image OCI revision metadata, not a signed build-provenance attestation.",
  };
}
