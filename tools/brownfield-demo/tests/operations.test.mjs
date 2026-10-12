import test from "node:test";
import assert from "node:assert/strict";
import { monitorService, buildMaintenanceIntent, verifyRecovery } from "../operations.mjs";
import { image } from "./helpers.mjs";

const base = Date.parse("2026-09-28T00:00:00.000Z");
const url = "http://127.0.0.1:3100";
const options = { url, image, samples: 4, intervalMs: 10, failureThreshold: 2, recoveryThreshold: 2 };
const draftOptions = { repo: "example/demo", owner: "operator", evidenceReference: "https://github.com/example/demo/issues/42#issuecomment-123" };
const secret = "PRIVATE ticket@example.invalid /home/operator/private-token customer-ticket-description";

function result(at, state = true) {
  const value = { at: new Date(at).toISOString() };
  for (const name of ["health", "readiness", "journey"]) {
    const ok = typeof state === "boolean" ? state : state[name] ?? true;
    value[name] = { ok, status: ok ? 200 : 503, latencyMs: 3 };
    if (!ok) value[name].failure = "http-error";
  }
  value.ok = ["health", "readiness", "journey"].every((name) => value[name].ok);
  return value;
}

async function observe(states, overrides = {}, dependencies = {}) {
  let clock = overrides.start ?? base;
  let index = 0;
  const pauses = [];
  const urls = [];
  const evidence = await monitorService({
    ...options, samples: states.length,
    failureThreshold: Math.min(2, states.length), recoveryThreshold: Math.min(2, states.length),
    ...overrides,
  }, {
    now: () => clock,
    sleep: async (ms) => { pauses.push(ms); clock += ms; },
    probe: async (requested) => {
      urls.push(requested);
      return result(clock, states[index++]);
    },
    ...dependencies,
  });
  return { evidence, pauses, urls };
}

test("monitor requires an injected probe; bounds and exact images fail before any network work", async () => {
  await assert.rejects(monitorService(options), /injected probe/);
  for (const [key, values] of Object.entries({
    samples: [0, -1, 121, 1.5, "4", NaN, Infinity, null],
    intervalMs: [0, -1, 60001, 1.5, "10", NaN, Infinity, null],
    failureThreshold: [0, -1, 5, 1.5, "2", NaN, Infinity, null],
    recoveryThreshold: [0, -1, 5, 1.5, "2", NaN, Infinity, null],
    image: ["nginx:latest", image.replace("@", ":latest@"), image.toUpperCase(), `${image}\n`, "https://" + image],
  })) {
    for (const value of values) {
      await assert.rejects(monitorService({ ...options, [key]: value }, {
        probe: () => assert.fail("Invalid options must not invoke the probe."),
      }));
    }
  }
  await assert.rejects(monitorService(undefined), /options/);
  await assert.rejects(monitorService(options, { probe() {}, sleep: 123 }), /callable/);
  await assert.rejects(monitorService(options, { probe() {}, now: 123 }), /callable/);
  await assert.rejects(monitorService(options, { probe() {}, onIncident: 123 }), /callable/);
  await assert.rejects(monitorService(options, { probe() {}, onIncident: null }), /callable/);
});

test("only literal loopback HTTP origins are accepted; no paths, credentials, aliases or URL normalization tricks", async () => {
  for (const value of [
    "https://127.0.0.1:3100", "http://localhost:3100", "http://127.1:3100", "http://2130706433:3100",
    "http://[::1]:3100", "http://0.0.0.0:3100", "http://127.0.0.2:3100", "http://example.com",
    "http://user:secret@127.0.0.1", `${url}/tickets/private`, `${url}/../`, `${url}/%2e%2e`,
    `${url}?`, `${url}#`, `${url}?token=secret`, `${url}#private`, `${url}\\`, `${url}\n`,
    "http://127.0.0.1:0", "http://127.0.0.1:65536", "http://127.0.0.1:03100", "http://127.0.0.1:",
    "HTTP://127.0.0.1:3100", "http://127.0.0.1.evil.invalid", {}, null,
  ]) {
    await assert.rejects(monitorService({ ...options, url: value }, { probe: () => assert.fail("Rejected target was probed.") }));
  }
  for (const [value, port] of [["http://127.0.0.1/", 80], ["http://127.0.0.1:65535", 65535], [`${url}/`, 3100]]) {
    const { evidence, urls } = await observe([true], { url: value });
    assert.deepEqual(evidence.target, { host: "127.0.0.1", port });
    assert.equal(urls[0], new URL(value).origin);
    assert.equal(Object.hasOwn(evidence, "url"), false);
  }
});

