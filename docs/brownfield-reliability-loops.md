# Three Small Reliability Loops

This is the starting point for the Build/Verify/Deploy/Operate follow-up.
Read the [research and baseline coverage](ai-native-sdlc-delivery-operations-research.md)
for the problems being addressed, and the
[preceding discovery-to-maintenance rehearsal](brownfield-discovery-maintenance-rehearsal.md)
for the accepted readiness implementation.

For measured results, failures and recovery, read the
[actual reliability rehearsal](brownfield-reliability-rehearsal.md).

These are **development-test exercises**, not production readiness, independent
Human acceptance, or new approvals of old lifecycle artifacts. The source
application deliberately remains ownership-free and readiness-free.

## 1. What the three loops demonstrate

| Loop | Trigger | Measured decision | Closure |
|---|---|---|---|
| Trustworthy verification | Deliberate behavioral defects in a scratch copy; an unusable database configuration in a fresh container | Existing tests must detect each selected defect through assertions; actual HTTP probes must distinguish readiness from liveness | Original and restored controls pass; every chosen mutant is caught; real image contracts pass |
| Safe release and recovery | A bad configuration requests admission, then an admitted process is deliberately paused | Health, exact readiness and ticket reads gate promotion; repeated failures trigger a preauthorized fallback whose health is rechecked | Real gateway responses identify the fallback; complete schema/row hashes preserve controlled writes |
| Operational feedback | Consecutive unhealthy samples at the traffic entry point | Open one incident rather than one per failed probe; require a sustained healthy window after action | Sanitized evidence and an owned maintenance draft, followed by explicit review and preventive verification |

The release exercise uses **one immutable application image** and different
configuration/process instances. It is not a cross-version code rollout.
All normal instances share a newly created SQLite volume; only controlled
fixture writes occur. The gateway rejects write methods and exposes only a
small set of read routes on loopback. This does not demonstrate general
multi-instance write safety, replication, schema rollback or backup restoration.

The operations monitor and fallback are deterministic, bounded automation.
They do not call an LLM or fabricate a root cause. AI/operator analysis can use
the evidence to propose a maintenance task, but publication and approval remain
separate actions. Recovery of availability does not by itself complete
preventive maintenance.

## 2. Prerequisites and safety

- Node.js 24+, Git and working Docker.
- For test qualification, a local checkout of the completed discovery demo
  with its application dependencies installed, or permission to restore them
  in the isolated experiment as described by the qualification command.
- Read access to the selected GHCR digest. Authenticate with your usual
  credential flow if it is private; never place a token in these commands.
- New evidence directories whose parent already exists, outside the source.
- The accepted image below has the known four-ticket fixture dataset and
  readiness contract. An unrelated application image must fail these checks.

The toolkit:

- Never resets a source checkout or edits frozen tests.
- Never posts an Issue, creates an approval, commits, or pushes.
- Creates uniquely labelled containers and a new labelled volume.
- Gives the invalid-path instance **no data volume**.
- Publishes container ports only on `127.0.0.1`, with allocated free ports.
- Checks resource identity, labels, image and mounts before mutation/cleanup.
- Removes only resources created for that run, including on failure.
- Preserves a failed evidence report; cleanup errors are errors, not success.
- Records probe contracts, statuses, timings and data hashes, not HTTP bodies,
  application logs, ticket fields or exception messages.

Existing instances on ports 43127, 43128 and 43129 and their volumes are outside
the exercise. Do not stop or attach them to a fault drill.

## 3. Start here: qualify the tests

Run from the source repository. Adapt the checkout and evidence paths to your
machine. The pinned commit is the delivered readiness implementation, not a
mutable branch name.

```sh
mkdir -p "$HOME/brownfield-reliability-evidence"

node tools/brownfield-demo/cli.mjs qualify \
  --source /absolute/path/to/ai-native-sdlc-discovery-demo \
  --source-ref d361ce032b0f729f62b165c23c4f79bb56f29b92 \
  --dest "$HOME/brownfield-reliability-evidence/qualification-1"
```

Read `qualification-report.json`. Raw test diagnostics are kept separately in
the private scratch evidence and should not be published without review.
A command failure is not a successful mutant kill.
The original and restored suites must pass, no required tests may be skipped,
and mutants must fail their named contract assertions without run/hook/import
errors. One explicit exception is the frozen-error mutant: it must produce the
precise expected application TypeError in both known test bodies. The report
identifies those as expected application errors, not assertion failures.
No approved test content may change. The mutations are a small, declared
readiness set, **not a project-wide mutation score**.

Use a new destination for another attempt. Do not overwrite a failed attempt.
The qualification report is an experiment, not a lifecycle Tests-stage or
Implementation-stage approval.

## 4. Run real image verification, admission, recovery and monitoring

