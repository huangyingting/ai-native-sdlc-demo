# Implementation plan

Draft Plan v1 for Human Intent #18, based on the supplied approved Spec v3, SHA-256 `15c4d4948968d6e1d96375dbe54c95452528368ab08096440e44b025655a0a3a`.

This is an Issue-review document, not authorization to implement or execute validation. The approved specification remains unchanged. Only explicit Human approval of this Plan version permits the engineering handoff; later tests, implementation, delivery, and final acceptance remain separately gated.

## Acceptance mapping

| Approved scenario | Tasks | Planned evidence |
| --- | --- | --- |
| AC-1: Preserve database-independent liveness | TASK-1, TASK-3, TASK-5 | Liveness handler coverage with database access forbidden; actual HTTP 200 with `{"status":"ok"}` before and after readiness failures. |
| AC-2: Report current database-read readiness | TASK-1, TASK-2, TASK-3, TASK-5 | Actual ticket-schema query on every GET and HEAD; populated, empty, and warm-store cases; exact HTTP contract and no business-data changes. |
| AC-3: Report invalid configuration without masking failure | TASK-1, TASK-3, TASK-5 | Repeated initialization failures produce exact 503 responses and one fixed sanitized error event per request; liveness remains available. |
| AC-4: Re-evaluate failure and recovery after an earlier success | TASK-1, TASK-2, TASK-3 | Deterministic real SQLite schema-query failure and restoration through the same warm shared store, with ready → unavailable → ready results. |
| AC-5: Make initialization side effects explicit | TASK-1, TASK-2, TASK-4 | Fresh-database seeding, pre-owner migration, existing-empty-table preservation, and repeated-probe snapshot comparisons. |
| AC-6: Prevent caller-controlled database access | TASK-1, TASK-3, TASK-5 | GET input isolation, current HEAD checks without bodies, and explicit unsupported-method responses without initialization or queries. |
| AC-7: Observe repair and persistent-data recovery | TASK-5 | Immutable-image HTTP observations, healthy restart and repaired recreation using the retained populated isolated volume, dashboard/detail reads, and private preservation comparisons. |
| AC-8: Preserve accepted ticket behavior and validation | TASK-4, TASK-5 | Existing automated business tests plus actual repaired-instance creation, ownership, status, filters, invalid-input, and unchanged-owner journeys. |
| AC-9: Keep acceptance evidence proportionate and private | TASK-1, TASK-5, TASK-6 | Traceable Red/Green evidence, immutable artifact identity, sanitized live observations, private data comparisons, and explicit scope limitations. |

The Human decisions for Q-1 through Q-6 in comment #6124226071 govern these tasks. In particular, `unavailable` is mandatory; the historical `unready` discovery option is not the selected contract.

## Tasks

All application paths below are relative to `demos/it-service-desk/` unless explicitly repository-root paths.

### TASK-1: Establish controlled readiness tests and Red evidence

Depends on: none  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9  
Surfaces: `src/lib/ticket-store.test.ts`, proposed `src/app/api/ready/route.test.ts`, proposed liveness handler coverage, `vitest.config.mts`  
Validation: Targeted Vitest assertions for fresh queries, exact responses, initialization compatibility, warm-store transitions, input isolation, method dispatch, and sanitized event counts; capture expected Red failures against unchanged production behavior.

After the applicable handoff and tests-stage authorization, add tests before production changes. Use the existing Vitest runner and real `node:sqlite` fixtures; do not introduce a new test framework.

Separate route-boundary tests from real-store tests. Route spies can verify invocation counts and logging, but cannot alone establish an actual ticket-schema read. Real-store fixtures must include populated and empty tables, a fresh location, a compatible pre-owner database, and a warm configured shared store.

For warm-store coverage, use a disposable file-backed database. After successful readiness, temporarily make its tickets schema unavailable through a separate test connection, request readiness repeatedly, restore the schema, and request again. Keep the same shared store and configuration throughout the transition. Restore schema and close connections in fixture cleanup; do not add a production fault-injection mechanism.

Record expected requirement failures, such as the absent endpoint and absent fresh-query capability. Missing dependencies, invalid fixtures, import mistakes, or test-runner failures are not sufficient Red evidence. Existing behavior-preservation tests should remain green; a failing new requirement must be distinguishable from an unrelated baseline failure.

### TASK-2: Add a minimal current ticket-schema read to the shared store