test("healthy bounded monitoring sleeps only between samples and reports short-window evidence, not acceptance", async () => {
  const { evidence, pauses, urls } = await observe([true, true, true, true]);
  assert.deepEqual(pauses, [10, 10, 10]);
  assert.deepEqual(urls, [url, url, url, url]);
  assert.equal(evidence.windowMs, 30);
  assert.equal(evidence.status, "healthy");
  assert.equal(evidence.complete, true);
  assert.equal(evidence.allHealthy, true);
  assert.equal(evidence.executionMode, "development-test");
  assert.equal(evidence.accepted, false);
  assert.equal(evidence.humanAcceptance, false);
  assert.equal(evidence.preventiveActionCompleted, false);
  assert.equal(evidence.image, image);
  assert.equal(evidence.digest, image.split("@")[1]);
  assert.deepEqual(evidence.incidents, []);
  assert.deepEqual(evidence.availability, {
    scope: "short-window-observation-not-slo", healthySamples: 4, failedSamples: 0, totalSamples: 4, ratio: 1,
  });
  assert.match(evidence.id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(evidence.samples[3].sequence, 4);
  assert.match(evidence.note, /not an SLO/);
});

test("maximum sample and interval boundaries remain bounded and execute requested probes", async () => {
  const { evidence, pauses } = await observe(Array(120).fill(true), {
    samples: 120, intervalMs: 60000, failureThreshold: 120, recoveryThreshold: 120,
  });
  assert.equal(evidence.samples.length, 120);
  assert.equal(pauses.length, 119);
  assert.ok(pauses.every((pause) => pause === 60000));
  assert.equal(evidence.windowMs, 119 * 60000);
});

test("omitted options use the bounded defaults", async () => {
  let clock = base;
  const evidence = await monitorService({ url, image }, {
    now: () => clock, sleep: async (ms) => { clock += ms; }, probe: async () => result(clock),
  });
  assert.deepEqual(evidence.policy, { samples: 10, intervalMs: 200, failureThreshold: 2, recoveryThreshold: 3 });
  assert.equal(evidence.windowMs, 1800);
});

test("default sleep actually delays sampling", async () => {
  const evidence = await monitorService({ ...options, samples: 2, intervalMs: 10 }, {
    probe: async () => result(Date.now()),
  });
  assert.ok(Date.parse(evidence.samples[1].startedAt) - Date.parse(evidence.samples[0].completedAt) >= 10);
});

test("early timer wakes wait the actual remainder without advancing or rounding recorded timestamps", async () => {
  let clock = base;
  let probes = 0;
  const waits = [];
  const evidence = await monitorService({ ...options, samples: 3, intervalMs: 200 }, {
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms === 200 ? 199 : ms;
      assert.equal(probes, waits.length <= 2 ? 1 : 2);
    },
    probe: async () => { probes++; return result(clock); },
  });
  assert.deepEqual(waits, [200, 1, 200, 1]);
  assert.equal(probes, 3);
  assert.deepEqual(evidence.samples.map((sample) => sample.startedAt),
    [base, base + 200, base + 400].map((at) => new Date(at).toISOString()));
  assert.deepEqual(evidence.samples.map((sample) => sample.at), evidence.samples.map((sample) => sample.startedAt));
  assert.equal(evidence.windowMs, 400);
  assert.equal(evidence.complete, true);
});

test("late timer wakes retain their measured timestamps rather than the requested deadline", async () => {
  let clock = base;
  const waits = [];
  const evidence = await monitorService({ ...options, samples: 2, intervalMs: 200 }, {
    now: () => clock,
    sleep: async (ms) => { waits.push(ms); clock += 203; },
    probe: async () => result(clock),
  });
  assert.deepEqual(waits, [200]);
  assert.equal(evidence.samples[1].startedAt, new Date(base + 203).toISOString());
  assert.equal(evidence.windowMs, 203);
});

test("stalled clocks exhaust a finite wait budget without making another probe or claiming completion", async () => {
  let waits = 0;
  let probes = 0;
  await assert.rejects(monitorService({ ...options, samples: 2, intervalMs: 200 }, {
    now: () => base,
    sleep: async () => { waits++; },
    probe: async () => { probes++; return result(base); },
  }), (error) => {
    assert.equal(error.reason, "clock-error");
    assert.equal(error.evidence.complete, false);
    assert.equal(error.evidence.samples.length, 1);
    assert.equal(error.evidence.samples[0].at, new Date(base).toISOString());
    assert.equal(error.evidence.windowMs, 0);
    assert.equal(probes, 1);
    assert.equal(waits, 8);
    return true;
  });
});

