# Implementation plan

Draft Plan v2 for Human Intent #18, bound to approved Spec v3, SHA-256 `15c4d4948968d6e1d96375dbe54c95452528368ab08096440e44b025655a0a3a`.

The supplied trusted approval record, comment #6124496828, establishes approval of that exact Spec version, hash, and decision context. Candidate-era approval statements inside the frozen Spec are historical; they do not reopen the approval gate. The Spec remains unchanged.

This is an Issue-review document, not authorization to implement, run tests, or perform delivery observations. Only explicit Human approval of **Plan v2** permits the engineering handoff. Tests approval, implementation authorization, delivery, and final Human acceptance remain separate gates.

## Acceptance mapping

| Approved scenario | Tasks | Planned evidence |
| --- | --- | --- |
| AC-1: Preserve database-independent liveness | TASK-1, TASK-3, TASK-5 | Handler coverage forbidding database access; actual HTTP 200 with `{"status":"ok"}` before and after readiness failures. |
| AC-2: Report current database-read readiness | TASK-1, TASK-2, TASK-3, TASK-5 | Fresh actual ticket-schema queries; populated, empty, and warm-store coverage; exact response contract and polling preservation. |
| AC-3: Report invalid configuration without masking failure | TASK-1, TASK-3, TASK-5 | Repeated initialization failures return exact 503 responses and one fixed sanitized event per request; liveness remains available. |
| AC-4: Re-evaluate failure and recovery after an earlier success | TASK-1, TASK-2, TASK-3 | Real SQLite schema-query failure and restoration through the same warm shared store; ready → unavailable → ready with no cached outcome. |
| AC-5: Make initialization side effects explicit | TASK-1, TASK-2, TASK-4 | Fresh seeding, pre-owner migration, existing-empty-table preservation, and record/timestamp comparisons. |
| AC-6: Prevent caller-controlled database access | TASK-1, TASK-3, TASK-5 | Ignored GET inputs, fresh HEAD checks without bodies, and 405 responses without initialization or querying. |
| AC-7: Observe repair and persistent-data recovery | TASK-5 | Immutable-image HTTP observations; healthy restart and repaired recreation using a retained populated volume; private preservation comparisons. |
| AC-8: Preserve accepted ticket behavior and validation | TASK-4, TASK-5 | Existing automated business coverage and actual repaired-instance creation, ownership, status, filter, invalid-input, and unchanged-owner journeys. |
| AC-9: Keep acceptance evidence proportionate and private | TASK-1, TASK-5, TASK-6 | Exact expected-failure manifest, controlled Red/Green evidence, immutable artifact identity, sanitized observations, preservation outcomes, and explicit limitations. |

The Human decisions for Q-1 through Q-6 in comment #6124226071 govern every task. The operative failure token is `unavailable`; the historical discovery option `unready` is not an approved alternative.

Read-only application inspection grounds this revision: liveness has no database dependency; `getTicketStore()` lazily retains one configured synchronous SQLite store; initialization preserves existing empty tables and performs the established owner-column migration; the dashboard is dynamically rendered; and the existing probe consumer separately evaluates readiness and ticket reads.

## Tasks

Application paths are relative to `demos/it-service-desk/` unless explicitly identified as repository-root paths. Proposed files and methods do not exist merely because they appear in this Plan.

### TASK-1: Establish controlled readiness tests and Red evidence

Depends on: none  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9  
Surfaces: `src/lib/ticket-store.test.ts`, proposed `src/app/api/ready/route.test.ts`, proposed `src/app/api/health/route.test.ts`, existing `vitest.config.mts`; repository-root `docs/delivery-runs/brownfield-human-gated-delivery/18/expected-failures.json`  
Validation: Baseline Green; successful test collection, lint, and build with production unchanged; assertion-only Red matching every and only manifest entry; initialization, warm-store, contract, input-isolation, and diagnostic assertions.

After the separate tests-stage authorization, establish a Green baseline for the existing application under Node.js 24. Record the source revision and validation results before adding tests. A baseline failure must be resolved through the appropriate authorized process before accepting readiness Red evidence; do not classify it as an expected requirement failure.

Add executable tests using existing Vitest and real `node:sqlite` fixtures. Do not change production code, approved documents, workflow rules, or dependencies merely to obtain Red.