Depends on: TASK-1  
Acceptance: AC-2, AC-4, AC-5  
Surfaces: `src/lib/ticket-store.ts`, `src/lib/ticket-store.test.ts`  
Validation: Real SQLite tests prove each invocation executes the fixed ticket-schema query, empty tables succeed, schema failures propagate, restoration succeeds on the same store, and polling leaves ticket values and timestamps unchanged.

Propose a small `TicketStore` method that prepares and executes a fixed minimal read, such as `SELECT id FROM tickets LIMIT 1`, discarding the result. The exact method name and SQL are implementation proposals, not additional Human decisions. Successful execution with no returned row counts as ready.

The route must obtain this store through `getTicketStore()`, exactly as ticket operations do. Do not construct a substitute store, accept a filename or SQL argument from the request, call a full ticket listing unnecessarily, or use connection opening or `SELECT 1` alone.

Preserve the constructor and shared-store lifecycle: normal initialization occurs before the probe, and a successfully initialized store retains its configured path. Do not cache readiness outcomes, replace the warm store after a query failure, or suppress database exceptions in the store method. Let the readiness boundary convert those failures into the specified HTTP result.

No new schema migration, business write, seed rule, busy-timeout change, or database-path reload behavior is planned.

### TASK-3: Implement the exact readiness HTTP and diagnostic boundary

Depends on: TASK-1, TASK-2  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-6  
Surfaces: Proposed `src/app/api/ready/route.ts`, proposed route tests, existing `src/app/api/health/route.ts`  
Validation: Direct handler tests and deployed HTTP checks verify both statuses and exact bodies, JSON content type, `Cache-Control: no-store`, fresh HEAD checks, no HEAD body, unsupported-method behavior, ignored inputs, and exactly one sanitized event per database failure.

Use the Node.js runtime required by `node:sqlite`. Before coding, inspect the installed Next.js route-handler documentation required by the demo instructions. Ensure the route is evaluated at request time and cannot reuse a cached successful response.

GET and HEAD should share one dependency-check path:

- Obtain the configured shared store and execute its fresh ticket-schema read.
- Return 200 with exactly `{"status":"ready"}` on success, or 503 with exactly `{"status":"unavailable"}` on initialization or query failure.
- Set JSON content type and `Cache-Control: no-store` in either state. HEAD returns corresponding status and headers without a body.
- Catch only the dependency-check boundary. Emit one fixed generic server-side error event for each failed request, with no exception argument or interpolated dynamic values. Do not introduce another logging layer that duplicates the event.

Do not read GET query parameters or request bodies to configure the check. Verify malicious-looking values neither alter the selected database/query nor appear in responses or logs.

Explicitly handle POST, PUT, PATCH, DELETE, and OPTIONS as 405 with `Allow: GET, HEAD`. Do not rely on framework defaults, particularly automatic OPTIONS handling. These handlers must not call `getTicketStore()` or initialize the database, including before first access.

Leave the liveness handler database-independent and behaviorally unchanged. Test it with database access forbidden and alongside failing readiness.

### TASK-4: Verify initialization and accepted business compatibility

Depends on: TASK-2, TASK-3  
Acceptance: AC-5, AC-8  
Surfaces: `src/lib/ticket-store.test.ts`, `src/app/actions.test.ts`, `src/app/page.test.tsx`, `src/app/tickets/[id]/page.test.tsx`; compatibility boundaries in `src/lib/ticket.ts` and `src/app/actions.ts`  
Validation: Fresh, populated legacy, empty legacy, and empty initialized fixtures; exact record/timestamp comparisons; existing owner, validation, persistence, rendering, and intersecting-filter tests.

Extend relevant coverage without rewriting the prior delivery's frozen lifecycle artifacts or weakening existing assertions.

Request readiness before dashboard access in initialization fixtures. Verify a genuinely new database receives the usual four seed tickets exactly once; a compatible pre-owner database receives only the established owner-column migration; and an intentionally empty existing table remains empty after repeated probes and reopening.

Compare all pre-existing business values and timestamps before and after readiness. For a legacy table, account explicitly for the newly added nullable owner column without treating that permitted schema change as a business edit.

Retain Alex Chen and Sam Rivera, new-ticket unassigned ownership, assign/reassign/clear behavior, status behavior, server-side validation, intersecting filters, ignored unsupported enumerated dashboard filters, and unchanged-owner timestamp preservation. Production changes to these business surfaces are not proposed.

