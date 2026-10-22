# Meeting Room Booking: Method Comparison

## Scope and fairness

This comparison uses the recorded interaction histories and the project
documentation for OpenSpec, Spec Kit, and BMad. “OpenSec” is interpreted as
**OpenSpec**, which is the method named in the workspace history and artifacts.

These sessions are useful case studies, but they are **not a controlled
benchmark**. OpenSpec and Spec Kit ran on 19 October 2026; BMad ran on
20 October. Their product decisions, acceptance criteria, implementations,
and stopping points differ. In particular, BMad deliberately limited
implementation to stories 1.1–1.7, while Spec Kit pursued an explicit
performance-acceptance target and OpenSpec completed two discrete change
cycles. Raw elapsed time, tokens, and test counts therefore should not be read
as a ranking of the methods.

## At a glance

| Dimension | OpenSpec | Spec Kit | BMad |
|---|---|---|---|
| Primary unit of work | A proposed change with delta specs, design, and tasks; apply, sync, and archive it | A feature governed by a constitution, specification, plan, tasks, implementation, and convergence | An initiative decomposed into epics and stories, supported by a shared architecture and explicit gates |
| Recorded workflow | Two explore/propose/apply/archive cycles | Constitution → specify → plan → tasks → implement → converge and investigate | Product brief → initiative requirements → epic ordering → architecture → refinement → story plan → approved implementation batch |
| Result in this project | Two changes implemented and archived; 34/34 tasks complete; canonical specs synced | Local Next.js booking application implemented, but 78/87 tasks complete and performance acceptance remains open | API-only local service for stories 1.1–1.7 built and committed; stories 1.8–1.11 gated |
| Main strength demonstrated | Focused, traceable evolution of an existing capability across changes | Detailed acceptance criteria and persistent follow-through when measurable gates fail | Product-to-architecture-to-story traceability, human approval points, and controlled implementation scope |
| Main trade-off demonstrated | Change-level flow is less expansive than initiative-level portfolio planning | High rigor can entail substantial planning, implementation, and convergence effort | More upfront decomposition and decision overhead; the delivered batch may intentionally be narrower than the full initiative |

## What each method did well—and where it costs effort

### OpenSpec

The histories show a compact change lifecycle. It explored the request, asked
for product decisions, proposed a change with capability deltas and a task
list, implemented it, synchronized the canonical specs, and archived it. It
then repeated that lifecycle for a follow-up policy change. This is a good fit
when a team wants a durable record of **what changed in the specification**
and a small, reviewable path from proposal to implementation.

In this case, the method handled the follow-up as an evolution of the service:
it reused existing paths for individual occurrence edits, updated the shared
conflict policy, and avoided introducing an unnecessary endpoint or schema
change. The final record reports 34/34 implementation tasks complete,
122 tests across 15 files, and passing lint, typecheck, build, and strict
specification validation.

The trade-off is that successful change completion is not the same as broad
product or deployment acceptance. The resulting service is documented as
trusted/local-use only and has no authentication or per-user authorization.
Also, some behavior and implementation choices—including the stack and
daylight-saving defaults—were design decisions rather than original human
requirements. The recorded work shows those decisions were documented and
then implemented, but teams should still review proposed defaults before
adopting them.

### Spec Kit

Spec Kit created a relatively complete feature packet: engineering
principles, a detailed feature specification, a technical plan and supporting
contracts, an executable task list, and a later convergence pass. That
structure makes requirements, tests, implementation work, and outstanding
acceptance gaps visible together. Its convergence step is particularly useful
when “the code builds” is not enough and measurable outcomes still need to
pass.

The recorded implementation includes a local Next.js application with a UI,
SQLite persistence, recurrence, and browser testing. Automated checks such as
178 Vitest tests, Chromium checks, accessibility journeys, formatting, lint,
type checking, and production build passed in the history. However, those
checks did not establish full acceptance: 78 of 87 tasks were complete, and
the latest full performance run passed only 3 of 7 classes, with 26 timed-out
observations out of 700. The method made this gap explicit and preserved the
failed evidence instead of relaxing the budgets.

That rigor had a substantial cost in this run. The performance target led to
extended profiling and remediation attempts, and the session ended with the
target still blocked. This should not be read simply as “Spec Kit is slower”:
the history includes a demanding performance investigation that the other
sessions did not perform against the same workload. The README also correctly
separates a successful build from production readiness and calls out manual
acceptance still needed.

### BMad

BMad’s recorded workflow emphasized shaping the request before coding:
product brief, initiative requirements and decisions, epics, a shared
architecture spine, epic refinement, and an 11-story implementation plan.
The human approved major transitions and the final 1.1–1.7 batch. This gives
strong traceability from initiative-level intent to a scoped delivery, and
the record includes explicit gates for information that only the human or
deployment owner could supply.