Tests must collect and pass lint/build **before** the readiness route or store method is implemented. Avoid static imports of nonexistent route modules or references to nonexistent production types. Use test-side discovery of the route file, assert its presence inside each applicable test body, and load it only when present. For the proposed store capability, use a narrow optional structural type and assert that the method exists before invoking it. Absence must produce an ordinary assertion failure, not a loader or type error. Do not supply a fake production implementation, fallback response, or skipped test.

Proposed stable full Vitest names and acceptance mappings are:

| Exact full test name | Acceptance IDs |
| --- | --- |
| `TicketStore readiness reads the actual ticket schema on every invocation` | AC-2, AC-4 |
| `TicketStore readiness accepts an initialized empty table without changing records` | AC-2, AC-5 |
| `Readiness route GET returns the exact current ready contract` | AC-2, AC-9 |
| `Readiness route initialization failures return unavailable and one sanitized event per request` | AC-3, AC-9 |
| `Readiness route warm shared-store queries transition from ready to unavailable to ready` | AC-2, AC-3, AC-4 |
| `Readiness route HEAD checks the current dependency without a response body` | AC-2, AC-3, AC-6 |
| `Readiness route GET ignores caller database and SQL inputs` | AC-6 |
| `Readiness route unsupported methods reject requests without initializing the store` | AC-6 |

Use these names consistently in the executable tests. Populate `docs/delivery-runs/brownfield-human-gated-delivery/18/expected-failures.json` from the **observed** Red result using the repository's existing shape: `version: 1`, `intent: 18`, and `tests` entries containing the exact full `name` and its `acceptance` array. Include every and only expected failing test; passing preservation and liveness tests do not belong in the manifest. No duplicate, skipped, unexpected, collection, infrastructure, unhandled, or unrelated failures are acceptable.

Route spies may establish call counts and event arguments but cannot replace real-schema evidence. Include fresh, populated, initialized-empty, and pre-owner fixtures. For warm-store coverage, initialize the configured shared store, temporarily rename its tickets table through a second disposable SQLite connection, request readiness repeatedly, restore the table, and request again. Keep the same store and database configuration throughout. Restore schema, close connections, restore environment/module isolation, and remove only the named fixture resources.

All setup and teardown must succeed. Missing imports, missing modules, type errors, failed hooks, and accidental exceptions are not Red evidence. Existing business tests and new tests of already-supported compatibility behavior remain Green.

### TASK-2: Add a minimal current ticket-schema read to the shared store

Depends on: TASK-1  
Acceptance: AC-2, AC-4, AC-5  
Surfaces: `src/lib/ticket-store.ts`, `src/lib/ticket-store.test.ts`  
Validation: Real SQLite assertions for fresh queries, successful empty reads, propagated schema failures, recovery on the same store, and unchanged business values and timestamps.

Following the separate implementation authorization, add one small `TicketStore` method that prepares and executes a fixed minimal read against the tickets schema. A proposed method is `checkReadiness()`, using `SELECT id FROM tickets LIMIT 1` and discarding its result. The name and SQL are implementation proposals, not new Human decisions. No returned row still counts as success.

Obtain the store through the existing `getTicketStore()` path used by ticket operations. Do not accept a filename or SQL argument from requests, construct a substitute store, use `SELECT 1` alone, or retrieve all ticket contents unnecessarily.

Preserve normal initialization and the process-scoped shared-store lifecycle. Perform the query on every invocation; neither successful nor failed readiness outcomes are cached. Do not replace the warm store after a query failure. Let initialization and query errors reach the readiness HTTP boundary.

No new migration, seeding rule, business write, database-path reload, busy-timeout change, or dependency is proposed.

### TASK-3: Implement the exact readiness HTTP and diagnostic boundary

Depends on: TASK-1, TASK-2  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-6  
Surfaces: Proposed `src/app/api/ready/route.ts`, its proposed route tests, existing `src/app/api/health/route.ts`, proposed liveness tests  
Validation: Handler tests and immutable-image HTTP checks for exact states, JSON/no-store headers, fresh HEAD checks, empty HEAD bodies, unsupported methods, ignored inputs, and one fixed event per failed request.

Before implementation, inspect the applicable installed Next.js route-handler guide as required by the demo instructions. Use the Node.js runtime and an explicitly request-time route configuration consistent with the installed framework and existing dynamic dashboard. Do not rely solely on response headers to establish fresh evaluation.

GET and HEAD share a narrow dependency-check path: obtain the configured store and execute its current ticket-schema read. Return:

