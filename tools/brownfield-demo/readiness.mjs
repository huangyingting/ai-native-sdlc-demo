import {
  configPath, fullSha, intentNumber, positive, provenancePath, repository, validateProvenance, workflowFiles,
} from "./common.mjs";
import { contentFile, github, readOnlyApi } from "./github.mjs";
import { baselineProblems } from "./prepare.mjs";
import { acceptanceEvidence, collectEvidence, documentEvidence, trustedRecord } from "./replay.mjs";
import { loadManifest } from "./scenarios.mjs";

export { documentEvidence } from "./replay.mjs";

const documentLedger = "<!-- brownfield-human-gated-delivery-document-ledger -->";
const failureTypes = ["workflow-failed", "verification-failed"];
const failedConclusions = ["failure", "timed_out", "startup_failure"];
const variantIds = ["ownership-standard", "ownership-spec-revision", "ownership-failure-recovery"];

export function parseIntents(value, distinct = true) {
  if (typeof value !== "string") throw new Error("--intents requires three distinct comma-separated Issue numbers.");
  const parts = value.split(",");
  if (parts.length !== 3) throw new Error("--intents requires exactly three distinct Issue numbers.");
  const intents = parts.map(intentNumber);
  if (distinct && new Set(intents).size !== 3) throw new Error("--intents must identify three distinct runs, not repeated evidence.");
  return intents;
}

export function runTargets(options) {
  if (Boolean(options.repo) === Boolean(options.repos)) throw new Error("Specify either --repo or --repos, never both.");
  const intents = parseIntents(options.intents, false);
  const repos = options.repo ? Array(3).fill(repository(options.repo)) : options.repos.split(",").map(repository);
  if (repos.length !== 3) throw new Error("--repos requires exactly three OWNER/REPO values aligned with --intents.");
  const targets = intents.map((intent, index) => ({ repo: repos[index], intent }));
  if (new Set(targets.map(({ repo, intent }) => `${repo}#${intent}`)).size !== 3) throw new Error("Three distinct repository/Intent pairs are required.");
  return targets;
}

function failureReference(event, repo) {
  if (event.type === "verification-failed") {
    if (!positive(event.runAttempt)) throw new Error("Failure event has an invalid workflow attempt.");
    return { runId: intentNumber(event.runId), attempt: event.runAttempt };
  }
  if (typeof event.runUrl !== "string") throw new Error("Failure event has no exact workflow URL.");
  const url = new URL(event.runUrl);
  const prefix = `/${repo}/actions/runs/`;
  const path = url.pathname.toLowerCase();
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password ||
      url.search || url.hash || !path.startsWith(prefix)) throw new Error("Failure event points outside the explicit repository.");
  return { runId: intentNumber(path.slice(prefix.length)), attempt: null };
}

export function recoveryEvidence(record, attempts) {
  const failures = record?.events?.filter((event) => failureTypes.includes(event.type)) ?? [];
  const corroborated = [];
  for (const event of failures) {
    const candidates = attempts.filter((item) => item.event === event);
    for (const { workflow, runId, attempt } of candidates) {
      const later = record.events.find((item) =>
        ["workflow-recovered", "verification-passed"].includes(item.type) &&
        Date.parse(item.at) > Date.parse(event.at) &&
        (event.type !== "verification-failed" ||
          (item.type === "verification-passed" &&
           (Number(item.runId) > runId || (Number(item.runId) === runId && item.runAttempt > attempt)))));
      const acceptedAt = Math.min(...(record.delivery?.acceptances ?? []).map((item) => Date.parse(item.at)));
      if (workflow.id === runId && workflow.run_attempt === attempt && workflow.status === "completed" &&
          failedConclusions.includes(workflow.conclusion) &&
          workflow.repository?.full_name?.toLowerCase() === record.repository.toLowerCase() &&
          workflowFiles.some((file) => workflow.path?.split("@")[0] === `.github/workflows/${file}`) &&
          later && Date.parse(later.at) <= acceptedAt &&
          Date.parse(workflow.updated_at) <= acceptedAt) {
        corroborated.push({
          failedRunId: runId, failedAttempt: attempt, conclusion: workflow.conclusion,
          failureEventAt: event.at, recoveryEvent: later.type, recoveryEventAt: later.at,
          url: `https://github.com/${record.repository}/actions/runs/${runId}/attempts/${attempt}`,
        });
      }
    }
  }
  return { recordedFailures: failures.length, corroborated, verified: failures.length > 0 && corroborated.length > 0 };
}