### TASK-5: Observe immutable-image recovery and real ticket journeys

Depends on: TASK-3, TASK-4  
Acceptance: AC-1, AC-2, AC-3, AC-6, AC-7, AC-8, AC-9  
Surfaces: Existing `Dockerfile` and standalone runtime, application routes and forms, repository-root `tools/brownfield-demo/probes.mjs`, disposable isolated instances and one retained populated application volume  
Validation: Actual HTTP requests against the delivered image digest; healthy/faulty/restarted/repaired observations; HEAD and unsupported-method checks; real business operations; private before/after preservation comparisons.

Execute only in the subsequently authorized delivery/acceptance stage. Identify the newly delivered immutable image and source revision; the Intent's earlier image is baseline evidence, not the readiness delivery artifact.

Use a healthy isolated reference and a faulty isolated instance from that same image. The faulty instance uses a path beneath `/dev/null` with no mounted data volume. It must never access the retained application volume or any shared resource.

Populate an isolated healthy application volume and privately record ticket values and timestamps. Observe repeated readiness, liveness, dashboard-marker and detail responses. Restart the healthy instance with that volume and compare preservation before business edits. Keep the healthy reference available during fault observation.

Observe repeated invalid-path readiness failures and compatible liveness. Repair configuration by recreating the faulty instance using the retained populated volume. Avoid simultaneous application access to that volume during the handover; the independent healthy reference remains available. Confirm readiness, dashboard, known details, and preservation after recreation.

On the repaired instance, perform actual creation, assign to Alex Chen, reassign to Sam Rivera, clear ownership, status changes, and intersecting filters. Exercise invalid creation, owner, and status inputs and an unchanged-owner submission. Record intentional edits separately from unexpected changes, and compare snapshots around readiness polling.

Use the existing probe consumer where appropriate without changing its contract. Supplement it with explicit HEAD, unsupported-method, input-isolation, write-journey, and preservation checks; its existing dashboard/detail probes are not sufficient for all scenarios.

### TASK-6: Assemble private, proportionate acceptance evidence

Depends on: TASK-1, TASK-4, TASK-5  
Acceptance: AC-9  
Surfaces: Existing Human-gated delivery evidence process, deterministic test results, HTTP observations, private preservation records; unchanged bilingual guides and demo documentation  
Validation: Evidence completeness and privacy review against every AC-n; explicit separation of executed observations, deterministic coverage, deferred work, and approval state.

Prepare an English acceptance record identifying the Plan and Spec versions, immutable image digest, source revision, observation times, and non-sensitive isolated-resource relationships.

Include Red/Green traceability, HTTP statuses and exact generic readiness bodies, headers, HEAD/method behavior, dashboard-marker presence, business-journey outcomes, preservation pass/fail comparisons, fresh-query evidence, and sanitized diagnostic event counts.

Keep raw databases, ticket snapshots, raw error logs, sensitive paths, credentials, and request payloads private. Publish comparison outcomes rather than business contents. Preserve existing bilingual guides and demo documentation; do not rewrite approved Spec or prior acceptance artifacts.

State that readiness establishes current database-read capability only. Successful checks and AI-generated evidence do not themselves constitute Human approval or final acceptance.

## Risks and migrations

**Existing-data compatibility.** No new migration is proposed. Readiness may trigger existing directory creation, WAL and foreign-key setup, schema creation, owner-column migration, and genuine new-database seeding. These are approved initialization side effects, not proof that first access is entirely read-only. Existing tables must not be reset or reseeded, and existing records and timestamps must not change through polling.

**Framework dispatch and caching.** Direct handler tests can miss production caching, automatic HEAD/OPTIONS behavior, or runtime differences. Explicit handlers plus immutable-image HTTP checks are required. Unsupported methods must remain outside the lazy initialization boundary.

**False readiness and cached results.** A connection-only test or cached success could reproduce the original operational gap. Real-schema failure/restoration coverage must exercise the warm application store, not merely a mock returning alternating booleans.

**Diagnostic volume and privacy.** One event per failing request can create repeated log volume; this is the selected stateless behavior. Do not silently substitute transition-only logging. Keep the catch boundary narrow and the event fixed to avoid leaking database exceptions.