| Request/result | Status | Body | Required headers |
| --- | --- | --- | --- |
| GET success | 200 | `{"status":"ready"}` | `Content-Type: application/json`, `Cache-Control: no-store` |
| GET initialization/query failure | 503 | `{"status":"unavailable"}` | `Content-Type: application/json`, `Cache-Control: no-store` |
| HEAD success/failure | Corresponding 200/503 | None | Same JSON content type and no-store policy |

Catch initialization and query failures at this boundary, not arbitrary surrounding application work. Emit exactly one fixed generic server-side error event per failed GET or HEAD request. Do not attach raw exceptions, interpolate dynamic values, add transition tracking, introduce another logger, or duplicate the event.

Ignore query parameters and GET bodies. Accept no caller-controlled database configuration or SQL. Test that sensitive-looking inputs neither affect database selection nor appear in responses or newly introduced diagnostics.

Explicitly handle POST, PUT, PATCH, DELETE, and OPTIONS with 405 and `Allow: GET, HEAD`. They must not initialize, query, or mutate the store, including before first access. Do not rely on automatic OPTIONS behavior.

Leave `GET /api/health` behavior unchanged. Verify its database independence directly and during live readiness failure.

### TASK-4: Verify initialization and accepted business compatibility

Depends on: TASK-2, TASK-3  
Acceptance: AC-5, AC-8  
Surfaces: `src/lib/ticket-store.test.ts`, `src/app/actions.test.ts`, `src/app/page.test.tsx`, `src/app/tickets/[id]/page.test.tsx`; existing compatibility boundaries in `src/lib/ticket.ts` and `src/app/actions.ts`  
Validation: Fresh, populated pre-owner, empty pre-owner, and empty initialized fixtures; complete record/timestamp comparisons; existing validation, ownership, persistence, rendering, and intersecting-filter coverage.

Request readiness before dashboard access in initialization fixtures. Verify that a genuinely new database receives the usual four tickets once, a compatible older table receives only the established nullable owner-column migration, and an intentionally empty existing table remains empty through repeated checks and reopening.

Compare all existing business fields and timestamps before and after probing. Account for the permitted owner-column addition without treating it as permission to rewrite records.

Preserve Alex Chen and Sam Rivera, initially unassigned new tickets, assign/reassign/clear behavior, status updates, server-side validation, intersecting owner/search/status/priority filters, ignored unsupported enumerated dashboard filters, and unchanged-owner timestamp preservation.

Extend coverage without weakening assertions or rewriting the prior delivery's frozen specifications, plans, tests, or acceptance records. No production change to these business surfaces is proposed.

### TASK-5: Observe immutable-image recovery and real ticket journeys

Depends on: TASK-3, TASK-4  
Acceptance: AC-1, AC-2, AC-3, AC-6, AC-7, AC-8, AC-9  
Surfaces: Existing `Dockerfile` and standalone runtime, application routes and forms, repository-root `tools/brownfield-demo/probes.mjs`, disposable isolated instances and databases  
Validation: Actual HTTP against one delivered immutable image digest; independent-control availability; healthy restart and repaired recreation; safe mount handover; exact readiness/method contracts; real business operations and private preservation comparisons.

Execute only in the separately authorized delivery/acceptance stage. Record the newly delivered image digest and source revision. The Intent's earlier observed image is baseline evidence, not the readiness delivery artifact.

Use three clearly separated roles from the same delivered image:

| Role | Database relationship | Required observation |
| --- | --- | --- |
| Independent healthy control | Its own isolated database, never the retained volume | Remains available during fault observation and volume handover. |
| Populated retained-volume instance | Sole application user of one dedicated populated disposable volume | Healthy reads, repeated checks, restart, and preservation snapshots. |
| Fault instance | Invalid path beneath `/dev/null`, with no mounted data volume | Repeated unavailable readiness while liveness remains compatible. |

Record resource identities and verify mounts before introducing the fault. The control must never share the retained database or mount its volume.

Privately snapshot the populated volume's ticket values and timestamps. Observe readiness, liveness, dashboard-marker presence, and known detail reads. Restart its healthy instance on that same volume, then compare preservation before intentional business edits.

Observe the no-mount fault instance and check that the independent control remains available. Capture repeated readiness failures, generic diagnostics, compatible liveness, and relevant HEAD/method behavior.

