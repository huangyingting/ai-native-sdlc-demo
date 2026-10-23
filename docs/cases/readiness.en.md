# From a live process to verified database readiness

[中文](readiness.md) · [Case index](README.en.md) ·
[Screenshot provenance](assets/readiness/manifest.json)

**Accepted outcome:** the service desk now distinguishes process liveness from
current ticket-database readability without changing accepted ticket behavior.
[Intent #18](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
closed after explicit acceptance at **2026-10-12T22:38:35Z**
(06:38:35 Beijing time on October 13).

This is an actual delivery in repository ID `1415043318`, not an imported
historical result or production certification. The subsequent
[reliability rehearsal](reliability.en.md) has two passing runs; maintenance review remains pending.

**Delivery mainline:** implementation [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)
is authored by `app/copilot-swe-agent`. Copilot's code, Actions verification
and explicit user acceptance are separate records. This differs from the
restricted CLI appendices; see [demo goals and Copilot's role](../copilot-roles.en.md).

## 1. Observe the gap before prescribing a solution

The preceding ownership delivery was already accepted. Two isolated instances
of its exact published image showed why process liveness was insufficient:

| Request | Healthy configuration | Invalid database path |
| --- | --- | --- |
| `GET /api/health` | 200, `{"status":"ok"}` | 200, `{"status":"ok"}` |
| Dashboard | 200, dashboard marker present | 500, marker absent |
| `GET /api/ready` | 404 | 404 |

The fault used a path beneath `/dev/null`, with no data-volume mount. It was
deliberate disposable fault injection, not a production incident or a reversal
of ownership acceptance. No customer-impact or recovery-time baseline existed.

![Liveness stays healthy despite the injected database failure](assets/readiness/baseline-live-despite-db-failure.png)

![The readiness endpoint is absent in the accepted baseline](assets/readiness/baseline-readiness-missing.png)

The [English maintenance Intent](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
kept the outcome open for discovery rather than treating a model's initial
proposal as an approved HTTP contract.

## 2. Record six decisions together, not six approvals

Native batch decisions record multiple discovery outcomes in one command.
[PR #23](https://github.com/huangyingting/ai-native-sdlc-demo/pull/23) added
atomic batches while preserving individual commands and separate approval gates.

[One batch comment](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124226071)
answered all six questions against Spec v2 and generated **one Spec v3**.
An earlier Q-1 receipt remained as superseded history.

| Question | Selected boundary |
| --- | --- |
| Probe capability | A fresh, minimal read of the actual ticket schema through the configured shared store on every request; empty initialized tables are healthy |
| Initialization | Permit existing lazy initialization and genuine new-database seeding, but preserve existing records, timestamps and empty tables |
| HTTP contract | 200 `ready` or 503 `unavailable`, JSON and `Cache-Control: no-store`; current HEAD without a body; explicit 405 methods without probing |
| Diagnostics and latency | One fixed sanitized event per failure; no numeric endpoint or lock deadline, with an owned follow-up |
| Recovery | Repair configuration by recreation; retain populated storage, use an independent control and verify real HTTP and business journeys |
| Meaning | Database-read readiness only, not write availability, complete application health or sufficient production admission evidence |

The failure token `unavailable` matches the existing probe consumer. The frozen
Discovery question still contains its historical `unready` proposal; the
recorded decision and acceptance scenarios, not that old option, are operative.

![All six outcomes in one version-pinned batch](assets/readiness/batch-decisions.png)

### Recover the workflow without erasing evidence

The live batch was recorded successfully, but generation exceeded the existing
110 KB request limit because the complete command body was repeated for every
answer. [PR #24](https://github.com/huangyingting/ai-native-sdlc-demo/pull/24)
deduplicated those bodies without dropping decisions or raising the limit.
The exact request measured **82,177 bytes** afterward. Normal retry generated
the pending revision without reposting the batch.

![Original request-size failure, retained separately](assets/readiness/batch-request-size-failure.png)

Other GitHub API failures were recovered through normal retries. Missing review
refs were restored only to verified, bot-attested commits with authorization;
their disappearance was not attributed to an unestablished cause.

## 3. Approve the exact Spec and Plan separately

[Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/06e9fe31d5c00bb75a2438e49af00ea4fac8b134/docs/delivery-runs/brownfield-human-gated-delivery/18/spec.md)
has nine acceptance scenarios. Its
[approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124496828)
binds hash `15c4d4948968d6e1d96375dbe54c95452528368ab08096440e44b025655a0a3a`
and the recorded decision context.

![Spec v3 incorporates all six outcomes](assets/readiness/spec-v3.png)

[Plan v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/06e9fe31d5c00bb75a2438e49af00ea4fac8b134/docs/delivery-runs/brownfield-human-gated-delivery/18/plan.md)
maps those scenarios to six tasks. Review clarified the exact Red manifest,
collectable preimplementation tests and exclusive retained-volume handover.
Candidate-era wording in the frozen Spec did not negate the trusted approval.
The [Plan approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124971454)
was separate from Spec approval and later code review.

![The reviewed Plan includes safe storage roles and controlled Red](assets/readiness/plan-v2.png)

## 4. Review what the Red tests actually establish

[Tests PR #25](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25)
changed three test files and the expected-failure manifest, not production code.
The first candidate passed exact Red, but review still found gaps:

- The warm GET test did not first make a successful readiness request, so it
  could miss route-level cached success.
- Comparing log calls and stringifying them could allow raw `Error` objects,
  which stringify to `{}` while real logging discloses the exception.
- GET body-reading methods needed guards, not only query-parameter checks.

One correction round added prior-success/failure/recovery assertions, fixed
sanitized diagnostics for initialization, GET and HEAD failures, and body-reader
guards. The eight approved full test names and manifest stayed unchanged.

![The exact-head request-changes review](assets/readiness/tests-request-changes.png)

| Node.js 24 check | Verified result |
| --- | --- |
| Existing application baseline | 38 passing tests |
| Reviewed Tests head `369c476` | 47 total: 39 passing, exactly 8 expected assertion failures |
| Hook, suite, unhandled or unexpected errors | Zero |
| Collection, lint and production build | Passed |

![Controlled Red passes without turning requirement failures into infrastructure errors](assets/readiness/tests-red.png)

[Explicit Tests approval](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25#pullrequestreview-5491931657)
allowed the protected squash merge `98178b7` and implementation handoff.
CI execution authorization for same-repository Copilot runs used supported
maintainer reruns; it was not a stage approval or a rules bypass.

## 5. Make the frozen contract Green

[Implementation PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)
added only two production surfaces: `TicketStore.checkReadiness()` and the
request-time Node.js readiness route. The fixed `SELECT id FROM tickets LIMIT 1`
read does not write business records or interpret caller-provided SQL.

All **47 tests passed**, including all eight formerly Red names. The seven
approved increment artifacts/test files remained byte-identical. Independent
production-standalone checks also recorded 37 HTTP observations; they were
candidate evidence, not final published-image acceptance.

![Frozen-artifact and Green CI](assets/readiness/implementation-green.png)

A separate local Docker build hit an npm TLS download error. TLS verification
was not disabled. Docker CI passed, and additional local HTTP checks used the
exact-source Node.js 24 production standalone build.

The final PR was retargeted to `main`. Strict up-to-date protection required
synchronization with the two already-approved batching commits. All nine
product blobs remained identical. GitHub retained the existing
[implementation approval](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26#pullrequestreview-5496196451)
for sync-only head `64406b5`; no second approval was submitted. Current-head CI
passed and normal protected auto-squash produced `06e9fe3`.

![Protected implementation merge, not an admin bypass](assets/readiness/implementation-merged.png)

## 6. Verify the published digest and real recovery

[Publication run 38311999223, attempt 2](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311999223/attempts/2)
published and verified:

```text
ghcr.io/huangyingting/ai-native-sdlc-demo-it-service-desk@sha256:84bff5d0817cafec6569b394b99eb92cc8b60e98b450bea9484992bcf11bc0d4
```

The pulled image's OCI revision is the merged commit
`06e9fe31d5c00bb75a2438e49af00ea4fac8b134`, and its source label identifies this
repository. The [merged-source CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311998601)
also passed all 47 tests. A preview tag or a workflow name alone was not used
as artifact identity.

![Successful publication and digest verification](assets/readiness/publication.png)

Three initial roles used that same digest: an independent healthy control on
its own volume, a populated retained-volume instance, and a no-mount invalid-path
instance. The control stayed ready during restart and handover. Before repaired
recreation mounted the retained volume, its previous instance was stopped and
removed so no application accessed the volume concurrently.

| Observation | Result |
| --- | --- |
| Invalid configuration | Health 200; readiness 503 with exactly `{"status":"unavailable"}` |
| Repair by recreation | Readiness 200; dashboard and details readable |
| Populated restart and repair | All four original records and exact timestamps unchanged |
| Empty initialized table | Ready without seeding, including after restart |
| Warm query fault | Ready → unavailable → ready on the same published process; GET/HEAD and fixed sanitized events verified |
| Inputs and methods | Native GET body/query overrides ignored; unsupported methods do not initialize |

![Unavailable readiness is distinct from liveness](assets/readiness/fault-readiness.png)

![The same faulty process remains live](assets/readiness/fault-liveness.png)

![Repaired configuration returns ready](assets/readiness/repaired-readiness.png)

![An empty initialized database remains ready after restart](assets/readiness/empty-table.png)

### Preserve real user journeys, not only probe responses

Browser submissions created an unassigned ticket, then verified assignment to
Alex Chen, reassignment to Sam Rivera and clearing in all four statuses:
**12 ownership checks**. Status changes, invalid creation/owner/status rejection,
unchanged-owner timestamps and **seven filter checks** passed. Invalid status
retained its existing 500/error behavior without a database change.

The original four tickets were never edited; intentional changes affected only
the new synthetic ticket. Repeated GET/HEAD readiness probes preserved all five
records and timestamps.

![Creation still starts unassigned](assets/readiness/created-unassigned.png)

![Clearing ownership still works in a closed ticket](assets/readiness/cleared-closed.png)

![Search, owner, status and priority intersect](assets/readiness/filters.png)

Integrated-browser display capture and background animation-frame polling were
unavailable. Real DOM submissions and timer polling were used with persisted
UI/database checks; headless captures recorded durable pages. Navigation-abort
events were not counted as successful writes without state verification.

All seven task containers and three disposable volumes were removed.
Private ticket comparisons and raw logs were not published. The 21 original
screenshots are preserved with timestamps, source identity, dimensions and hashes
in the [manifest](assets/readiness/manifest.json).

## 7. Accept the artifact separately from the implementation

The [evidence summary](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133700328)
was inspected before the user's
[explicit final acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987).
The [trusted receipt](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133963982)
and [accepted state](https://github.com/huangyingting/ai-native-sdlc-demo/blob/b65448cded63331bfab37e5c9c35e8fcd461294b/docs/delivery-runs/brownfield-human-gated-delivery/18/run-state.json)
bind the digest to publication run `38311999223`, attempt 2. The Intent closed
only after this gate, not after unit tests, a merge or automated image verification.

![Explicit acceptance and recorded closure](assets/readiness/accepted-receipt.png)

**Limits remain:** readiness establishes current database readability, not
write availability, all application journeys, authentication, bounded latency
or sufficient production traffic admission. Baseline dependency advisories,
contention measurement, broader fault matrices and preventive maintenance
remain follow-ups. No production failure-rate, ROI or recovery-time
improvement is claimed.