test("backwards clocks and rejected remainder sleeps still abort with redacted partial evidence", async () => {
  for (const failure of ["backwards", "sleep"]) {
    let clock = base;
    let waits = 0;
    await assert.rejects(monitorService({ ...options, samples: 2, intervalMs: 200 }, {
      now: () => clock,
      sleep: async () => {
        if (++waits === 1) clock += 199;
        else if (failure === "backwards") clock--;
        else throw new Error(secret);
      },
      probe: async () => result(clock),
    }), (error) => {
      assert.equal(error.reason, failure === "backwards" ? "clock-error" : "sleep-error");
      assert.equal(error.evidence.complete, false);
      assert.equal(error.evidence.samples.length, 1);
      assert.ok(!JSON.stringify(error).includes(secret));
      assert.equal(waits, 2);
      return true;
    });
  }
});

test("an incident opens at consecutive failure threshold and resolves only at consecutive recovery threshold", async () => {
  const { evidence } = await observe([true, false, false, false, true, true]);
  assert.equal(evidence.status, "recovered");
  assert.equal(evidence.allHealthy, false);
  assert.equal(evidence.incidents.length, 1);
  const incident = evidence.incidents[0];
  assert.equal(incident.status, "resolved");
  assert.equal(incident.firstFailureAt, new Date(base + 10).toISOString());
  assert.equal(incident.openedAt, new Date(base + 20).toISOString());
  assert.equal(incident.recoveryStartedAt, new Date(base + 40).toISOString());
  assert.equal(incident.resolvedAt, new Date(base + 50).toISOString());
  assert.equal(incident.detectionMs, 10);
  assert.equal(incident.recoveryMs, 30);
  assert.equal(incident.observedImpactMs, 40);
  assert.equal(incident.failedSamples, 3);
  assert.equal(evidence.availability.ratio, 0.5);
  assert.equal(incident.symptoms.length, 3);
  assert.ok(incident.symptoms.every((symptom) => symptom.samples === 3));
});

test("flapping resets counters, suppresses duplicate open incidents, and allows a new incident after resolution", async () => {
  const { evidence } = await observe([false, false, false, true, false, true, true, false, false, true, true]);
  assert.equal(evidence.incidents.length, 2);
  assert.notEqual(evidence.incidents[0].id, evidence.incidents[1].id);
  assert.equal(evidence.incidents[0].failedSamples, 4);
  assert.equal(evidence.incidents[0].resolvedAt, new Date(base + 60).toISOString());
  assert.equal(evidence.incidents[0].recoveryMs, 50);
  assert.equal(evidence.incidents[1].failedSamples, 2);
  assert.equal(evidence.incidents[1].resolvedAt, new Date(base + 100).toISOString());
  const intermittent = (await observe([false, true, false, true, false])).evidence;
  assert.equal(intermittent.incidents.length, 0);
  assert.equal(intermittent.status, "degraded");
  assert.equal(intermittent.allHealthy, false);
});

test("awaited incident policy fires at threshold, links the exact digest, and leaves recovery to subsequent probes", async () => {
  let clock = base;
  let calls = 0;
  let rolledBack = false;
  const events = [];
  const evidence = await monitorService({ ...options, samples: 10, intervalMs: 200 }, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    probe: async () => {
      calls++;
      return result(clock, calls < 3 || rolledBack);
    },
    onIncident: async (incident) => {
      assert.equal(calls, 4);
      assert.equal(incident.status, "open");
      assert.equal(incident.resolvedAt, null);
      assert.equal(incident.failedSamples, 2);
      assert.equal(incident.firstFailureAt, new Date(base + 400).toISOString());
      assert.equal(incident.openedAt, new Date(base + 600).toISOString());
      assert.equal(incident.monitorStartedAt, new Date(base).toISOString());
      assert.equal(incident.image, image);
      assert.equal(incident.digest, image.split("@")[1]);
      assert.equal(incident.executionMode, "development-test");
      events.push(incident.id);
      await new Promise((done) => setImmediate(done));
      clock += 35;
      rolledBack = true;
      incident.url = `${url}/private/${secret}`;
      incident.symptoms[0].failure = secret;
      incident.resolvedAt = "invented-recovery";
      return { repaired: true, url: secret, body: secret };
    },
  });
  assert.equal(calls, 10);
  assert.deepEqual(events, [evidence.incidents[0].id]);
  assert.equal(evidence.incidents[0].status, "resolved");
  assert.equal(evidence.incidents[0].resolvedAt, new Date(base + 1035).toISOString());
  assert.equal(evidence.incidents[0].detectionMs, 200);
  assert.equal(evidence.incidents[0].recoveryMs, 435);
  assert.equal(evidence.image, image);
  assert.equal(evidence.preventiveActionCompleted, false);
  assert.equal(evidence.accepted, false);
  assert.equal(evidence.humanAcceptance, false);
  assert.ok(!JSON.stringify(evidence).includes(secret));
  assert.ok(!JSON.stringify(evidence).includes("invented-recovery"));
  assert.equal(Object.hasOwn(evidence, "url"), false);
});

