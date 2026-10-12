import { repository, reviewerLogin, sha256 } from "./common.mjs";
import { exactImage } from "./docker.mjs";

const checks = ["health", "readiness", "journey"];
const failures = new Set([
  "http-error", "network-error", "timeout", "invalid-response", "unexpected-content", "probe-failed",
  "transport", "health-contract", "readiness-contract", "unavailable", "not-ready", "dashboard-contract", "detail-contract",
]);
const monitorErrors = new Set(["probe-error", "invalid-probe", "sleep-error", "clock-error", "incident-action-error"]);
const maxSamplingWaits = 8;
const note = "Development-test, not Human acceptance. Availability is a short-window sample ratio, not an SLO. Recovery is operational observation, not code repair or preventive action completion.";

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function policy(options) {
  const samples = integer(options.samples === undefined ? 10 : options.samples, 1, 120, "samples");
  return {
    samples,
    intervalMs: integer(options.intervalMs === undefined ? 200 : options.intervalMs, 1, 60000, "intervalMs"),
    failureThreshold: integer(options.failureThreshold === undefined ? 2 : options.failureThreshold, 1, samples, "failureThreshold"),
    recoveryThreshold: integer(options.recoveryThreshold === undefined ? 3 : options.recoveryThreshold, 1, samples, "recoveryThreshold"),
  };
}

function targetUrl(value) {
  if (typeof value !== "string" || !/^http:\/\/127\.0\.0\.1(?::[1-9]\d{0,4})?\/?$/.test(value)) {
    throw new Error("url must be an http://127.0.0.1 origin without credentials, paths, query, or fragment.");
  }
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Invalid loopback URL port."); }
  return { url: parsed.origin, target: { host: "127.0.0.1", port: Number(parsed.port || 80) } };
}

function timestamp(value) {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999) return value;
  } else if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed >= 0 && new Date(parsed).toISOString() === value) return parsed;
  }
  throw new Error("Invalid observation timestamp.");
}

const iso = (value) => new Date(value).toISOString();

function sanitizeCheck(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.ok !== "boolean" ||
      !(value.status === null || Number.isInteger(value.status) && value.status >= 100 && value.status <= 599) ||
      typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) ||
      value.latencyMs < 0 || value.latencyMs > Number.MAX_SAFE_INTEGER ||
      value.failure !== undefined && typeof value.failure !== "string" ||
      value.ok && (value.status === null || value.status < 200 || value.status >= 300 || value.failure !== undefined)) {
    throw new Error("Malformed probe check.");
  }
  const result = { ok: value.ok, status: value.status, latencyMs: value.latencyMs };
  if (!value.ok) result.failure = failures.has(value.failure) ? value.failure : "probe-failed";
  return result;
}

function sanitizeSample(value, sequence, started, completed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.ok !== "boolean") {
    throw new Error("Malformed probe result.");
  }
  const at = timestamp(value.at);
  if (at < started || at > completed) throw new Error("Probe timestamp is outside its measured window.");
  const endpoints = Object.fromEntries(checks.map((name) => [name, sanitizeCheck(value[name])]));
  if (value.ok !== checks.every((name) => endpoints[name].ok)) throw new Error("Inconsistent probe result.");
  return { sequence, startedAt: iso(started), completedAt: iso(completed), at: iso(at), ok: value.ok, ...endpoints };
}

function incidentsFor(samples, image, target, settings, completed) {
  const incidents = [];
  let active = null;
  let failuresInRow = [];
  let successesInRow = [];
  for (const sample of samples) {
    if (!sample.ok) {
      successesInRow = [];
      failuresInRow.push(sample);
      if (!active && failuresInRow.length === settings.failureThreshold) {
        active = {
          id: `incident-${sha256(JSON.stringify([image, target, sample.at, sample.sequence])).slice(0, 24)}`,
          status: "open", firstFailureAt: failuresInRow[0].at, openedAt: sample.at,
          lastFailureAt: sample.at, resolvedAt: null, recoveryStartedAt: null,
          detectionMs: timestamp(sample.at) - timestamp(failuresInRow[0].at),
          recoveryMs: null, observedImpactMs: null, failedSamples: 0, symptoms: [],
        };
        incidents.push(active);
        for (const failed of failuresInRow) addFailure(active, failed);
      } else if (active) addFailure(active, sample);
    } else {
      failuresInRow = [];
      if (!active) continue;
      successesInRow.push(sample);
      if (successesInRow.length === settings.recoveryThreshold) {
        active.status = "resolved";
        active.recoveryStartedAt = successesInRow[0].at;
        active.resolvedAt = sample.at;
        active.recoveryMs = timestamp(sample.at) - timestamp(active.openedAt);
        active.observedImpactMs = timestamp(sample.at) - timestamp(active.firstFailureAt);
        active = null;
        successesInRow = [];
      }
    }
  }
  if (active) active.observedImpactMs = completed - timestamp(active.firstFailureAt);
  return incidents;
}

