# Reliability Loops: Actual Development-Test Rehearsal

Execution date: 2026-09-28. This records actual commands and observations,
not a scenario plan. Start with the [step-by-step guide](brownfield-reliability-loops.md)
to reproduce the exercise, and the
[research](ai-native-sdlc-delivery-operations-research.md) for the baseline gaps.

The work is explicitly **development-test**. Scripted operator review is not
independent Human approval. No production outage, cross-version rollback,
production SLO or customer outcome is claimed.

## 1. Fixed application and source

- Application revision:
  `d361ce032b0f729f62b165c23c4f79bb56f29b92`.
- Application Git tree:
  `8aed50dfacb527f3550b4a779514701383fa5bea`.
- Image:
  `ghcr.io/huangyingting/ai-native-sdlc-discovery-demo-it-service-desk@sha256:1fab5706994daec051dbd183ea42a23ab0e74e2caeefeef1e48454fe17aaa5bb`.
- Image OCI revision matched the qualified source application's Git tree.
  This is checked metadata consistency, not signed provenance.
- Source application and approved lifecycle artifacts were not modified.

## 2. Trustworthy verification

An isolated archive of the exact delivered application commit was created.
Dependencies were installed only in that scratch export. Every tracked test
blob was checked before/after runs. Original and restored controls both ran
all **13 readiness tests successfully**.

| Deliberate mutant | Observed failing tests | Required detection |
|---|---:|---|
| Omit the database summary read | 4 | Named readiness/read-frequency assertions |
| Return 200 instead of 503 on failure | 7 | Named unavailable-response assertions |
| Omit no-store from successful readiness | 6 | Exact response contract |
| Omit no-store from failed readiness | 7 | Exact response contract |
| Log the raw caught error | 4 | Fixed sanitized-log assertions |
| Mutate a caught frozen error | 3 | The two specific frozen-error test bodies must report the bounded expected application TypeError; other contract assertions also fail |

The last row is not mislabeled an assertion-only failure. Hook errors, imports,
timeouts, skipped tests and unhandled runner errors are not valid mutant kills.
All six declared mutants were detected, the original route was restored and
all exported test blobs remained unchanged.

Qualification report SHA-256:
`81424f534b8150195d8e80d9fe980d4a92f164f932b9e57d571afc83006f0e90`.
Raw test diagnostics remain separate private scratch evidence.

## 3. A real failed first attempt

The first Docker exercise successfully rejected the invalid database
configuration and kept traffic on the stable release. Monitoring then failed
with `clock-error` after two healthy samples, before process fault injection.
It correctly reported failure rather than completing the loop.

The monitor had assumed one `setTimeout(200)` wake guaranteed a full 200 ms
wall-clock gap. Timer granularity can yield a shorter gap without a backwards
clock. The correction waits for the actual deadline, with a bounded number of
remaining-delay waits. Tests retain backwards/stalled-clock rejection.
No timestamps or recovery thresholds were rounded to manufacture success.

Read-only review also found that a Docker client timeout could occur after
daemon-side creation. Cleanup now records the attempted exact name before
starting and reconciles it to a verified managed ID. Container and volume
creation-timeout regressions were added.

All first-attempt lab resources were cleaned. The three previously accepted
demo instances and their volumes remained untouched.

## 4. Two successful fresh runtime exercises

Both runs used newly labelled containers and a new isolated volume. The bad
configuration instance had no volume. The local gateway admitted only GET
requests to fixed read routes; no general write traffic was exercised.

| Observation | Runtime attempt 2 | Runtime attempt 3 |
|---|---|---|
| Overall result | Passed | Passed |
| Monitor incident | `incident-62a8486014c0b4912838cd4e` | `incident-18207a373510776b2439931d` |
| Bad configuration rejected before promotion | Yes; stable continued serving | Yes; stable continued serving |
| Candidate actually received gateway traffic | Verified response release header | Verified response release header |
| Injected runtime fault | Candidate process paused | Candidate process paused |
| Failing composite samples | 2 of 10 | 2 of 10 |
| Detection from first observed failure | 4208 ms | 4207 ms |
| Recovery confirmation after detection | 733 ms | 882 ms |
| Automatic fallback count | Exactly 1 | Exactly 1 |
| Separate all-healthy recovery window | 5 samples / 975 ms | 5 samples / 1069 ms |
| Repeated bad-configuration admission | Rejected | Rejected |
| Lab cleanup | Complete | Complete |

These timings are measured from completed probe observations. They are not
continuous downtime, production MTTR or a promise of zero disruption. The
8/10 healthy sample ratio describes an intentionally faulted short window,
not an SLO.

Each run performed a controlled fixture write after candidate promotion.
The full schema/row hash after that write and after rollback matched:

```text
50dd32d65913297d57fb74f847aece6fc74068f2a76c6b75c5efbd4317c5e2ad
```

This verifies data preservation for the same-image/shared-new-volume scenario.
It does not establish cross-version schema compatibility or restore a backup.

### Durable evidence identities