test("incident callback is suppressed throughout flapping and invoked only for separately opened incidents", async () => {
  const events = [];
  const { evidence } = await observe(
    [false, false, false, true, false, true, true, false, false, true, true], {},
    { onIncident: async (incident) => { events.push(incident.id); } },
  );
  assert.deepEqual(events, evidence.incidents.map((incident) => incident.id));
  assert.equal(events.length, 2);
  await observe([false, true, false, true], {}, { onIncident: () => assert.fail("No consecutive failure threshold was reached.") });
});

test("successful incident-policy invocation is not itself recovery or prevention", async () => {
  let calls = 0;
  const { evidence } = await observe([false, false, false, false], {}, {
    onIncident: async () => { calls++; return { repaired: true, accepted: true }; },
  });
  assert.equal(calls, 1);
  assert.equal(evidence.status, "incident-open");
  assert.equal(evidence.incidents[0].resolvedAt, null);
  assert.equal(evidence.incidents[0].recoveryMs, null);
  assert.equal(evidence.preventiveActionCompleted, false);
  assert.equal(evidence.accepted, false);
});

test("incident callback failures abort with sanitized partial evidence and an explicitly unresolved incident", async () => {
  for (const onIncident of [
    () => { throw new Error(secret); },
    async () => { throw new Error(secret); },
  ]) {
    await assert.rejects(observe([false, false, true, true], {}, { onIncident }), (error) => {
      assert.equal(error.reason, "incident-action-error");
      assert.equal(error.evidence.status, "monitor-error");
      assert.equal(error.evidence.complete, false);
      assert.equal(error.evidence.samples.length, 2);
      assert.equal(error.evidence.incidents[0].status, "open");
      assert.equal(error.evidence.incidents[0].resolvedAt, null);
      assert.equal(error.evidence.accepted, false);
      assert.ok(!JSON.stringify(error).includes(secret));
      assert.ok(!error.stack.includes(secret));
      assert.match(buildMaintenanceIntent(error.evidence, draftOptions), /incomplete \(incident-action-error\)/);
      return true;
    });
  }
});

test("all unhealthy probes leave one explicit open incident and zero availability", async () => {
  const { evidence } = await observe([false, false, false, false]);
  assert.equal(evidence.status, "incident-open");
  assert.equal(evidence.allHealthy, false);
  assert.equal(evidence.availability.ratio, 0);
  assert.equal(evidence.incidents.length, 1);
  assert.deepEqual(
    [evidence.incidents[0].status, evidence.incidents[0].resolvedAt, evidence.incidents[0].recoveryMs],
    ["open", null, null],
  );
  assert.equal(evidence.incidents[0].failedSamples, 4);
  assert.equal(evidence.incidents[0].observedImpactMs, 30);
});

test("a single final success cannot resolve an incident requiring multiple successful probes", async () => {
  const { evidence } = await observe([false, false, true, false, true]);
  assert.equal(evidence.status, "incident-open");
  assert.equal(evidence.incidents[0].resolvedAt, null);
  assert.equal(evidence.incidents[0].recoveryStartedAt, null);
});

test("failures can alternate between endpoint checks but only all three successful checks count as recovery", async () => {
  const { evidence } = await observe([{ health: false }, { readiness: false }, { journey: false }, true, true]);
  assert.equal(evidence.incidents.length, 1);
  assert.equal(evidence.incidents[0].failedSamples, 3);
  assert.equal(evidence.status, "recovered");
  assert.deepEqual(evidence.incidents[0].symptoms.map((symptom) => symptom.check), ["health", "readiness", "journey"]);
});

test("threshold one permits immediate detection/recovery and measures zero detection delay", async () => {
  const { evidence } = await observe([false, true, false], { failureThreshold: 1, recoveryThreshold: 1 });
  assert.equal(evidence.incidents.length, 2);
  assert.equal(evidence.incidents[0].detectionMs, 0);
  assert.equal(evidence.incidents[0].recoveryMs, 10);
  assert.equal(evidence.incidents[1].status, "open");
});