function addFailure(incident, sample) {
  incident.failedSamples++;
  incident.lastFailureAt = sample.at;
  for (const name of checks) {
    const check = sample[name];
    if (check.ok) continue;
    const existing = incident.symptoms.find((item) =>
      item.check === name && item.status === check.status && item.failure === check.failure);
    if (existing) existing.samples++;
    else incident.symptoms.push({ check: name, status: check.status, failure: check.failure, samples: 1 });
  }
}

function evidenceFor({ image, target, settings, started, completed, samples, monitorError = null }) {
  const complete = monitorError === null && samples.length === settings.samples;
  const healthy = samples.filter((sample) => sample.ok).length;
  const incidents = incidentsFor(samples, image, target, settings, completed);
  const open = incidents.some((incident) => incident.status === "open");
  const core = {
    version: 1, kind: "brownfield-operations-monitor", executionMode: "development-test",
    image, digest: image.split("@")[1], target, policy: settings,
    startedAt: iso(started), completedAt: iso(completed), windowMs: completed - started,
    complete, monitorError,
    status: !complete ? "monitor-error" : open ? "incident-open" :
      samples.at(-1)?.ok !== true ? "degraded" : incidents.length ? "recovered" :
        healthy === samples.length ? "healthy" : "degraded",
    allHealthy: complete && healthy === samples.length,
    accepted: false, humanAcceptance: false, preventiveActionCompleted: false,
    availability: {
      scope: "short-window-observation-not-slo", healthySamples: healthy,
      failedSamples: samples.length - healthy, totalSamples: samples.length,
      ratio: samples.length ? healthy / samples.length : null,
    },
    samples, incidents, note,
  };
  return { id: `sha256:${sha256(JSON.stringify(core))}`, ...core };
}

/**
 * probe returns a timestamped health/readiness/journey result; now returns epoch
 * milliseconds. Probe timestamps must fall inside the measured call window.
 * Defaults: 10 samples, 200 ms between calls, failure threshold 2, recovery 3.
 * HTTP/transport failures are valid failed probes; missing/malformed data is not.
 * Returned evidence contains samples, incidents, availability, and a linking ID.
 * Optional onIncident is awaited once per newly opened incident. The caller
 * supplies its preauthorized policy; only subsequent probes establish recovery.
 * An infrastructure/malformed-probe error throws with sanitized partial evidence.
 */
export async function monitorService(options, {
  probe, onIncident, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), now = Date.now,
} = {}) {
  if (!options || typeof options !== "object") throw new Error("Monitor options are required.");
  const image = exactImage(options.image);
  const { url, target } = targetUrl(options.url);
  const settings = policy(options);
  if (typeof probe !== "function" || typeof sleep !== "function" || typeof now !== "function" ||
      onIncident !== undefined && typeof onIncident !== "function") {
    throw new Error("An injected probe and callable sleep/now/onIncident dependencies are required.");
  }
  const samples = [];
  const notifiedIncidents = new Set();
  let started;
  let completed;
  let errorKind = "clock-error";
  try {
    started = timestamp(now());
    completed = started;
    for (let index = 0; index < settings.samples; index++) {
      let sampleStart = started;
      if (index) {
        const deadline = completed + settings.intervalMs;
        let previous = completed;
        let remaining = settings.intervalMs;
        // Timers can wake early; bounded remainder waits still reject stalled clocks.
        for (let wait = 0; wait < maxSamplingWaits; wait++) {
          errorKind = "sleep-error";
          await sleep(remaining);
          errorKind = "clock-error";
          sampleStart = timestamp(now());
          if (sampleStart < previous) throw new Error("The sampling clock moved backwards.");
          if (sampleStart >= deadline) break;
          previous = sampleStart;
          remaining = deadline - sampleStart;
        }
        if (sampleStart < deadline) throw new Error("The sampling clock did not reach the deadline within bounded waits.");
      }
      completed = sampleStart;
      errorKind = "probe-error";
      const raw = await probe(url);
      errorKind = "clock-error";
      const sampleEnd = timestamp(now());
      if (sampleEnd < sampleStart) throw new Error("The sampling clock moved backwards.");
      completed = sampleEnd;
      errorKind = "invalid-probe";
      samples.push(sanitizeSample(raw, index + 1, sampleStart, sampleEnd));
      if (onIncident && !samples.at(-1).ok) {
        const incident = incidentsFor(samples, image, target, settings, completed).at(-1);
        if (incident?.status === "open" && !notifiedIncidents.has(incident.id)) {
          notifiedIncidents.add(incident.id);
          errorKind = "incident-action-error";
          await onIncident({
            ...incident, image, digest: image.split("@")[1],
            monitorStartedAt: iso(started), executionMode: "development-test",
          });
        }
      }
    }
    return evidenceFor({ image, target, settings, started, completed, samples });
  } catch {
    const error = new Error(`Operations monitoring failed (${errorKind}); no successful completion is claimed.`);
    error.code = "OPERATIONS_MONITOR_FAILED";
    error.reason = errorKind;
    if (started !== undefined) {
      error.evidence = evidenceFor({ image, target, settings, started, completed, samples, monitorError: errorKind });
    }
    throw error;
  }
}