Before repaired recreation mounts the retained volume, **stop the retained-volume application instance, detach its mount, and verify that no running application instance still uses that volume**. Stop the fault instance and recreate it with corrected configuration using the retained volume. Never permit concurrent application access during this handover. Keep the independent control available on its own database throughout.

Compare preserved records and timestamps before post-repair edits. Verify repaired readiness, dashboard, details, and repeated polling. Then perform actual ticket creation, assign to Alex Chen, reassign to Sam Rivera, clear ownership, status changes, and intersecting filters. Exercise invalid creation, ownership, and status inputs, ignored unsupported enumerated filters, and an unchanged-owner submission. Track intentional edits separately; compare snapshots around polling and invalid operations.

Reuse the existing probe consumer without changing its contract. Supplement it with explicit HEAD, unsupported-method, input-isolation, write-journey, and preservation checks. Its client timeout is an observation-tool limit, not an approved endpoint latency guarantee.

Preserve snapshots and evidence before cleanup. Clean up only explicitly identified disposable instances and resources; do not delete the retained volume prematurely, shared resources, or broad directories. Record cleanup completion or outstanding retained resources without publishing sensitive contents.

### TASK-6: Assemble private, proportionate acceptance evidence

Depends on: TASK-1, TASK-4, TASK-5  
Acceptance: AC-9  
Surfaces: Existing Human-gated delivery evidence process, expected-failure manifest, deterministic results, HTTP observations, private preservation records; unchanged bilingual guides and demo documentation  
Validation: AC-1 through AC-9 completeness and privacy review; exact artifact/document identity; separation of Red, Green, live observations, deferments, and approval state.

Prepare an English acceptance record identifying Spec v3 and its approved hash, approved Plan version, relevant test and implementation revisions, delivered immutable image, observation times, and non-sensitive resource relationships.

Include baseline Green, exact manifest-to-Red correspondence, subsequent Green results, fresh-query evidence, warm-store transitions, initialization outcomes, exact HTTP contracts, sanitized event counts, dashboard/detail observations, business journeys, preservation pass/fail comparisons, and safe volume handover evidence.

Keep raw databases, ticket snapshots, raw error logs, sensitive paths, credentials, and request payloads private. Publish comparison outcomes rather than ticket contents. Preserve existing bilingual guides and demo documentation.

Clearly state that readiness establishes current database-read capability only. Report failed or unexecuted checks plainly. Neither passing tests nor an assembled record constitutes final Human acceptance.

## Risks and migrations

**Existing-data compatibility.** No new migration is proposed. Readiness may trigger existing directory creation, WAL and foreign-key setup, schema creation, owner-column migration, and genuine new-database seeding. These approved initialization effects mean first access is not guaranteed entirely side-effect-free. Existing records, timestamps, and intentionally empty tables must remain preserved.

**Controlled Red integrity.** Nonexistent route exports and methods create a risk of collection or type failures masquerading as Red. Test-body capability assertions and test-side module discovery must keep collection, lint, build, setup, and teardown successful without adding production stubs. The manifest must match actual assertion failures exactly.

**Framework dispatch and caching.** Direct handler tests cannot establish production routing, caching, automatic OPTIONS behavior, or standalone packaging. Explicit dispatch plus delivered-image HTTP observations are necessary.

**Warm-store validity.** A mock-only transition would not establish current database access. The deterministic schema failure must affect the same configured warm store, and recovery must succeed without replacing that store or changing configuration.

**Diagnostic volume and privacy.** Repeated failures intentionally generate repeated fixed events. Do not replace this approved stateless behavior with transition-only logging. Keep diagnostic arguments fixed and inspect failure handling for accidental exception disclosure.

**Deferred latency risk.** Synchronous SQLite contention can delay readiness and other requests. Q-4 accepts no numeric endpoint or lock deadline and unchanged busy-timeout semantics. huangyingting owns representative measurements and any separately specified timeout or execution isolation before bounded-latency or production claims. This risk remains unmeasured and unresolved.

**Limited signal.** Read success does not establish write capability, all journeys, authentication, latency, or production admission suitability. Acceptance writes demonstrate observed operations only. Additional contention, corrupt-file, and read-only write-failure matrices remain outside this increment.

**Delivery isolation and preservation.** Incorrect mounts, concurrent volume use, or premature cleanup could invalidate evidence or affect data. Separate the healthy control's database, verify exclusive retained-volume use, stop/detach before handover, and preserve snapshots before targeted cleanup.