test("latency, HTTP status and timestamp values are retained only after validation; extra fields and arbitrary failures are redacted", async () => {
  let clock = base;
  const evidence = await monitorService({ ...options, samples: 2 }, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    probe: async () => {
      const raw = result(clock, false);
      raw.body = secret;
      raw.url = `${url}/private/tickets?token=secret`;
      raw.exception = secret;
      for (const name of ["health", "readiness", "journey"]) {
        raw[name].failure = secret;
        raw[name].body = secret;
        raw[name].exception = secret;
        raw[name].headers = { authorization: secret };
        raw[name].status = null;
        raw[name].latencyMs = 7.5;
      }
      clock += 9;
      return raw;
    },
  });
  const serialized = JSON.stringify(evidence);
  assert.ok(!serialized.includes(secret));
  assert.doesNotMatch(serialized, /private\/tickets|exception|authorization/);
  assert.equal(evidence.samples[0].health.failure, "probe-failed");
  assert.equal(evidence.samples[0].health.status, null);
  assert.equal(evidence.samples[0].health.latencyMs, 7.5);
  assert.equal(evidence.windowMs, 28);
  assert.equal(evidence.incidents[0].detectionMs, 19);
});

test("the real probe adapter's bounded failure vocabulary is retained without general exception text", async () => {
  let clock = base;
  const evidence = await monitorService({ ...options, samples: 2 }, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    probe: async () => ({
      at: clock, ok: false,
      health: { ok: false, status: null, latencyMs: 3, failure: "transport" },
      readiness: { ok: false, status: 503, latencyMs: 3, failure: "unavailable" },
      journey: { ok: false, status: null, latencyMs: 0, failure: "not-ready" },
    }),
  });
  assert.deepEqual(evidence.incidents[0].symptoms.map((symptom) => symptom.failure), ["transport", "unavailable", "not-ready"]);
});

test("malformed/nonfinite probe values are rejected without persisting unsafe values or exception text", async () => {
  for (const mutate of [
    (raw) => { raw.ok = "true"; },
    (raw) => { raw.ok = false; },
    (raw) => { delete raw.health; },
    (raw) => { raw.health = []; },
    (raw) => { raw.health.ok = 1; },
    (raw) => { raw.health.status = "200"; },
    (raw) => { raw.health.status = 99; },
    (raw) => { raw.health.status = 600; },
    (raw) => { raw.health.status = 200.5; },
    (raw) => { raw.health.status = 500; },
    (raw) => { raw.health.status = null; },
    (raw) => { raw.health.status = Infinity; },
    (raw) => { raw.health.latencyMs = NaN; },
    (raw) => { raw.health.latencyMs = Infinity; },
    (raw) => { raw.health.latencyMs = -1; },
    (raw) => { raw.health.latencyMs = "3"; },
    (raw) => { raw.health.latencyMs = Number.MAX_VALUE; },
    (raw) => { raw.health.failure = secret; },
    (raw) => { raw.health.failure = { message: secret }; },
    (raw) => { raw.at = secret; },
    (raw) => { raw.at = NaN; },
    (raw) => { raw.at = Infinity; },
    (raw) => { raw.at = base - 1; },
    (raw) => { raw.at = base + 1; },
    (raw) => { raw.at = "2026-02-30T00:00:00.000Z"; },
  ]) {
    const raw = result(base);
    mutate(raw);
    await assert.rejects(monitorService(options, { now: () => base, probe: async () => raw }), (error) => {
      assert.equal(error.reason, "invalid-probe");
      assert.equal(error.evidence.status, "monitor-error");
      assert.equal(error.evidence.complete, false);
      assert.equal(error.evidence.allHealthy, false);
      assert.equal(error.evidence.availability.ratio, null);
      assert.equal(error.evidence.samples.length, 0);
      assert.ok(!JSON.stringify(error).includes(secret));
      assert.ok(!error.message.includes(secret));
      return true;
    });
  }
  for (const raw of [null, [], undefined]) {
    await assert.rejects(monitorService(options, { now: () => base, probe: async () => raw }), /invalid-probe/);
  }
});

test("thrown probe errors fail closed and retain only valid partial evidence, including any unresolved incident", async () => {
  let clock = base;
  let calls = 0;
  await assert.rejects(monitorService(options, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    probe: async () => {
      if (++calls === 3) throw new Error(secret);
      return result(clock, false);
    },
  }), (error) => {
    assert.equal(error.code, "OPERATIONS_MONITOR_FAILED");
    assert.equal(error.reason, "probe-error");
    assert.equal(error.evidence.samples.length, 2);
    assert.equal(error.evidence.status, "monitor-error");
    assert.equal(error.evidence.incidents[0].status, "open");
    assert.equal(error.evidence.incidents[0].resolvedAt, null);
    assert.equal(error.evidence.complete, false);
    assert.ok(!JSON.stringify(error).includes(secret));
    assert.ok(!error.stack.includes(secret));
    assert.equal(Object.hasOwn(error, "cause"), false);
    return true;
  });
});