function validateEvidence(value) {
  try {
    if (!value || value.version !== 1 || value.kind !== "brownfield-operations-monitor" ||
        value.executionMode !== "development-test" || value.accepted !== false || value.humanAcceptance !== false ||
        value.preventiveActionCompleted !== false || !value.policy ||
        !["samples", "intervalMs", "failureThreshold", "recoveryThreshold"].every((key) => Object.hasOwn(value.policy, key)) ||
        value.target?.host !== "127.0.0.1" ||
        !Array.isArray(value.samples) || value.samples.length > 120 ||
        !(value.monitorError === null || monitorErrors.has(value.monitorError))) throw new Error();
    const image = exactImage(value.image);
    const target = { host: "127.0.0.1", port: integer(value.target.port, 1, 65535, "port") };
    const settings = policy(value.policy);
    const started = timestamp(value.startedAt);
    const completed = timestamp(value.completedAt);
    if (completed < started || value.samples.length > settings.samples ||
        value.monitorError === null && value.samples.length !== settings.samples) throw new Error();
    let lastCompleted = started;
    const samples = value.samples.map((sample, index) => {
      const start = timestamp(sample.startedAt);
      const end = timestamp(sample.completedAt);
      if (sample.sequence !== index + 1 || end < start || end > completed ||
          index === 0 && start !== started ||
          index > 0 && start < lastCompleted + settings.intervalMs) throw new Error();
      lastCompleted = end;
      return sanitizeSample(sample, index + 1, start, end);
    });
    if (value.monitorError === null && lastCompleted !== completed) throw new Error();
    const clean = evidenceFor({ image, target, settings, started, completed, samples, monitorError: value.monitorError });
    // IDs link canonical observations, not provenance or authenticity.
    if (value.id !== clean.id) throw new Error();
    return clean;
  } catch {
    throw new Error("Invalid or inconsistent operations evidence.");
  }
}

function selectIncident(evidence, incidentId) {
  if (incidentId === undefined && evidence.incidents.length === 1) return evidence.incidents[0];
  const incident = evidence.incidents.find((item) => item.id === incidentId);
  if (!incident) throw new Error("Select an incident belonging to the supplied operations evidence.");
  return incident;
}

function safeReference(value, repo) {
  if (typeof value === "string" && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value)) return value;
  if (typeof value !== "string" || /[\s\\]/.test(value)) throw new Error("Use a safe same-repository GitHub evidence reference or sha256 evidence ID.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid evidence reference."); }
  const prefix = `/${repo}/`;
  const suffix = url.pathname.slice(prefix.length);
  if (url.origin !== "https://github.com" || url.username || url.password || url.search ||
      !url.pathname.startsWith(prefix) ||
      !/^(?:(?:issues|pull)\/[1-9]\d*|actions\/runs\/[1-9]\d*(?:\/attempts\/[1-9]\d*)?)$/.test(suffix) ||
      url.hash && !/^#issuecomment-[1-9]\d*$/.test(url.hash) ||
      value !== `${url.origin}${url.pathname}${url.hash}`) {
    throw new Error("Use a safe same-repository GitHub evidence reference or sha256 evidence ID.");
  }
  return value;
}

/**
 * Returns an unpublished, ordinary English maintenance issue body without
 * delivery lifecycle metadata. Select incidentId when a
 * window contains multiple incidents; evidenceReference is a safe GitHub link
 * or a sha256 evidence ID, never an arbitrary file path or raw observation.
 */