The implemented batch is an API-only local service with PostgreSQL,
creator-only booking changes, capacity and cleanup rules, availability,
release/readiness checks, and a shared OpenAPI contract. Eight final
verification commands passed, including real-PostgreSQL integration and
release-safety checks, and a local implementation commit was created.
The history also documents review findings and regressions that were fixed
before delivery.

The important scope limitation is that this was **not the whole initiative**:
only stories 1.1–1.7 were built. Stories 1.8–1.11 remain gated, and weekly
recurrence exists only in the contract, not as live handlers. Therefore,
BMad’s delivery cannot be compared as a complete recurrence implementation
against the other two. Its layered planning is valuable for larger,
multi-epic work, but it creates more artifacts, approval points, and upfront
effort than a single change-oriented workflow.

## Recorded outcome and usage

The figures below reproduce each history’s accounting rather than
recalculating it. Token totals count repeated context across model requests;
they are not unique transcript or code volume. “Calls,” “usage events,”
request multipliers, AIU, AI credits, and dollars are different measures.

| Measure | OpenSpec | Spec Kit | BMad |
|---|---:|---:|---:|
| Recorded wall-clock measure | No comparable full-session elapsed total reported | 7 h 26 min 56.619 s, first development request to latest final response | 5 h 19 min 1.040 s, initial request to implementation commit |
| Model usage records / calls | 224 usage events in the reported snapshot | 440 accounted calls (432 main assistant + 8 research) | 331 usage records (329 normal requests + 2 compactions) |
| Input tokens | 23,113,849 | 56,362,875 | 33,835,200 |
| Output tokens | 124,462 | 473,332 | 217,789 |
| Combined input + output | 23,238,311 | 56,836,207 | 34,052,989 |
| Recorded usage unit | 529.73705 AI credits in the report | 1,461.510180 AIU | 852.93271 AIU |
| Currency estimate | Approximately USD 5.30 usage equivalent in that report; not a verified invoice charge | Not available from the session history | Not available from the session history |

The reported OpenSpec usage is a dated snapshot from 19 October, while the
Spec Kit report freezes usage at its reporting-request cutoff and BMad’s
history includes a different accounting window and two compaction records.
The OpenSpec report reconciles its snapshot to published Copilot pricing and
explicitly warns that it is not the incremental invoice charge. The other
reports do not establish a comparable dollar conversion. **Do not infer that
one method was cheaper or more token-efficient from this table.**

Elapsed-time endpoints also differ: OpenSpec does not report a comparable
overall wall-clock duration; Spec Kit’s endpoint follows the extended
convergence/performance investigation; BMad’s endpoint is the implementation
commit, not production acceptance. The histories include human wait time and
tool execution, not just active coding time.

## Product and acceptance differences that affect the comparison

All three started from a similar meeting-room-booking request, but their
resulting product contracts are not identical:

| Topic | OpenSpec | Spec Kit | BMad |
|---|---|---|---|
| Cleanup policy at recorded endpoint | 15 minutes for 1–10 attendees; 30 minutes for 11+ | A 15-minute cleanup gap | A 15-minute cleanup gap in the built individual-booking scope |
| Recurrence at recorded endpoint | Implemented, including partial-success outcomes and individual occurrence handling | Implemented in the local application | Specified in OpenAPI only; no live series handlers in the delivered batch |
| Application shape | Local JSON service; README describes Fastify, PostgreSQL, and Temporal | Local Next.js application with UI and SQLite | API-only Next.js service with PostgreSQL |
| Acceptance boundary | Change tasks and automated checks recorded complete; trusted/local-use boundary remains | Feature implementation remains incomplete against performance and other acceptance tasks | Stories 1.1–1.7 built and locally verified; deployment/operations gates remain |

These are product-scope and implementation differences, not necessarily
method-caused differences. For example, the OpenSpec follow-up specifically
changed cleanup policy, and the BMad human-approved batch intentionally
excluded the later gated stories.

## Practical selection

- **Choose OpenSpec** when work is best expressed as a sequence of bounded
  changes to existing capabilities, and maintaining canonical specifications,
  deltas, and an archive is central.
- **Choose Spec Kit** when a feature needs an explicit constitution,
  substantial planning artifacts, executable acceptance tasks, and a
  deliberate convergence loop against measurable quality targets.
- **Choose BMad** when the problem benefits from initiative/epic/story
  decomposition, architecture alignment across work, explicit human
  checkpoints, or staged delivery with external dependencies and gates.

They are not mutually exclusive in principle: a team may use initiative-level
planning for a large body of work and a change-oriented workflow to manage a
particular implementation increment. The best choice depends on the unit of
coordination the team needs—not on which session produced the largest test
count or lowest recorded usage total.

## Evidence references

- [OpenSpec interaction history](../openspec/docs/openspec-session-history.md)
- [OpenSpec service README](../openspec/README.md)
- [Spec Kit interaction report](../speckit/docs/session-interaction-report.md)
- [Spec Kit README](../speckit/README.md)
- [BMad interaction and delivery report](../bmad/docs/session-interaction-report-2026-10-20.md)
- [BMad service README](../bmad/service/README.md)