test("sleep and clock errors are sanitized, including backwards time and a sleep that fails to advance time", async () => {
  for (const dependencies of [
    { now: () => base, sleep: async () => { throw new Error(secret); } },
    { now: () => base, sleep: async () => {} },
    { now: () => { throw new Error(secret); } },
    { now: () => NaN },
    { now: () => Infinity },
    { now: () => -1 },
    { now: (() => { let count = 0; return () => count++ ? base - 1 : base; })() },
  ]) {
    await assert.rejects(monitorService(options, { probe: async () => result(base), ...dependencies }), (error) => {
      assert.match(error.reason, /sleep-error|clock-error/);
      assert.ok(!JSON.stringify(error).includes(secret));
      if (error.evidence) {
        assert.equal(error.evidence.complete, false);
        assert.equal(error.evidence.allHealthy, false);
      }
      return true;
    });
  }
});

test("ordinary maintenance draft preserves measured impact and ownership without delivery lifecycle metadata", async () => {
  const { evidence } = await observe([false, false, true, true]);
  const body = buildMaintenanceIntent(evidence, draftOptions);
  assert.match(body, /operator-approved development-test remediation, not independent Human acceptance/);
  assert.doesNotMatch(body, /^Delivery (?:Demo|Execution):|brownfield-human-gated-delivery:intent/m);
  for (const heading of ["Problem or opportunity", "Proposed outcome", "Affected users and systems", "Constraints and non-goals", "Open questions"]) {
    assert.ok(body.includes(`### ${heading}\n`));
  }
  assert.ok(body.includes(image));
  assert.ok(body.includes(evidence.digest));
  assert.ok(body.includes(evidence.id));
  assert.ok(body.includes(evidence.incidents[0].id));
  assert.ok(body.includes(draftOptions.evidenceReference));
  assert.match(body, /Responsible owner: @operator/);
  assert.match(body, /2 failing composite probe sample\(s\)/);
  assert.match(body, /Detection: 10 ms/);
  assert.match(body, /20 ms after detection/);
  assert.match(body, /root cause unconfirmed; hypotheses need evidence/);
  assert.match(body, /normal reviewed workflow\/tooling PR/);
  assert.match(body, /Production application source remains unchanged/);
  assert.match(body, /strict, fail-closed readiness admission gate/);
  assert.match(body, /at least two separately recorded development-test runs/);
  assert.match(body, /same-image configuration rollback from a new code version/);
  assert.match(body, /healthy rollback window alone does not satisfy/);
  assert.match(body, /Preventive action is not yet verified/);
  assert.match(body, /not a measurement of continuous downtime/);
  assert.doesNotMatch(body, /\/sdlc approve|\/sdlc accept|new linked maintenance Intent/);
});

test("maintenance draft reports an open incident explicitly and ignores untrusted extra evidence fields", async () => {
  const { evidence } = await observe([false, false]);
  evidence.body = secret;
  evidence.incidents[0].exception = secret;
  const body = buildMaintenanceIntent(evidence, draftOptions);
  assert.match(body, /not observed; incident remains open/);
  assert.match(body, /observation cutoff, not resolution/);
  assert.ok(!body.includes(secret));
});