Baseline dependency risks remain unresolved. Authentication, external monitoring, traffic switching, automatic recovery, preventive reliability work, and cross-version database rollback are not included.

## Validation

All execution below is planned for later authorized stages. No commands, tests, implementation, or fault injection were performed during this document review.

**Baseline Green.** Under Node.js 24, establish existing application test, lint, and build success before introducing readiness tests. Retain source identity and outcomes. Any baseline failure blocks controlled Red acceptance rather than becoming an expected readiness failure.

**Tests-stage integrity and Red.** With production unchanged, collect the new tests successfully and pass `npm run lint` and `npm run build`. Run the focused tests and complete application suite. Require assertion-only failures matching the expected-failure manifest exactly, with successful hooks, no skipped or duplicate expected evidence, and all preservation tests Green. Record exact selectors, full failing names, acceptance mappings, revisions, and outcomes.

**Implementation Green.** Rerun the same tests without weakening assertions or changing their intended meaning. Verify current real-schema access, initialized-empty success, repeated sanitized failures, same-store recovery, request-input isolation, initialization compatibility, unsupported-method isolation, and unchanged polling snapshots.

**Complete application checks.** From `demos/it-service-desk`, run `npm test`, `npm run lint`, and `npm run build`. Validate Node runtime and standalone route packaging. If later authorized work changes repository automation or utilities, run root `npm test` as well; no such changes are currently proposed.

**Immutable-image acceptance.** Execute TASK-5 against the delivered digest, not a development server or baseline image. Verify exact GET/HEAD responses, headers, empty HEAD bodies, unsupported methods, and ignored GET inputs using an HTTP client capable of sending a GET body. Complete real business operations and preservation comparisons.

**Evidence review.** Check every AC mapping, baseline/Red/Green traceability, resource separation, safe volume handover, private snapshot retention, artifact identity, diagnostic sanitization, and explicit limitations. Distinguish deterministic coverage from actual HTTP observations and unexecuted cases. Human acceptance remains separate.

## Revision summary

Plan v2 revises the supplied Plan v1 while preserving TASK-1 through TASK-6, AC-1 through AC-9, dependencies, Human decisions, limitations, and separate approval gates.

The administrative approval question is resolved by the supplied trusted record #6124496828 for the exact approved Spec v3 hash and context. Historical candidate wording remains frozen; no Spec revision is proposed or performed.

TASK-1 now explicitly includes `docs/delivery-runs/brownfield-human-gated-delivery/18/expected-failures.json`, exact full test-name mappings, baseline Green, assertion-only Red, and exclusion of every extra failure. It requires successful collection, lint, and build before route/method implementation and describes test-side handling of absent capabilities without missing-module or type errors.

TASK-5 now explicitly separates the independent healthy control, retained-volume instance, and no-mount fault instance. It requires stopping and detaching the retained-volume instance before repaired recreation mounts that volume, continued control availability on a separate database, snapshot preservation, and targeted cleanup.

The HTTP contract, initialization allowance, fixed per-failure diagnostics, recreation-based repair, and limited-readiness meaning are Human decisions. Store naming and SQL, test names and fixture mechanics, and task organization remain implementation proposals.

No files were written, commands or tests run, faults injected, artifacts delivered, or approvals granted during this review.

## Open questions

**Administrative approval: resolved.** The supplied trusted approval record #6124496828 establishes approval of Spec v3 with SHA-256 `15c4d4948968d6e1d96375dbe54c95452528368ab08096440e44b025655a0a3a` and its decision context. No additional approval-processing clarification is required for this Plan. Frozen candidate-era language is historical, not an operative conflict.

**Deferred performance trade-off.** Synchronous contention remains unmeasured, with no deadline required here. huangyingting's follow-up must establish representative measurements before a separate decision on bounded latency, timeout behavior, or execution isolation. This accepted deferment is not a new requirement or a resolved performance claim.

**Limited-readiness trade-off.** Readable storage can still fail writes or other journeys. Broader fault matrices and baseline dependency risks remain outstanding. The subsequent reliability exercise must define its own combined journey/admission policy; this Plan does not certify one.

All six discovery questions have recorded outcomes. No unanswered product decision or new Spec conflict is identified. Any requested behavior that conflicts with the approved outcomes requires an explicit Human Spec revision, invalidating this draft Plan rather than silently changing its scope.

Only explicit Human approval of **Plan v2** permits the engineering handoff; later approvals remain separate.