async function workflowAttempts(record, client) {
  const failures = record.events.filter((event) => failureTypes.includes(event.type));
  if (failures.length > 10) throw new Error("Readiness supports at most ten recorded failures per Intent; review larger histories separately.");
  const results = [];
  for (const event of failures) {
    const { runId, attempt } = failureReference(event, record.repository.toLowerCase());
    const latest = client.get(`actions/runs/${runId}`);
    if (!positive(latest.run_attempt) || latest.run_attempt > 20) throw new Error("Workflow attempt history exceeds the bounded readiness check.");
    const numbers = attempt ? [attempt] : Array.from({ length: latest.run_attempt }, (_, index) => index + 1);
    for (const number of numbers) {
      const workflow = number === latest.run_attempt ? latest : client.get(`actions/runs/${runId}/attempts/${number}`);
      results.push({ event, runId, attempt: number, workflow });
    }
  }
  return results;
}

async function baselineEvidence(client, baseline, manifest) {
  if (!fullSha(baseline)) throw new Error("Run baseline is not pinned.");
  const tree = client.get(`git/trees/${baseline}?recursive=1`);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("Run baseline tree is incomplete.");
  const files = new Map(tree.tree.filter((item) => item.type === "blob").map((item) => [item.path, { data: Buffer.alloc(0) }]));
  for (const path of [
    configPath, provenancePath, `${manifest.project}/Dockerfile`,
    ...Object.keys(manifest.baseline.files).map((path) => `${manifest.project}/${path}`),
  ]) {
    if (files.has(path)) files.set(path, { data: contentFile(client.get(`contents/${path}?ref=${baseline}`)) });
  }
  const reasons = baselineProblems(files, manifest);
  let sourceCommit = null;
  try {
    sourceCommit = validateProvenance(JSON.parse(files.get(provenancePath)?.data.toString() ?? "null")).source.commit;
  } catch (error) { reasons.push(error.message); }
  return { verified: reasons.length === 0, commit: baseline, sourceCommit, reasons };
}

export function scenarioEvidence(evidence, documents, recovery, baseline) {
  const { record, summary, issues, pulls, workflows, config } = evidence;
  const acceptance = acceptanceEvidence(record, issues, pulls, workflows, config, summary.recordTrusted);
  const reasons = [...acceptance.reasons, ...documents.reasons, ...baseline.reasons];
  if (record?.failure !== null) reasons.push("Run has an unresolved or missing failure-state field.");
  if (typeof record?.delivery?.runId !== "string" || !positive(record?.delivery?.runAttempt) ||
      !/^[a-f0-9]{64}$/.test(record?.delivery?.policyHash ?? "") ||
      record.delivery.acceptances.some((item) => item.runId !== record.delivery.runId ||
        item.runAttempt !== record.delivery.runAttempt || item.digest !== record.delivery.digest ||
        typeof item.commentBody !== "string")) reasons.push("Run lacks current attempt-bound Human acceptance metadata.");
  let variant = null;
  if (!reasons.length) {
    if (recovery.verified) variant = "ownership-failure-recovery";
    else if (recovery.recordedFailures) reasons.push("Recorded failure has no corroborated failed Actions attempt and subsequent recovery.");
    else if (documents.counters.spec > 1 && documents.revisionCommentIds.length) variant = "ownership-spec-revision";
    else if (documents.counters.spec === 1 + (documents.decisionCommentIds?.length ?? 0) &&
        documents.counters.plan === 1 && !documents.revisionCommentIds.length) variant = "ownership-standard";
    else reasons.push("Document history does not match one of the three fixed process variants.");
  }
  return {
    repository: record?.repository.toLowerCase(), intent: summary.intent, accepted: acceptance.complete, variant,
    eligible: Boolean(variant), baseline: record?.baseline ?? null,
    deliveryRunId: record?.delivery?.runId ?? null, deliveryAttempt: record?.delivery?.runAttempt ?? null,
    implementationPull: record?.delivery?.pullNumber ?? null, mergeSha: record?.delivery?.mergeSha ?? null,
    sourceCommit: baseline.sourceCommit, documents, recovery, baselineEvidence: baseline, reasons,
    recordUrl: summary.recordUrl, capturedAt: summary.capturedAt,
  };
}