test("maintenance draft rejects forged evidence, missing/ambiguous incident, unsafe references and metadata", async () => {
  const { evidence } = await observe([false, false]);
  for (const changed of [
    { samples: [] }, { id: "forged" }, { image: image.replace("b", "c") }, { executionMode: "live" },
    { accepted: true }, { policy: {} }, { monitorError: "secret" },
  ]) assert.throws(() => buildMaintenanceIntent({ ...evidence, ...changed }, draftOptions), /evidence/);
  assert.throws(() => buildMaintenanceIntent(evidence, { ...draftOptions, incidentId: "not-this-incident" }), /incident/);
  assert.throws(() => buildMaintenanceIntent(evidence, { ...draftOptions, owner: `operator\n${secret}` }), /login/);
  assert.throws(() => buildMaintenanceIntent(evidence, { ...draftOptions, repo: "https://github.com/example/demo" }), /repo/);
  for (const reference of [
    undefined, secret, `${evidence.id}\n`, "operations/evidence.json", "https://example.com/private",
    "https://github.com/other/repo/issues/42", "https://github.com/example/demo/issues/42?token=private",
    "https://github.com/user:secret@example/demo/issues/42", "https://github.com/example/demo/issues/42#private",
    "https://github.com/example/demo/blob/main/private/tickets.json",
    "https://github.com/example/demo/issues/42\nDelivery Execution: live",
    "https://github.com/example/demo/../demo/issues/42", `${draftOptions.evidenceReference}?`,
  ]) assert.throws(() => buildMaintenanceIntent(evidence, { ...draftOptions, evidenceReference: reference }), /reference/);
  for (const reference of [
    evidence.id, "https://github.com/example/demo/actions/runs/123",
    "https://github.com/example/demo/actions/runs/123/attempts/2", "https://github.com/example/demo/pull/3",
  ]) assert.ok(buildMaintenanceIntent(evidence, { ...draftOptions, evidenceReference: reference }).includes(reference));
  const healthy = (await observe([true, true])).evidence;
  assert.throws(() => buildMaintenanceIntent(healthy, draftOptions), /incident/);
  const multiple = (await observe([false, true, false], { failureThreshold: 1, recoveryThreshold: 1 })).evidence;
  assert.throws(() => buildMaintenanceIntent(multiple, draftOptions), /incident/);
  assert.ok(buildMaintenanceIntent(multiple, { ...draftOptions, incidentId: multiple.incidents[1].id }).includes(multiple.incidents[1].id));
});

test("recovery verifies a later all-healthy window with incident, target and digest linkage, not repair or acceptance", async () => {
  const before = (await observe([false, false])).evidence;
  const after = (await observe([true, true, true], { start: base + 100 })).evidence;
  const recovery = verifyRecovery(before, after, { beforeEvidenceId: before.id, incidentId: before.incidents[0].id });
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.status, "observed-recovery");
  assert.equal(recovery.beforeEvidenceId, before.id);
  assert.equal(recovery.afterEvidenceId, after.id);
  assert.equal(recovery.incidentId, before.incidents[0].id);
  assert.equal(recovery.digest, before.digest);
  assert.equal(recovery.scope, "operations-only-observed-recovery");
  assert.equal(recovery.codeRepairVerified, false);
  assert.equal(recovery.preventiveActionCompleted, false);
  assert.equal(recovery.humanAcceptance, false);
  assert.equal(recovery.accepted, false);
  assert.equal(before.incidents[0].status, "open");
  assert.deepEqual(recovery.reasons, []);
});

test("parent integration contract: ten samples, threshold callback, ordinary draft, and five-sample same-image recovery", async () => {
  let clock = base;
  let calls = 0;
  let active = "candidate";
  let callbackCalls = 0;
  const dependencies = {
    now: () => clock, sleep: async (ms) => { clock += ms; },
    probe: async () => result(clock, ++calls < 3 || active === "stable"),
    onIncident: async (incident) => {
      callbackCalls++;
      assert.equal(calls, 4);
      assert.equal(incident.digest, image.split("@")[1]);
      active = "stable";
    },
  };
  const before = await monitorService({
    url, image, samples: 10, intervalMs: 200, failureThreshold: 2, recoveryThreshold: 3,
  }, dependencies);
  assert.equal(callbackCalls, 1);
  assert.equal(before.samples.length, 10);
  assert.equal(before.incidents.length, 1);
  assert.equal(before.incidents[0].status, "resolved");
  assert.equal(before.incidents[0].resolvedAt, before.samples[6].at);
  assert.equal(before.incidents[0].recoveryMs, 600);
  const body = buildMaintenanceIntent(before, draftOptions);
  assert.ok(body.includes(before.id));
  assert.ok(body.includes(before.digest));
  assert.doesNotMatch(body, /^Delivery (?:Demo|Execution):/m);
  clock += 200;
  const after = await monitorService({ url, image, samples: 5 }, {
    now: dependencies.now, sleep: dependencies.sleep, probe: async () => result(clock),
  });
  const recovery = verifyRecovery(before, after);
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.samples, 5);
  assert.equal(recovery.imageChanged, false);
  assert.equal(recovery.preventiveActionCompleted, false);
  assert.equal(recovery.humanAcceptance, false);
  assert.equal(recovery.beforeEvidenceId, before.id);
  assert.equal(recovery.afterEvidenceId, after.id);
});