```sh
node tools/brownfield-demo/cli.mjs rehearse \
  --image ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:1fab5706994daec051dbd183ea42a23ab0e74e2caeefeef1e48454fe17aaa5bb \
  --qualification "$HOME/brownfield-reliability-evidence/qualification-1/qualification-report.json" \
  --repo huangyingting/ai-native-sdlc-discovery-demo \
  --owner YOUR_GITHUB_LOGIN \
  --dest "$HOME/brownfield-reliability-evidence/runtime-1"
```

This finite command performs actual Docker/HTTP/SQLite operations:

1. Pull and inspect the exact published digest. Require a passing qualification
   report and match its application Git tree to the image's OCI source revision.
   This is source-metadata consistency, not signed build-provenance attestation.
2. Start a good instance on fresh data; verify health, readiness, a filtered
   ticket queue and its detail page, plus the known seed dataset.
3. Start an invalid-path instance without a volume. Require health 200 and
   exact readiness 503/no-store/unavailable.
4. Admit the stable instance through the local read-only gateway.
5. Reject the bad instance and prove gateway traffic still reaches stable.
6. Start and admit a correctly configured candidate using the same image and
   isolated volume; prove actual responses identify the candidate.
7. Write a controlled fixture change after promotion, and hash all rows/schema.
8. Collect ten samples at 200 ms intervals between completed probes. Pause the
   candidate before sample three. Two consecutive failures trigger fallback.
9. Recheck the stable instance before switching. Require three consecutive
   healthy observations and verify the complete data hash is unchanged.
10. Unpause the disposable candidate; collect a separate five-sample healthy
    recovery window; reject the bad configuration again.
11. Write evidence and a maintenance draft, close the gateway and remove only
    the fresh lab resources.

Probe execution time is additional to the interval, especially during timeouts.
The measured short-window availability and recovery time are not SLO compliance,
production MTTR, or a claim of zero-downtime recovery.

The durable outputs are `evidence.json` and `maintenance-intent.md`.
Success requires `status: "passed"` and successful cleanup. An open incident,
failed recovery window, unexpected data change, admitted bad candidate or
failed cleanup must not be described as a completed exercise.

## 5. Review the operational maintenance handoff

Inspect the generated draft and evidence together:

1. Separate observations from hypotheses. Pausing a process is the deliberately
   injected cause here; do not generalize that diagnosis to a real incident.
2. Confirm the digest, affected read journey, measured detection/recovery
   window, owner and proposed preventive acceptance criteria.
3. Review the actual evidence before publishing a normal maintenance Issue.
   It must not impersonate a sealed delivery-stage Issue or contain automatic
   lifecycle approval commands.
4. Approve the specific preventive scope through your normal review process.
   Link the implementation PR and its actual checks.
5. Rerun the relevant negative admission and recovery checks against the
   reviewed tooling revision. Record results before closing the maintenance
   task. Keep unresolved causes or broader prevention explicitly open.

Publishing the draft alone does not complete this loop. Neither a template nor
an AI summary is evidence that the preventive change was approved or effective.

## 6. CI and published-image verification

After synchronizing these changes to a completed readiness demo, its
**Brownfield Reliability Loops** workflow can execute both commands on demand.
Select its main branch and provide the exact accepted image reference.
It qualifies the checked-out application's committed tests before running any
fault and uploads only the qualification summary, sanitized runtime evidence
and unapproved maintenance draft. It has no Issue/contents write permission.
The ownership-free source deliberately cannot pass readiness qualification.

Application container CI now resolves its built image to its immutable local
image ID. Post-merge delivery verification uses the published GHCR digest.
Both invoke the same verifier, preserve a sanitized attempt-specific artifact,
and rely on the verifier's scoped cleanup.

The explicit profile is selected from the exact checked-out application:

- `baseline`: the ownership-free source has no readiness route. Verify live
  health and the ticket read journey, and record readiness as **not tested**.
- `readiness`: require exact ready/no-store behavior and the isolated
  invalid-path control. Never fall back to baseline because a request failed.

For a standalone digest check:

```sh
node tools/brownfield-demo/cli.mjs verify-image \
  --image ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:1fab5706994daec051dbd183ea42a23ab0e74e2caeefeef1e48454fe17aaa5bb \
  --profile readiness \
  --dest "$HOME/brownfield-reliability-evidence/image-1"
```

Local CI may use `sha256:<64hex>` instead of a GHCR reference. Tags are rejected.
That identity is explicitly labelled a local image ID, not a published digest.
CI still builds again after merge; this is not build-once artifact promotion.

## 7. Validation and remaining boundaries

Run the repository suite with Node.js 24:

```sh
npm test
```

The negative HTTP/gateway tests and resource-ownership tests must pass in
addition to the real Docker exercise. Qualification executes the actual
completed-demo readiness suites, not synthetic stand-ins.

Still outside scope: production infrastructure, cross-version migration,
canary comparisons, sustained write traffic, backup restoration, full
security/supply-chain admission, load testing, paging/on-call systems,
long-term SLOs, independent Human approval and customer business value.