| Evidence | SHA-256 identity |
|---|---|
| Attempt 2 monitor | `d463533d5a33f5410b713f4f0b60847770b4e7ec7a9147bb3fc91f8743a271b1` |
| Attempt 2 recovery window | `36bb824e3f2bc8277525a59bd5bead442b1100843e6f0b3c6fcc4f3b52a4301b` |
| Attempt 3 monitor | `89fdaea4513c992ffcf3451707ee6b109ead16e512000388a43824d71e27a87d` |
| Attempt 3 recovery window | `0d09e1346b9db67af8507ef97ca04c1fc189f1342d15cff3c067dbe77418285b` |

Local JSON records and private qualification diagnostics were retained outside
the repository. The ordinary operational follow-up is
[huangyingting/ai-native-sdlc-discovery-demo#25](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/25).
Its review and PR/check references track preventive work separately from
observed availability recovery.

## 5. Interpretation and limits

The paused process is a deliberately known injected cause, not an inferred
production diagnosis. Readiness admission does not prevent arbitrary process
suspension. Two different controls were exercised:

1. Reject an unusable database configuration before routing traffic.
2. Detect a later process outage and restore reads through a rechecked standby.

The monitoring draft deliberately says root cause is unconfirmed until an
operator supplies evidence. Its existence does not mean an Issue was published,
a PR approved or preventive work completed. Those are separate GitHub actions.

Full local validation after the corrections:

- Repository automation: **186 passed**.
- Trace viewer: **26 passed**.
- Demo toolkit: **174 passed**.
- Unchanged source application: **26 passed**, lint and production build passed.
- Completed readiness demo application: **50 passed**, lint and production
  build passed.

An earlier source-application run hit two existing 5-second test timeouts while
another application build was active. A subsequent complete run after that
build finished passed with the same tests and thresholds. This environmental
failure was not reclassified as expected Red, and no application tests were
weakened.

The executable command and CI paths now include readiness fault verification
where readiness exists. Remaining gaps still include signed supply-chain
admission, cross-version rollout, backups, load tests, production monitoring,
on-call ownership, independent approvals and measured customer value.

## 6. Published tooling, protected merge and remote repetition

Source tooling was published at
[`61b6b46d467d55f688dfb7cf3be81c65a3454e87`](https://github.com/huangyingting/ai-native-sdlc/commit/61b6b46d467d55f688dfb7cf3be81c65a3454e87).
Its actual [repository CI](https://github.com/huangyingting/ai-native-sdlc/actions/runs/36387993023)
and [application/container CI](https://github.com/huangyingting/ai-native-sdlc/actions/runs/36387993028)
passed. The downloaded source container artifact explicitly recorded
`profile: baseline` and readiness **not tested**, preserving the source's
absent-feature contract.

The completed demo received the shared tools and guides through
[huangyingting/ai-native-sdlc-discovery-demo#26](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/26).
Its [actual application/container CI](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36388190642)
passed using `profile: readiness`, including healthy 200 and invalid-path
503 controls. The exact reviewed head was
`8300f265c9f8b62ab2ed0546870882a9dc56f6a7`; its
[operator review](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/26#pullrequestreview-5334899676)
was explicitly scripted development-test review. Normal protected merge
produced `6f243c0ab268ef3d6b49541403421b76f249fa6d` at
2026-09-28T06:49:40Z. No admin merge or ruleset change was used.

The new workflow then ran on that merged revision:
[Brownfield Reliability Loops, attempt 1](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36388446065/attempts/1).
It actually qualified the committed tests, pulled the accepted digest, ran
all runtime controls and uploaded the evidence. Downloaded artifact contents
confirmed:

| Observation | GitHub-hosted result |
|---|---|
| Original/restored readiness tests | 13 passed / 13 passed |
| Declared mutants | All six detected; frozen test blobs unchanged |
| Qualification-to-image application tree | Exact match despite different tooling/documentation commits |
| Bad configuration before/after recovery | Rejected both times |
| Incident | `incident-9673a51f8d3ecb9e6a2fc50f`, resolved |
| Detection / recovery confirmation | 4204 ms / 720 ms |
| Separate recovery window | Five healthy samples over 917 ms |
| Full post-write dataset hash | Preserved, same hash as both local successful runs |
| New containers/volume | Cleaned |

Remote artifact `reliability-36388446065-attempt-1` has 14-day retention.
The raw downloaded files were additionally retained in the local session
evidence store; these identities and observations remain in Git and the
maintenance Issue after Actions retention expires:

- Qualification report SHA-256:
  `b6d97b99d8ae3cedcdd9ba8f5596267161a4f3cb45f4bd0d391ad41622dad010`.
- Runtime report SHA-256:
  `c6d8f75c32d6200120d72a204c53586cbe6479ed689d14f294b0e2fbcfb8934e`.
- Monitor evidence:
  `957e69e1addaac72efc262f1adea4f50126bb0ed897f905913fe150c5981a395`.
- Recovery-window evidence:
  `f0c626faaeaa14f01762351159dd623dee982c219635f6ab506e7a0fd3a57991`.

The ordinary [maintenance follow-up](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/25)
records scope review, implementation and the post-merge verification before
closure. Availability recovery and reviewed preventive follow-up are separate
records; historical runtime JSON is not rewritten to claim approval.

No new product image or historical accepted Publish run was required. The
updated shared published-image verifier was exercised against the existing
accepted digest in this new workflow, while old delivery receipts stayed
unchanged. Disposable local dependency/cache directories were removed after
qualification; reports and failure evidence were preserved.