test("recovery refuses unhealthy, intermittent, too-short or insufficiently sampled recovery windows", async () => {
  const before = (await observe([false, false, false], { recoveryThreshold: 3 })).evidence;
  for (const states of [[false, false, false], [true, false, true], [{ readiness: false }, true, true]]) {
    const after = (await observe(states, { start: base + 100 })).evidence;
    const recovery = verifyRecovery(before, after);
    assert.equal(recovery.recovered, false);
    assert.equal(recovery.status, "not-recovered");
    assert.ok(recovery.reasons.includes("unhealthy-recovery-probes"));
  }
  const insufficient = (await observe([true, true], { start: base + 100 })).evidence;
  assert.ok(verifyRecovery(before, insufficient).reasons.includes("insufficient-recovery-samples"));
  const short = (await observe([true, true, true], { start: base + 100, intervalMs: 1 })).evidence;
  assert.ok(verifyRecovery(before, short).reasons.includes("recovery-window-too-short"));
  const healthy = (await observe([true, true, true], { start: base + 100 })).evidence;
  assert.equal(verifyRecovery(before, healthy, { minimumWindowMs: 100 }).recovered, false);
  assert.throws(() => verifyRecovery(before, healthy, { minimumSamples: 2 }), /minimumSamples/);
  assert.throws(() => verifyRecovery(before, healthy, { minimumWindowMs: 19 }), /minimumWindowMs/);
  assert.throws(() => verifyRecovery(before, healthy, { minimumSamples: 121 }), /minimumSamples/);
  assert.throws(() => verifyRecovery(before, healthy, { minimumSamples: null }), /minimumSamples/);
  assert.throws(() => verifyRecovery(before, healthy, { minimumWindowMs: null }), /minimumWindowMs/);
});

test("recovery validates explicit changed digest for rollback and still does not claim a code fix", async () => {
  const before = (await observe([false, false])).evidence;
  const rollbackImage = image.replace(/@sha256:.+$/, `@sha256:${"a".repeat(64)}`);
  const after = (await observe([true, true], { start: base + 100, image: rollbackImage })).evidence;
  assert.throws(() => verifyRecovery(before, after), /digest/);
  assert.throws(() => verifyRecovery(before, after, { recoveryImage: "nginx:latest" }), /exact/);
  const recovery = verifyRecovery(before, after, { recoveryImage: rollbackImage });
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.imageChanged, true);
  assert.equal(recovery.beforeImage, image);
  assert.equal(recovery.image, rollbackImage);
  assert.equal(recovery.codeRepairVerified, false);
  assert.equal(recovery.preventiveActionCompleted, false);
});

test("recovery rejects replay, overlap, wrong target, forged observations and unrelated incident linkage", async () => {
  const before = (await observe([false, false])).evidence;
  const after = (await observe([true, true], { start: base + 100 })).evidence;
  assert.throws(() => verifyRecovery(before, before), /window/);
  const earlier = (await observe([true, true], { start: base - 100 })).evidence;
  const overlap = (await observe([true, true], { start: base + 5 })).evidence;
  const other = (await observe([true, true], { start: base + 100, url: "http://127.0.0.1:3101" })).evidence;
  assert.throws(() => verifyRecovery(before, earlier), /window/);
  assert.throws(() => verifyRecovery(before, overlap), /window/);
  assert.throws(() => verifyRecovery(before, other), /target/);
  assert.throws(() => verifyRecovery(before, after, { beforeEvidenceId: "unrelated" }), /linkage/);
  assert.throws(() => verifyRecovery(before, after, { incidentId: "unrelated" }), /incident/);
  const forged = structuredClone(after);
  forged.samples[0].health.latencyMs = Infinity;
  assert.throws(() => verifyRecovery(before, forged), /evidence/);
  const changed = structuredClone(after);
  changed.samples[0].health.status = 201;
  assert.throws(() => verifyRecovery(before, changed), /evidence/);
});

test("recovery recomputes summaries instead of trusting claimed health, incident status or availability", async () => {
  const before = (await observe([false, false])).evidence;
  const after = (await observe([false, true, true], { start: base + 100 })).evidence;
  after.allHealthy = true;
  after.availability.ratio = 1;
  after.incidents = [];
  after.body = secret;
  const recovery = verifyRecovery(before, after);
  assert.equal(recovery.recovered, false);
  assert.ok(!JSON.stringify(recovery).includes(secret));
});

test("incomplete monitoring cannot become successful recovery even when every retained sample is healthy", async () => {
  const before = (await observe([false, false])).evidence;
  let clock = base + 100;
  let calls = 0;
  let partial;
  try {
    await monitorService(options, {
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      probe: async () => {
        if (++calls === 3) throw new Error(secret);
        return result(clock);
      },
    });
    assert.fail("Monitoring must reject.");
  } catch (error) { partial = error.evidence; }
  const recovery = verifyRecovery(before, partial);
  assert.equal(recovery.recovered, false);
  assert.ok(recovery.reasons.includes("incomplete-monitor"));
});