**Deferred latency risk.** Synchronous SQLite contention can delay readiness and other requests. Q-4 explicitly accepts no numeric endpoint or lock deadline and unchanged busy-timeout semantics. huangyingting owns representative measurements and separately specified timeout or execution isolation before bounded-latency or production-readiness claims.

**Read-only signal limitations.** Writable storage, successful mutations, all journeys, and production admission suitability are not established by a ready response. Real writes are required acceptance observations, not per-probe guarantees. Lock-contention, corrupt-file, and read-only write-failure matrices remain outside this increment.

**Delivery isolation.** Mistaken mounts or concurrent volume use could undermine preservation evidence or affect unintended data. Verify disposable resource identities and mounts before faults, preserve the designated volume, and clean up only explicitly identified disposable resources after evidence capture.

Baseline dependency risks remain unresolved. No dependency upgrade, authentication, traffic switching, automatic recovery, or cross-version rollback is included.

## Validation

All checks below are planned for later authorized stages; none was executed during this document review.

**Controlled Red.** Under Node.js 24, run focused store and route tests against unchanged production behavior. Retain the test revision, baseline revision, selectors, expected failing assertions, and exit outcome. Resolve harness defects separately. Preserve a record of unrelated baseline failures rather than relabeling them as readiness Red evidence.

**Green verification.** After the approved implementation stage, rerun the same tests without weakening expectations. Verify every accepted GET/HEAD triggers a current real-schema query; repeated failures log once each; restoration returns ready through the same warm store; and no probe changes business data. Check production method dispatch over HTTP, including GET bodies using a client capable of sending them.

**Complete application checks.** From `demos/it-service-desk`, run `npm test`, `npm run lint`, and `npm run build` as required by its instructions. A successful build is also needed to verify the Node runtime and standalone route packaging. If later authorized work changes repository utilities, run the root `npm test` suite as well. No utility changes are currently proposed.

**Live acceptance.** Execute TASK-5 using the delivered immutable image and disposable resources. Do not substitute development-server behavior, unit tests, the baseline image, or a model summary for actual HTTP and recovery observations.

**Evidence review.** Check AC-1 through AC-9 coverage, preservation comparisons, event sanitization, artifact identity, and separation of deterministic versus live evidence. Record failed or unexecuted checks plainly. Neither test success nor a completed evidence checklist authorizes acceptance.

## Revision summary

This is the initial Plan revision; no previous Plan was supplied. TASK-1 through TASK-6 establish stable IDs for subsequent revisions.

The Plan translates the exact supplied Spec into controlled TDD coverage, a minimal shared-store read, explicit HTTP dispatch and diagnostics, compatibility checks, isolated immutable-image recovery, and private acceptance evidence. It preserves AC-1 through AC-9 and the recorded Q-1 through Q-6 decisions, including deferred latency and broader fault-matrix risks.

The endpoint contract, initialization allowance, per-failure diagnostics, recreation-based configuration repair, and read-only meaning are Human decisions. The proposed store method, minimal SQL, fixture mechanism, and task organization are implementation proposals subject to this Plan's review.

No files were written, commands or tests run, faults injected, artifacts delivered, or approvals granted during this review.

## Open questions

**Approval-language inconsistency.** The task explicitly supplies an approved Spec and its hash, while the immutable Spec text retains candidate-era statements that no version-specific approval is supplied. The discussion also describes an approval-processing failure. This Plan uses the supplied approved-Spec designation without asserting that it independently verified processing. Does the trusted lifecycle record establish approval of exactly the supplied hash? Clarify the record without inferring approval from discussion; if the Spec text itself must change, the Human must request an explicit Spec revision, invalidating this draft Plan.

**Deferred performance trade-off.** Per Q-4, synchronous contention remains unmeasured and no deadline is required here. huangyingting's follow-up must establish representative measurements before proposing latency bounds or execution isolation. This is unresolved follow-up risk, not an unanswered discovery decision or an additional requirement for this increment.

**Limited-readiness trade-off.** Per Q-5 and Q-6, readable storage can still fail writes or other journeys, and the additional fault matrices remain unexecuted. A future reliability exercise must define its own combined journey/admission policy; this Plan does not resolve or certify that policy.

All six discovery questions have recorded outcomes; no new product choice is needed for the proposed minimal implementation. Any requested behavior conflicting with those outcomes requires an explicit Human Spec revision rather than an implicit Plan amendment. Only explicit Human approval of this Plan version permits engineering handoff.

