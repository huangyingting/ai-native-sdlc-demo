# Discovery-to-maintenance rehearsal

This case study records actual GitHub Actions, Coding Agent work, protected
merges, published images, browser operations, and database observations. It is
not a proposed demo script.

**Execution boundary:** all three Intents use the permanently recorded
`Delivery Execution: development-test` mode. The repository owner explicitly
authorized the assistant to operate the account and perform scripted review
and acceptance. These are real executions, but **not independent Human review,
customer validation, or Demo Ready certification**.

The ownership increment and maintenance continuation are accepted. The first
maintenance attempt was cancelled after genuine Green failures; its evidence
remains intact. The complete observed sequence is discovery, delivery,
operational feedback, failed maintenance, corrected continuation, and acceptance.

## 1. Start here

| Goal | Starting point |
|---|---|
| Present the result or run the exact delivered image | [Ordered presentation and reproduction steps](#8-present-or-reproduce-the-result) |
| Follow the actual discovery decisions | [Ownership Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1) |
| Inspect the delivered ownership code | [Ownership implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7) |
| Follow operational feedback and recovery | [First maintenance attempt](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8), then [continuation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17) |
| Reproduce the lifecycle in a new repository | [Ordered preparation walkthrough](brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository) |
| Understand the underlying research | [Intent/Spec/Plan research](ai-native-sdlc-early-stage-research.md) |
| Inspect the earlier, separate rehearsal | [Illustrated delivery case study](brownfield-human-gated-delivery-case-study.md) |

The new repository is
[`huangyingting/ai-native-sdlc-discovery-demo`](https://github.com/huangyingting/ai-native-sdlc-discovery-demo).
The previous demo repository was deliberately preserved, not deleted or reset.
Neither completed demo is an ownership-free starting point for another
ownership implementation.

### Provenance and boundaries

| Item | Actual value |
|---|---|
| Ownership-free source | `huangyingting/ai-native-sdlc` |
| Exported source commit | `80cb3c30588754e39fcab792aefe89cad7d1ce85` |
| New repository baseline | `40e17c9853be3655ba927142d1d8e916f262d924` |
| Spec readiness profile | `decisions-v1`, document state version 2 |
| Reviewer account | `huangyingting`, explicitly authorized development-test execution |
| Protection | Active main and lifecycle rulesets; explicit single-owner mode |
| Preserved gates | Exact-head policy, required CI, protected merges, digest-bound acceptance |
| Not used | Admin merge bypasses, force-pushes, weakened required checks, old implementation copying |

Single-owner mode removes the native independent-review requirement; it does
not turn scripted approvals into independent review. The source repository's
main protection configuration was not changed.

## 2. Intent became explicit, version-bound decisions

The ownership Intent deliberately left three product choices unresolved:
whether ownership is optional, whether identities come from a fixed roster,
and whether displaying ownership is sufficient without filtering.

AI-generated Spec v1 added a fourth conditional question: how to migrate
existing ownerless tickets if ownership were mandatory. The system retained
that question even after the optional-ownership decision, rather than silently
removing inconvenient history.

An intentionally premature approval was
[rejected](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862230300):

> Unresolved discovery blockers: Q-1, Q-2, Q-3, Q-4.

No approval, Plan, or engineering assignment was created by that rejected
command.

| Question | Recorded outcome | Decision evidence | Resulting Spec |
|---|---|---|---|
| Q-1 | Ownership is optional; existing/new tickets start unassigned; handoff happens on detail | [Decision](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862237360) | v2 |
| Q-2 | Fixed Avery/Jordan roster; empty means null; invalid inputs fail; repeated owner is write-free | [Decision](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862260763) | v3 |
| Q-3 | Add intersecting owner filtering with exact fixture sets and no stale navigation selection | [Decision](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862281080) | v4 |
| Q-4 | Mandatory-ownership premise is inapplicable; migrate to null without invented attribution | [Decision](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862300128) | v5 |

Each decision caused a real generation/publication run. Each new version was
inspected before the next command. The final Spec mapped all four actual
decision comments into AC-1 through AC-5. Schema validation did not substitute
for reading the resulting acceptance text.

### Document closure

- [Spec v5 approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862323649).
- [Plan v1 approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862357531).
- [Sealed document state](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/document-review.json).
- [Tests-only handoff](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36371081802).

Only after both document approvals did the system close the document stage
issues, create the engineering branch, and assign Tests. Implementation remained
unassigned until the reviewed Tests merged.

This run demonstrates unresolved-question blocking and decision-driven
revisions. It does **not** claim that an already-approved Spec was revoked:
Spec v1 through v4 had not been approved. Decision revisions also do not count
as the toolkit's separate explicit-Spec-revision scenario.

## 3. Tests were reviewed, not merely counted

The initial [Tests PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6)
was not approved immediately. Its assertions could establish that owner options
existed without proving actual owner display, and several persistence and
navigation requirements lacked strong evidence.

The [requested changes](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6#pullrequestreview-5333532414)
required:

- Actual owner metadata on detail and owner text within the matching queue row.
- An independent SQLite `PRAGMA data_version` observer for both assigned and
  unassigned no-ops, not timestamp equality alone.
- Assign, reassign, and clear persistence across close/reopen, including future
  stored timestamps and unrelated-field preservation.
- Successful server-action mutation and queue/detail revalidation.
- Keyboard clearing of only the owner filter and actual mounted-control
  synchronization after navigation.

The Coding Agent corrected the tests. The operator separately repaired missing
PR lifecycle metadata and removed the generated closing keyword after the
agent reported it could not edit the PR body. No production code was changed
during Tests.

| Evidence | Result |
|---|---|
| [Controlled Red, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36372294023/attempts/2) | Baseline Green; lint/build pass; exactly 10 declared assertion-level failures |
| Final Tests head | `108699b7b12673596b04e14074fd84556c81073d` |
| [Exact-head approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6#pullrequestreview-5333579952) | Submitted only after corrected evidence |
| Protected lifecycle merge | `ed2c92b3aa4bbb5f66d9868747e9dda1de3d47e3` |

A local full run initially hit the existing reference-search test's five-second
timeout on the shared host. It was not accepted as expected Red. A serial
rerun produced 26 passes and exactly the 10 declared failures. Remote CI also
validated the exact Red set. No timeout was added to the manifest and no
assertion was weakened.

## 4. Green, protected merge, and immutable publication

The [implementation PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7)
added an additive nullable owner column, validated detail-based handoff,
write-free no-ops, nondecreasing ownership timestamps, owner display, and
intersecting filters. It preserved the approved documents and test blobs.

| Evidence | Actual result |
|---|---|
| [Stage Green, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36373950712/attempts/2) | Approved contracts unchanged; all expected Red tests Green |
| [Application CI, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36373950759/attempts/2) | 37 tests, lint, build, and actual container smoke pass |
| Local checks | 37 tests, lint, TypeScript, build, and editor diagnostics pass |
| [Exact-head approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7#pullrequestreview-5333701785) | Head `886ed41678445c117406b4a900a6912b71e05c14` |
| Protected main merge | `a2004d37bab5d4dbc758f3bdf9599547b4a45ad0` |
| [Publish/verify, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36374182779/attempts/2) | Built, published, pulled by digest, and verified health/dashboard |

Published ownership image:

```text
ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:09bf8f338aaccaacb0290eafc6fe65c7f917cd8642688406aef93d24b0eb36a2
```

GitHub placed several Coding Agent-triggered workflow runs in `action_required`.
The fork-approval API was not applicable and returned 403. Owner-authenticated
`gh run rerun` started actual new attempts, including required CI, Review
Signal, and publication. Repository settings and approval rules were not
weakened. A successful signal job was not treated as a substitute for the
underlying checks.

## 5. Browser and database acceptance of the actual digest

The toolkit started the exact image on loopback port 43128 with a unique named
volume. Its read-only dataset probe confirmed the four original fixtures and
fixed timestamps. Ownership and migration were verified separately.

| Scenario | Observed evidence |
|---|---|
| AC-1: Migration | Actual tests used persisted old-schema rows and compared all legacy values/timestamps; fresh runtime showed null/Unassigned owners and summary 2/1/1/2 |
| AC-2: Handoff | Keyboard assign Avery, reassign Jordan, and clear; each survived reload and its own same-volume container restart; queue/detail agreed |
| AC-2: Preservation | Read-only snapshots across all three transitions proved only owner and nondecreasing `updated_at` changed; other rows were unchanged |
| AC-3: Filters | All={0001,0002,0003,0004}; Avery={0001,0003}; Jordan={0002}; Unassigned={0004}; Avery+open+high+inc-1={0001}; Avery+critical={} |
| AC-3: Navigation | Clearing owner retained search/status/priority; browser Back/Forward restored Avery/All without stale selection; summary stayed 2/1/1/2 |
| AC-4: Invalid requests | Real same-origin forged-owner and nonexistent-ticket POSTs returned 500; server logs identified validation/not-found errors; before/after rows were byte-identical |
| AC-5: Compatibility | Separate fresh volume created the exact manifest ticket as INC-0005, open/unassigned; search, ordering, status update, and summary were verified; original rows stayed unchanged |

The invalid-request HTTP 500 responses follow the existing server-action
exception convention. This run does not claim a new custom validation-error UI.
The database-write-sensitive no-op proof comes from the executed tests; a
browser timestamp alone was not used as proof of no writes.

AC-5 used a separate disposable container on port 43129, not the AC-3 volume.
After its evidence was recorded, only that test container and its own volume
were removed. The ownership runtime and previous demo remained intact.

The [digest-bound acceptance comment](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862969905)
records the exact observations and limitations.
[Acceptance processing](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36375067717)
succeeded and closed the ownership Intent.

### Replay corroboration

The exported read-only replay reported:

```text
recordTrusted: true
runtimeStatus: accepted
documentReview.verified: true
discovery.recordedReady: true
discovery.decisionEvidenceVerified: true
executionMode: development-test
acceptance.complete: false
warnings: []
```

The false `acceptance.complete` is intentional: authenticated scripted
acceptance is not genuine independent Human acceptance. A single replay also
does not establish three completed scenario variants.

## 6. Operate, observe, and open a new maintenance Intent

After acceptance, an isolated disposable replica of the same image was
deliberately configured with an unusable database path. No accepted volume was
attached.

| Probe | Actual baseline observation |
|---|---|
| `GET /api/health` | 200, `{"status":"ok"}` |
| `GET /` | 500; logs showed database initialization failure |
| `GET /api/ready` | 404; no readiness route existed |

This was fault injection, **not a production outage**. The existing health
route correctly served its lightweight liveness purpose. The existing delivery
verifier also checks the dashboard, so this is not evidence that it accepted a
broken replica.

The observation motivated
[a new maintenance Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8):
preserve liveness and add a separate, uncached database-readiness endpoint.
The ownership contract and accepted digest were not rewritten.

### Review caught an invented implementation assumption

Maintenance Spec v1 had no unresolved questions because the Intent made its
product choices explicit. Empty discovery questions are valid; artificial
questions were not added just to demonstrate the mechanism.

Plan v1 assumed an existing public HTTP test harness. Inspection showed the
application instead had six direct-module/component Vitest files and 37
baseline tests. The reviewer
[requested a correction](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8#issuecomment-5863070163)
before approval.

A [second clarification](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8#issuecomment-5863094005)
required the failure manifest to list only actually observed failing test
names, with test-body guards rather than hook failures or skipped tests.
[Plan v3 was approved](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8#issuecomment-5863119578)
only after those changes.

The resulting plan reuses `getTicketStore().summary()`, preserves the existing
successful-only singleton assignment, uses guarded direct-handler tests, and
reserves actual HTTP/image checks for delivery. This is a concrete example of
human/operator verification catching a plausible but unsupported AI plan.

### Frozen readiness tests and protected handoff

The [maintenance Tests PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/13)
added one complete test file and its observed failure manifest. All 11 named
scenarios invoked the existence guard inside their own body, then contained
the deeper response, logging, recovery, repeated-read, real SQLite, and
liveness assertions. The six previous test files were unchanged.

| Evidence | Result |
|---|---|
| [Controlled Red, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36376949673/attempts/2) | Baseline Green, compilation, and exact Red passed |
| Local checks | 37 baseline passes, 11 declared assertion failures, zero skips/run errors; lint/build passed |
| [Exact-head approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/13#pullrequestreview-5333894318) | `da349ef6f6523cca95517368f3f530d5920aa677` |
| Protected Tests merge | `e0d7f5fd755cec7fbfe8c86b9886a5b771a4edae` |

Only after this merge was the Implementation issue assigned.

### Green exposed defects hidden by the missing-route guard

The first [maintenance implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/14)
added a focused route and runbook. However, local execution produced **44 passes
and four failures**, and [actual Green CI](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36378117293/attempts/2)
failed. The reviewer did not approve or merge it.

The frozen Tests file contained two harness defects:

1. `beforeEach(() => getTicketStore.mockReset())` returned a mock function.
   Vitest treated the return value as a cleanup hook and invoked the mock after
   the test, producing unintended exceptions and side effects.
2. An existing SQLite observer connection retained old `SELECT *` column
   metadata after another connection added `owner`. A separate minimal
   reproduction confirmed that refreshing schema metadata or reopening the
   observer exposed the actual persisted column.

The route-existence guards had prevented these deeper paths from running during
Red. **The earlier Tests review missed these defects.** Passing exact Red and
reviewing test names was not sufficient to establish that the frozen harness
could execute its intended Green assertions.

The [changes-requested review](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/14#pullrequestreview-5333985230)
explicitly prohibited test-aware production workarounds and frozen-test edits.
The operator used the supported
[terminal cancellation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8#issuecomment-5863503427)
and opened [continuation Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17)
with the same product scope and corrected harness requirements. An initial
multiline cancellation command was rejected; the valid bare command was then
recorded. No cancelled-run tests, documents, or accepted data were rewritten.
Unmerged PRs were closed with their branches and evidence retained.

The continuation requires non-returning setup, fresh/refreshed SQLite
observation, and a separately labelled pre-approval harness experiment. That
experiment is not stage Green or permission to put production code in Tests.
### Continuation validated the deeper harness before freezing it

The continuation's Spec v1 and Plan v1 were separately reviewed and approved.
Its [new Tests PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/22)
used block-bodied setup, fresh read-only SQLite observers, and complete cleanup.
Actual Tests-branch execution again produced 37 baseline passes and exactly 11
declared assertion failures; lint/build passed.

Before approval, a separate archive outside the Tests branch combined the new
test head with the unmerged route candidate from PR #14. **All 48 tests passed
in that isolated harness experiment.** This specifically exercised the deeper
assertions that Red had not reached. The scratch directory was removed; the
JSON result was retained separately. No production file entered the Tests
branch, and this result was not recorded as stage Green.

[Actual controlled-Red CI, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36379790767/attempts/2)
then passed all its normal checks.
[Exact-head approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/22#pullrequestreview-5334187138)
bound `f786ccc6b43d31a4f7283ef2dc96cace8fe53a6d` and explicitly retained the
requirement for independent implementation-stage Green and runtime acceptance.
### Implementation review removed an unsafe error-handling change

The continuation's
[implementation PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/23)
initially tried to sanitize errors by deleting their properties and replacing
their name, message, and stack. That is unnecessary when the boundary logs only
a fixed string, and it can itself throw for frozen error objects.

The operator added two supplemental tests in a **new** file; both reproduced
`TypeError: Cannot add property name, object is not extensible`. The focused
fix removed mutation of the caught value. It preserved the frozen readiness
tests, original baseline tests, expected-failure manifest, and approved
documents. Full local validation then passed all **50 tests**, lint, build,
editor diagnostics, and approved-blob checks.

This was an operator review correction to Coding Agent output, not a claim of
unassisted autonomous implementation.

### Protected delivery and actual maintenance acceptance

| Evidence | Actual result |
|---|---|
| [Stage Green, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36381621028/attempts/2) | Frozen contracts preserved; all expected Red scenarios Green |
| [Application CI, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36381621085/attempts/2) | 50 tests, lint, build, and real container smoke passed |
| [Exact-head approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/23#pullrequestreview-5334326043) | `78e7b75d31c7e83b94b0648de3f770dd07ab84fe` |
| Protected main merge | `d361ce032b0f729f62b165c23c4f79bb56f29b92` |
| [Publish/verify, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36381916918/attempts/2) | Actual build, publish, digest pull, health and dashboard verification |
| [Digest-bound acceptance](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17#issuecomment-5864107648) | Submitted after the observations below |
| [Acceptance processing](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36382556608) | Succeeded; continuation Intent closed |

Final maintenance image:

```text
ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:1fab5706994daec051dbd183ea42a23ab0e74e2caeefeef1e48454fe17aaa5bb
```

The healthy instance used a **new** isolated volume on loopback 43129. The
faulted and repaired disposable instances used the same immutable image on
loopback 43130, with no volume attached.

| Check | Observed result |
|---|---|
| Healthy readiness | 200, exactly `{"status":"ready"}`, `Cache-Control: no-store` |
| Invalid-path readiness | 503, exactly `{"status":"unavailable"}`, `Cache-Control: no-store` |
| Healthy and faulted liveness | Both 200, exactly `{"status":"ok"}` |
| Failure logging | Two faulted probes produced exactly two fixed generic messages, without database path, exception text, or stack |
| Real ownership UI | Assigned INC-0001 to Avery; detail and queue agreed |
| Repeated probes | 50 real HTTP readiness requests passed; read-only snapshots of all four complete rows were unchanged |
| Same-volume restart | All ticket fields and Avery ownership remained identical |
| Post-probe owner filter | Avery returned only INC-0001; unfiltered summary remained 2/1/1/2 |
| Configuration repair/restart | Recreated only the disposable instance with a usable path; same digest returned ready 200/no-store, health 200, dashboard 200 |
| First-use behavior | The repaired instance's first readiness request initialized four unassigned fixtures; actual tests separately verified old-schema migration |
| Cleanup | Removed only disposable fault/recovery containers; retained the healthy runtime and both earlier demonstrations |

The configuration-repair test is not a claim that an existing process's
environment was modified in place. Real file-backed tests separately exercised
failure followed by repair and a later handler call. The unchanged 37-test
baseline supplies broader compatibility coverage; the maintenance browser
check does not claim to repeat every original ownership scenario.

The maintenance replay corroborated
[`runtimeStatus: accepted`](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/85cba44331dd4d1652e4baa42d5dbb989db02751/docs/delivery-runs/brownfield-human-gated-delivery/17/run-state.json),
`recordTrusted: true`, `documentReview.verified: true`, discovery readiness,
verified decision evidence, and `warnings: []`. Its discovery register is
legitimately empty because the continuation's choices were explicit.
`acceptance.complete` remains **false** for the same development-test exclusion
as the ownership run.

## 7. What this demonstrates, and what it does not

The run demonstrates a persisted discovery register, actual authority-bound
decisions, decision-to-acceptance mapping, blocked premature approval, exact
document revisions, reviewed Red/Green evidence, protected delivery, actual
runtime observations, and a linked maintenance feedback loop.

It does not prove that the original business problem is valuable, that the
chosen requirements are optimal, or that automated semantic validation can
replace review. The maintenance Plan's invented harness is evidence that
structural validation alone is insufficient.

Customer research, measured business outcomes, automatic feasibility
experiments, Plan-specific discovery registers, automatic deferment follow-up,
production monitoring/SLOs, independent Human review, and three completed
Human-led scenario variants remain outside the demonstrated claim.

Raw logs and short-retention report artifacts were preserved separately in the
operator's session evidence, not committed as application output. Use the
[CI preservation guidance](brownfield-human-gated-delivery-case-study.md#preserve-ci-logs-and-reports)
when reproducing this run; GitHub report artifacts expire.

## 8. Present or reproduce the result

### Present the completed evidence in order

1. Open the [ownership Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1).
   Show the rejected premature approval, Q-1 through Q-4 decisions, Spec v5,
   and Plan approval. Explain which decisions came from the operator rather
   than AI inference.
2. Show [ownership Tests](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6),
   requested corrections, actual Red, [implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7),
   Green, the immutable digest, and acceptance.
3. Open the [first maintenance Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8).
   Explain the isolated fault observation, invented HTTP-harness assumption,
   failed Green, and cancellation. Do not present it as a successful delivery.
4. Open the [continuation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17).
   Show corrected Tests, the labelled harness experiment, error-boundary
   correction, genuine Green, publication, and observed final acceptance.
5. Demonstrate the final dashboard, assign/filter ownership, then show
   `/api/health` and `/api/ready`. Explain that a live process can be unready.
6. End with the limitations: scripted development-test approvals, not
   independent review, production certification, or three Human-led rehearsals.

At the end of this run the operator retained:

| Local instance | URL | Purpose |
|---|---|---|
| Previous separate demo | `http://127.0.0.1:43127/` | Preserved historical ownership result |
| Discovery ownership image | `http://127.0.0.1:43128/` | Accepted pre-maintenance digest |
| Final maintenance image | `http://127.0.0.1:43129/` | Accepted ownership plus readiness |

These are loopback instances on the operator's machine, not hosted public
deployments or guaranteed permanently running services.

### Run the published maintenance digest on a fresh workstation

Use Docker and Node.js 24, from the source repository root. The toolkit commands
below present the **existing delivery**, not a new lifecycle. On the original
operator host, reuse the retained instance instead: `run` deliberately refuses
an existing repository/Intent container or volume, even with a different port.

```sh
IMAGE='ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:1fab5706994daec051dbd183ea42a23ab0e74e2caeefeef1e48454fe17aaa5bb'

node tools/brownfield-demo/cli.mjs run \
  --repo huangyingting/ai-native-sdlc-discovery-demo --intent 17 \
  --image "$IMAGE" --port 43129

curl -i http://127.0.0.1:43129/api/health
curl -i http://127.0.0.1:43129/api/ready
```

Open `http://127.0.0.1:43129/`, assign an owner through ticket detail, and verify
the queue filter. The toolkit's fixture verification is not ownership
acceptance; perform the UI and persistence observations yourself.

For a disposable failure demonstration, keep the healthy instance running and
use another available port. This command deliberately mounts **no volume**:

```sh
fault_id=$(docker run -d --rm --name readiness-presentation-fault-17 \
  -p 127.0.0.1:43130:3000 \
  -e SERVICE_DESK_DB_PATH=/dev/null/service-desk.db "$IMAGE")

# After container startup:
curl -i http://127.0.0.1:43130/api/health
curl -i http://127.0.0.1:43130/api/ready
docker logs "$fault_id"

# Stop only this explicitly created disposable container.
docker stop "$fault_id"
```

Expect health 200 but readiness 503/no-store and the generic readiness log.
Do not request the faulted dashboard as part of a sanitized-readiness-log
demonstration: its separate failure path has different logging behavior.
Follow the [application runbook](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/d361ce032b0f729f62b165c23c4f79bb56f29b92/demos/it-service-desk/README.md#liveness-and-database-readiness)
for private configuration diagnosis and repair/restart.

Export actual read-only evidence into new, non-existing destinations:

```sh
node tools/brownfield-demo/cli.mjs replay \
  --repo huangyingting/ai-native-sdlc-discovery-demo --intent 1 \
  --dest ./discovery-ownership-replay
node tools/brownfield-demo/cli.mjs replay \
  --repo huangyingting/ai-native-sdlc-discovery-demo --intent 17 \
  --dest ./discovery-maintenance-replay
```

To run a **new lifecycle**, follow the [preparation walkthrough](brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository)
from the ownership-free source and choose a new isolated repository. Do not
reset either completed demo, reuse its recorded approvals, or count replay as
live evidence. For operational follow-up after acceptance, open a linked new
Intent rather than editing a sealed contract.