export function buildMaintenanceIntent(value, { repo, owner, evidenceReference, incidentId } = {}) {
  const evidence = validateEvidence(value);
  repo = repository(repo);
  owner = reviewerLogin(owner);
  const reference = safeReference(evidenceReference, repo);
  const incident = selectIncident(evidence, incidentId);
  const symptoms = incident.symptoms.map((item) =>
    `- ${item.check}: ${item.failure}; HTTP ${item.status ?? "unavailable"}; ${item.samples} failed sample(s).`).join("\n");
  return `### Operations maintenance

Execution context: operator-approved development-test remediation, not independent Human acceptance.

This is an ordinary operations maintenance issue for a normal reviewed workflow/tooling PR, not an instruction to start or approve an existing delivery lifecycle. Production application source remains unchanged.

### Problem or opportunity

A bounded development-test observation detected an availability incident. This is not a production outage claim or genuine Human acceptance.

- Repository: \`${repo}\`
- Responsible owner: @${owner}
- Evidence reference: ${reference}
- Operations evidence ID: \`${evidence.id}\`
- Incident: \`${incident.id}\` (${incident.status})
- Exact observed image: \`${evidence.image}\`
- Exact observed digest: \`${evidence.digest}\`
- Observation window: ${evidence.startedAt} to ${evidence.completedAt} (${evidence.windowMs} ms).
- Actual measured impact: ${incident.failedSamples} failing composite probe sample(s) in this incident; ${evidence.availability.failedSamples}/${evidence.availability.totalSamples} failing samples in the complete observed data.
- Detection: ${incident.detectionMs} ms from first observed failure (${incident.firstFailureAt}) to threshold confirmation (${incident.openedAt}).
- Recovery confirmation: ${incident.resolvedAt === null ? "not observed; incident remains open" : `${incident.resolvedAt}; ${incident.recoveryMs} ms after detection`}.
- Observed incident span: ${incident.observedImpactMs} ms, ending at ${incident.resolvedAt === null ? "the observation cutoff, not resolution" : "recovery confirmation"}. This sampled span is not a measurement of continuous downtime.
- Short-window availability sample ratio: ${evidence.availability.ratio}; this is not an SLO or a production reliability estimate.
- Monitor completion: ${evidence.complete ? "complete" : `incomplete (${evidence.monitorError}); no successful monitoring completion claimed`}.

Redacted symptoms (no response bodies, exception messages, private paths, or ticket content):

${symptoms}

### Proposed outcome

Restore and verify availability, then separately evaluate a bounded, operator-reviewed configuration remedy and admission prevention. Availability recovery, including rollback, does not establish that a code repair or preventive action is complete. Preventive action is not yet verified.

### Affected users and systems

Operators and reviewers of the development-test IT service desk in \`demos/it-service-desk\`. Failed health, readiness, or dashboard-journey observations describe this test runtime only; no production customer impact is established.

### Constraints and non-goals

- Keep accepted lifecycle artifacts, production application source, and the original image digest immutable. Scope the configuration/admission-prevention change to workflow or repository tooling in a normal PR.
- Preserve ticket data, existing workflows, and the lightweight liveness contract.
- Limit investigation and remediation to the evidenced configuration/admission failure mode. Authentication changes, unrelated features, production changes, and broader SLO claims are out of scope.
- Retain only allowlisted status, latency, failure category, timestamps, and image identity. Do not publish raw bodies, logs, exception text, credentials, or ticket content.
- Any automated rollback must execute only an operator-approved development-test recovery policy. Invoking that policy does not prove recovery, a code repair, preventive completion, or independent Human acceptance.
- Require operator review of the normal maintenance PR and its actual verification evidence. Do not add delivery lifecycle automation labels or metadata. This draft neither publishes an Issue nor grants approval or acceptance.

### Acceptance criteria

1. Reproduce the observed failure safely in an isolated development-test runtime; retain digest-bound, redacted before-evidence without altering accepted data.
2. Implement a strict, fail-closed readiness admission gate in a normal reviewed workflow/tooling PR: before a gateway switch, require healthy liveness, exact successful uncached database readiness, and the read-only ticket journey for the selected immutable image. Reject unavailable, malformed, timed-out, or incomplete evidence without changing the active configuration.
3. Record a linked after-window with at least ${evidence.policy.recoveryThreshold} consecutive healthy composite probes, at least ${evidence.policy.intervalMs} ms between probe calls, and an explicitly selected exact digest. Every health, readiness, and journey check in that recovery window must pass.
4. Demonstrate prevention separately by repeating the reviewed negative configuration/admission case and confirming the strict gate refuses it without switching the active configuration. A healthy rollback window alone does not satisfy this criterion.
5. Repeat the bounded fault, policy-triggered configuration rollback, and healthy recovery proof in at least two separately recorded development-test runs. Retain each incident ID, exact digest, timestamps, thresholds, and healthy after-window; merely invoking rollback is not recovery proof.
6. Obtain operator review of the normal PR and digest-bound observations. Operator-approved development-test remediation and scripted actions never count as independent Human acceptance.

### Open questions

- root cause unconfirmed; hypotheses need evidence.
- Which configuration condition or admission gap explains the observations, and what evidence distinguishes it from other hypotheses?
- Is a focused configuration correction sufficient, or is a reviewed admission guard justified? Consider doing nothing beyond restoration if prevention is not supported by evidence.
- Which negative regression demonstrates prevention rather than availability recovery alone?

### Verification and follow-up

@${owner} is responsible for triage, evidence review, and follow-up. Link this incident and its evidence ID to the normal maintenance PR, record the exact after-image (explicitly distinguishing same-image configuration rollback from a new code version), and verify bounded healthy recovery windows. Track availability recovery, strict admission prevention, and repeated recovery proof separately; neither this draft nor an operations-only verification closes the maintenance work or changes approval state.
`;
}