export function readinessGate(repos, intents, runs) {
  const repositories = typeof repos === "string" ? Array(3).fill(repos) : repos;
  const reasons = [];
  if (runs.length !== 3 || runs.some((run) => !run.eligible)) reasons.push("Three independently corroborated accepted runs are required.");
  if (["intent", "implementationPull", "deliveryRunId", "mergeSha"].some((key) =>
    new Set(runs.map((run) => `${run.repository}#${run[key]}`)).size !== 3)) {
    reasons.push("Intents, implementation PRs, publish runs and merges must all be distinct; retries are not additional demos.");
  }
  if (new Set(runs.map((run) => run.sourceCommit)).size !== 1 || !fullSha(runs[0]?.sourceCommit)) {
    reasons.push("All three ownership-free baselines must have provenance from the same immutable source commit.");
  }
  if (!variantIds.every((variant) => runs.some((run) => run.variant === variant))) {
    reasons.push("Require one normal run, one Human Spec revision, and one real failure/recovery run.");
  }
  const ready = reasons.length === 0;
  return {
    version: 1, mode: "read-only-readiness", repositories, intents, ready,
    completedScenarios: ready ? 3 : 0, requiredScenarios: 3, progress: ready ? "3/3" : "0/3",
    observedAcceptedRuns: runs.filter((run) => run.accepted).length,
    reasons, runs,
    note: "All-or-nothing evidence gate, not a live execution or semantic proof of every application observation. No user-supplied completion flags or declared scenario IDs are counted.",
  };
}

export async function readiness(options, { api = readOnlyApi, now = () => new Date(), manifest = loadManifest(), collect = collectEvidence } = {}) {
  const targets = runTargets(options);
  const baselines = new Map();
  const runs = [];
  for (const { repo, intent } of targets) {
    try {
      const client = github(repo, api);
      const evidence = await collect({ repo, intent }, { api, now });
      if (!evidence.record || !evidence.summary.recordTrusted) throw new Error("Runtime state is absent or unsigned; this run cannot count.");
      const baseline = evidence.record.baseline;
      const baselineKey = `${repo}@${baseline}`;
      if (!baselines.has(baselineKey)) baselines.set(baselineKey, await baselineEvidence(client, baseline, manifest));
      const stateLink = evidence.summary.documents.find((item) => item.path.endsWith("/document-review.json"));
      if (!stateLink || !fullSha(stateLink.commit)) throw new Error("No immutable document approval record is available.");
      let snapshot = evidence.documentSnapshot;
      if (!snapshot || snapshot.commit !== stateLink.commit || snapshot.path !== stateLink.path) {
        const raw = contentFile(client.get(`contents/${stateLink.path}?ref=${stateLink.commit}`));
        const trusted = await trustedRecord(api, evidence.issues[0].comments, stateLink.commit, raw, documentLedger);
        const texts = {};
        for (const stage of ["spec", "plan"]) {
          const path = stateLink.path.replace("document-review.json", `${stage}.md`);
          texts[stage] = contentFile(client.get(`contents/${path}?ref=${stateLink.commit}`)).toString("utf8");
        }
        snapshot = { state: JSON.parse(raw), texts, trusted };
      }
      const documents = {
        ...documentEvidence(evidence, snapshot.state, snapshot.texts, snapshot.trusted),
        recordUrl: `https://github.com/${repo}/blob/${stateLink.commit}/${stateLink.path}`,
      };
      const recovery = recoveryEvidence(evidence.record, await workflowAttempts(evidence.record, client));
      runs.push(scenarioEvidence(evidence, documents, recovery, baselines.get(baselineKey)));
    } catch (error) {
      runs.push({ repository: repo, intent, eligible: false, accepted: false, variant: null, reasons: [error.message] });
    }
  }
  return readinessGate(targets.map((target) => target.repo), targets.map((target) => target.intent), runs);
}