/**
 * Validate separately captured evidence. A digest change requires recoveryImage
 * explicitly (for example, rollback); it does not establish preventive repair.
 * Invalid linkage throws; a valid but unhealthy/incomplete/short after-window
 * returns recovered:false with bounded reason codes. Neither input is modified.
 */
export function verifyRecovery(beforeValue, afterValue, {
  incidentId, beforeEvidenceId, recoveryImage, minimumSamples, minimumWindowMs,
} = {}) {
  const before = validateEvidence(beforeValue);
  const after = validateEvidence(afterValue);
  const incident = selectIncident(before, incidentId);
  if (beforeEvidenceId !== undefined && beforeEvidenceId !== before.id) throw new Error("Recovery evidence linkage does not match.");
  const expectedImage = exactImage(recoveryImage ?? before.image);
  if (after.image !== expectedImage) throw new Error("Recovery image digest does not match the explicitly selected image.");
  if (after.target.host !== before.target.host || after.target.port !== before.target.port) {
    throw new Error("Recovery target does not match the incident target.");
  }
  if (after.id === before.id || timestamp(after.startedAt) < timestamp(before.completedAt) ||
      timestamp(after.startedAt) <= timestamp(incident.lastFailureAt)) {
    throw new Error("Recovery window must follow the incident evidence window.");
  }
  const requiredSamples = integer(minimumSamples === undefined ? before.policy.recoveryThreshold : minimumSamples,
    before.policy.recoveryThreshold, 120, "minimumSamples");
  const requiredWindow = integer(minimumWindowMs === undefined ? (requiredSamples - 1) * before.policy.intervalMs : minimumWindowMs,
    (requiredSamples - 1) * before.policy.intervalMs, Number.MAX_SAFE_INTEGER, "minimumWindowMs");
  const reasons = [];
  if (!before.complete || !after.complete) reasons.push("incomplete-monitor");
  if (after.samples.length < requiredSamples) reasons.push("insufficient-recovery-samples");
  if (after.windowMs < requiredWindow ||
      after.samples.some((sample, index) => index > 0 &&
        timestamp(sample.startedAt) - timestamp(after.samples[index - 1].completedAt) < before.policy.intervalMs)) {
    reasons.push("recovery-window-too-short");
  }
  if (!after.samples.length || !after.samples.every((sample) => sample.ok && checks.every((name) => sample[name].ok))) {
    reasons.push("unhealthy-recovery-probes");
  }
  return {
    version: 1, kind: "brownfield-operations-recovery", executionMode: "development-test",
    recovered: reasons.length === 0, status: reasons.length ? "not-recovered" : "observed-recovery",
    beforeEvidenceId: before.id, afterEvidenceId: after.id, incidentId: incident.id,
    beforeImage: before.image, image: after.image, digest: after.digest,
    imageChanged: before.image !== after.image,
    startedAt: after.startedAt, completedAt: after.completedAt, windowMs: after.windowMs,
    samples: after.samples.length, requiredSamples, requiredWindowMs: requiredWindow, reasons,
    scope: "operations-only-observed-recovery",
    codeRepairVerified: false, preventiveActionCompleted: false, accepted: false, humanAcceptance: false,
    note,
  };
}
