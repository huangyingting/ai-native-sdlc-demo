# Specification

## Intent

Human Intent #18 seeks to distinguish process liveness from database readiness in the IT service desk.

Operators and demo presenters need to identify an instance whose Next.js process responds to HTTP requests but whose configured SQLite database cannot support ticket reads. The increment should also support observing recovery after configuration repair while preserving the ticket ownership, handoff, filtering, creation, and status-update behavior accepted in #1.

This is specification revision 2 for Human review, not implementation or acceptance evidence. The supplied latest decision for Q-1 establishes the required probe capability. Q-2 through Q-6 remain undecided in the trusted decision record; discussion recommendations are not substitutes for recorded decisions or version-specific specification approval.

## Scope

Introduce a small readiness capability in `demos/it-service-desk`, separate from existing liveness.

**Recorded requirement from Q-1:** Every readiness request must perform a fresh, minimal read-only query against the actual ticket schema through the same configured application database used by ticket operations, including an already-initialized shared store. Opening a connection or executing `SELECT 1` alone is insufficient. A successfully queried empty, initialized tickets table is ready. The probe must not write business records, use a substitute database, or reuse a previous successful result.

**Proposed remaining contract, pending Q-2 through Q-6:**

- Expose `GET /api/ready` and `HEAD /api/ready`.
- Return HTTP 200 with `{"status":"ready"}` after a successful current probe, or HTTP 503 with `{"status":"unavailable"}` after dependency failure.
- Return JSON with `Cache-Control: no-store`; HEAD supplies the corresponding status and headers without a body.
- Reject other methods with HTTP 405 and `Allow: GET, HEAD`, without probing.
- Prevent caller inputs from overriding database configuration or probe SQL.
- Allow existing lazy initialization before the read-only probe.
- Emit one fixed, sanitized server-side event per readiness failure.
- Observe healthy, invalid-path, repaired, and restarted isolated instances using the immutable delivered image, including data-preservation and real ticket-operation checks.
- Describe the signal as current database-read capability, not write availability or production admission certification.

The proposed `unavailable` token follows the discussion recommendation. The preserved Q-3 register still contains the earlier `unready` recommendation. Neither token has a recorded Q-3 decision; this revision exposes the difference rather than treating discussion as approval.

### Application grounding

Inspection of the existing application establishes:

- `src/app/api/health/route.ts` returns `{"status":"ok"}` without accessing the database.
- The dashboard is dynamically rendered, calls `getTicketStore()` for ticket listing and summary queries, and includes `data-testid="service-desk-dashboard"`.
- `getTicketStore()` lazily creates and retains a shared `TicketStore`. It selects `SERVICE_DESK_DB_PATH`, otherwise using `data/service-desk.db` beneath the working directory. It does not reselect the path once the shared store exists.
- `TicketStore` uses synchronous `node:sqlite`. Initialization can create directories, configure WAL, create the ticket table, migrate an older table by adding the owner column, and seed a newly created table with four tickets.
- Existing tables are not reseeded merely because they are empty. The owner migration does not update existing ticket timestamps.
- Ticket creation, status updates, and ownership updates use the same shared store. Server-side schemas validate their inputs.
- The container uses Node.js 24 and defaults to `/app/data/service-desk.db`.
- No readiness route exists in the inspected application.

A read-only probe therefore does not imply side-effect-free first access. Initialization policy remains Q-2; dynamic configuration recovery and acceptance breadth remain Q-5.

## Non-goals

This increment does not introduce authentication, external monitoring, production traffic switching, automatic recovery, preventive reliability work, cross-version database rollback, or production certification.

It does not replace liveness, redefine accepted ticket ownership behavior, reset databases, or rewrite the previous delivery’s frozen specifications, plans, tests, or acceptance records.

The Q-1 probe does not establish write capability, every application journey, or a response-time guarantee. Q-6 still determines whether that limited signal is acceptable under the proposed readiness vocabulary; Q-4 determines responsiveness boundaries.

The subsequent reliability exercise, dependency-risk remediation, and future release-admission integration are not claimed as completed.

This review does not execute commands, tests, implementation, or recovery experiments. Existing bilingual guides and demo documentation remain unchanged.

## Actors

| Actor | Responsibility or interest |
| --- | --- |
| Human Intent owner and configured reviewers | Record discovery decisions or deferments, inspect the revised specification, and explicitly approve a specific version. |
| Operators and demo presenters | Distinguish responsive processes from unreadable database dependencies and observe isolated recovery. |
| Service-desk users | Retain existing dashboard, ticket creation, ownership handoff, filtering, and status-update behavior. |
| Next.js service and configured SQLite database | Supply the process response and current ticket-schema read capability being assessed. |
| Future admission consumers | May consume the approved readiness contract; integration and production admission policy are outside this increment. |

## Constraints

The Intent requires:

- Preserve the Alex Chen and Sam Rivera roster, optional ownership, assignment, reassignment, clearing, intersecting filters, ticket creation, and status updates.
- Preserve existing ticket values and timestamps except changes caused by intentional valid user operations. Readiness probes must not modify business records.
- Keep `GET /api/health` compatible and independent of database availability.
- Do not disclose database paths, exception details, stack traces, ticket contents, or credentials in readiness responses or newly introduced readiness diagnostics.
- Inject faults only into disposable isolated resources. Do not modify shared instances or existing data volumes.
- Support later acceptance with actual HTTP behavior, database access, error handling, recovery observations, and data-preservation evidence. Unit tests or a model summary alone are insufficient.
- Keep this specification and related review material in English while preserving protocol headings, JSON keys, commands, and code identifiers.
- Keep baseline dependency risks visible; this increment does not resolve them.

The recorded Q-1 decision additionally requires fresh ticket-schema reads through the actual application database on every readiness request, including warm-store requests. Connection-open success, database-independent expressions, substitute databases, and cached successes cannot satisfy that requirement. Zero returned tickets must not by itself cause failure.

Initialization permission, exact HTTP behavior, diagnostic policy, recovery coverage, and acceptance of limited read readiness remain proposed. No numeric latency or SQLite-lock deadline is supplied or recorded as deferred. The synchronous database implementation makes this an explicit Q-4 concern, not an implicit guarantee.

## Discovery

```json
{
  "problem": "Operators and demo presenters cannot distinguish a responsive IT service desk process from an instance whose database failure prevents the ticket dashboard from opening. Service-desk users can encounter application failure despite successful liveness checks.",
  "evidence": "The Intent reports isolated fault injection on 2026-10-12T11:44:51Z through 2026-10-12T11:44:52Z using accepted image sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76, sourced from commit 1a1e14d0031305ee5da35c523ffbac9fa6f7e58b. Both configurations returned 200 from /api/health; the healthy dashboard returned 200 with its marker, the invalid-path dashboard returned 500 without it, and /api/ready returned 404 on both. The healthy instance used a fresh isolated volume with four verified seed tickets and remained available afterward. Reports and screenshots are retained outside the repository and were not independently inspected in this review. Application inspection confirms database-independent liveness, database-dependent dashboard rendering, a shared SQLite store, and lazy initialization with schema and seed side effects. Production incidence, customer benefit, recovery-time baselines, workload measurements, and delivered readiness behavior are unknown.",
  "successMeasure": "Demonstrate fresh ticket-schema reads for every readiness request, including an initialized shared store and an empty initialized table; distinguish healthy and invalid-path isolated instances over actual HTTP; and observe repaired and restarted instances with real ticket operations and preserved data. The precise HTTP contract and required recovery breadth remain pending Q-3 and Q-5. No production improvement target or numeric response-time threshold is supplied; responsiveness remains Q-4.",
  "alternatives": "Do nothing: no change, but liveness continues to conceal database failure. Use dashboard HTTP checks only: no new endpoint, but rendering is a heavier and less explicit dependency signal. Open the database only: smaller probe, but no ticket-schema query evidence and does not meet the required capability. Query the actual ticket schema on every request: minimal current read evidence without business writes, but no write or full-journey guarantee. Add a write-and-rollback probe: stronger write evidence with locking and side-effect risks, outside the required read-only probe and requiring reconciliation if pursued.",
  "questions": [
    {
      "id": "Q-1",
      "question": "What database capability must readiness establish?",
      "options": "Open-only: lowest probe work but no query evidence / read-only ticket-schema query on every request: recommended, detects read or schema failure but does not establish write capability / write-and-rollback probe: stronger write evidence with locking and side-effect risks; specify isolation and preservation guarantees if selected."
    },
    {
      "id": "Q-2",
      "question": "May readiness trigger the existing lazy database initialization?",
      "options": "Allow existing initialization before a read-only probe: recommended for compatibility with fresh instances, permits existing directory creation, WAL setup, schema creation or owner migration, and new-database seeding without rewriting existing business records / strictly side-effect-free readiness: requires a separate initialization boundary and leaves missing or uninitialized databases unready until normal application initialization succeeds."
    },
    {
      "id": "Q-3",
      "question": "What public endpoint, response, caching, and request-input contract should consumers rely on?",
      "options": "GET /api/ready with 200 and {\"status\":\"ready\"} on success, 503 and {\"status\":\"unready\"} on dependency failure, application/json, and Cache-Control: no-store in both states: recommended; accept no path, SQL, or configuration overrides, ignore query parameters and GET bodies, use HEAD with matching status and headers but no body, and reject other methods with 405 and Allow: GET, HEAD / choose a different explicit contract and specify all of these behaviors."
    },
    {
      "id": "Q-4",
      "question": "What failure-diagnostic and responsiveness boundaries are required?",
      "options": "Generic sanitized readiness-failure event with no raw exception or sensitive values: recommended for diagnostics / no new readiness logs: avoids probe log volume but limits diagnosis / sanitized transition-only events: reduces volume but adds state. Also decide whether to defer a measured latency target or require a numeric response deadline and behavior under SQLite locks; no supported threshold or baseline has been supplied."
    },
    {
      "id": "Q-5",
      "question": "Which recovery and preservation observations are required for acceptance, and is instance recreation sufficient?",
      "options": "Recreate an isolated instance after configuration repair: recommended; verify healthy-invalid-repaired HTTP states, repeated probes, dashboard and detail reads, create/assign/reassign/clear/status/filter operations, and unchanged pre-existing records and timestamps except intentional user edits; retain a populated isolated volume across restart and repair / require additional same-process recovery after a transient query failure without configuration changes / require dynamic database-path changes in a running process: changes current shared-store configuration semantics. Also decide whether lock, corrupt-file, missing-schema, and read-only cases must supplement the invalid-path observation."
    },
    {
      "id": "Q-6",
      "question": "Is database readability an acceptable readiness signal when writes or other application operations can still fail?",
      "options": "Accept explicitly limited database-read readiness: recommended small increment, with real write operations demonstrated during recovery but no per-probe write guarantee / require ticket-write availability to gate readiness: expands the probe contract and must be reconciled with Q-1 / retain read readiness but use a different endpoint or response vocabulary to avoid implying full traffic admission."
    }
  ],
  "decisionMapping": [
    {
      "questionId": "Q-1",
      "commentId": 6124026970,
      "acceptanceIds": ["AC-2", "AC-4", "AC-6"],
      "explanation": "AC-2 now requires a fresh minimal read-only query against the actual ticket schema through the configured application database, including an initialized shared store, and accepts successful empty-table reads. AC-4 requires a new query after earlier success so current query or schema failure cannot be hidden by cached success. AC-6 applies that same database and query boundary despite caller-supplied overrides. Connection opening, SELECT 1 alone, substitute databases, business-record writes, and reused successful results are excluded. This establishes read capability only; initialization permission, HTTP details, recovery breadth, and acceptance of the write limitation remain separate questions."
    }
  ]
}
```

## Acceptance scenarios

Acceptance IDs are retained from revision 1. Q-1 behavior below is a recorded requirement. Other endpoint details and additional recovery coverage are explicitly proposed pending their named questions. No scenario is claimed to have been executed.

### AC-1: Preserve database-independent liveness

**Given** an isolated instance whose process is responsive, with either a healthy database configuration or a deliberately invalid database path.

**When** an operator sends `GET /api/health`.

**Then** it returns HTTP 200 with JSON `{"status":"ok"}` in both configurations, without requiring successful database initialization or access.

### AC-2: Report current database-read readiness

**Given** an isolated instance whose configured application database has a readable, initialized ticket schema, including an intentionally empty tickets table or an already-initialized shared store.

**When** an operator sends a readiness request, including repeated requests.

**Then** each request must perform a fresh, minimal read-only query against the actual ticket schema through the same configured database used by ticket operations. Successfully querying an empty initialized table counts as ready. Opening a connection or executing `SELECT 1` alone does not satisfy this scenario; no business records are written, no substitute database is used, and no previous success is reused. Pending Q-3, the proposed GET response is HTTP 200 with `{"status":"ready"}`, JSON content type, and `Cache-Control: no-store`, without ticket contents.

### AC-3: Report invalid configuration without masking failure

**Given** a responsive isolated instance configured with a database path beneath `/dev/null`, without a mounted data volume.

**When** an operator sends `GET /api/ready`.

**Then** under the proposed Q-3 contract, it returns HTTP 503 with `{"status":"unavailable"}`, JSON content type, and `Cache-Control: no-store`, rather than an unhandled failure page or healthy fallback. No database path, exception detail, stack trace, ticket content, or credential is disclosed. Under the proposed Q-4 policy, one fixed sanitized server-side failure event is emitted without the raw exception or sensitive values. Liveness remains compatible under AC-1. The response token and diagnostic policy remain undecided.

### AC-4: Re-evaluate failure after an earlier success

**Given** an isolated instance whose shared store previously passed readiness and a disposable deterministic condition that makes the next ticket-schema query fail.

**When** another readiness request reaches the instance.

**Then** it must execute a fresh query through that same configured application database and report dependency failure, not reuse the earlier success or substitute another database. Pending Q-3 and Q-4, the proposed response and diagnostic match AC-3. As additional proposed Q-5 coverage, removing the transient failure without changing configuration permits a subsequent request to execute another fresh query and return the AC-2 healthy result. This same-process recovery coverage is not yet a recorded requirement and does not promise dynamic path changes, recovery from every fault, or bounded latency.

### AC-5: Make initialization side effects explicit

**Given** a fresh isolated database location, a disposable compatible older database lacking the owner column, or an existing initialized database whose tickets table is intentionally empty.

**When** readiness is requested before a dashboard request and then requested repeatedly.

**Then** under the proposed Q-2 option, normal initialization may precede the read-only probe: a new table receives the usual four seeded tickets; the older table receives the existing owner migration without rewriting existing records or timestamps; and the intentionally empty existing table remains empty. Repeated requests do not duplicate seeds or reset data. The probe itself performs no business-record writes. The first readiness request is not promised to be side-effect-free under this option. Selecting strictly side-effect-free readiness would require revising this scenario before approval.

### AC-6: Prevent caller-controlled database access

**Given** a readiness request containing query parameters or a GET body suggesting another database path, SQL statement, or configuration value, or a request using HEAD or another method.

**When** the endpoint receives the request.

**Then** caller inputs must not cause the Q-1 probe to use a substitute database or replace its fresh read-only ticket-schema query. Under the proposed Q-3 contract, query parameters and GET bodies are ignored without reflecting their values; GET performs the ordinary current probe; HEAD performs the same current probe and returns the corresponding status and headers without a body; other methods return HTTP 405 with `Allow: GET, HEAD` and do not probe or mutate the database.

### AC-7: Observe repair and persistent-data recovery

**Given** the immutable delivered image, a populated disposable database with privately recorded ticket values and timestamps, a healthy isolated reference instance, and a separate faulty instance exhibiting AC-3.

**When** an operator observes a healthy restart with the populated volume, repairs the faulty configuration, recreates the instance using that retained isolated volume, and requests readiness, the dashboard, and known ticket details.

**Then** under the proposed Q-5 coverage, readiness returns the AC-2 healthy response; the dashboard returns HTTP 200 with `data-testid="service-desk-dashboard"`; known details remain readable; and existing records and timestamps match their recorded values except intentional user edits. Repeated probes and recreation preserve those results. The healthy reference remains available throughout the fault observation. No shared instance or existing shared data volume is modified, reset, or replaced. This proposal does not require changing the database path dynamically within a running process.

### AC-8: Preserve accepted ticket behavior and validation

**Given** the repaired isolated instance, the accepted owner roster, and the existing ticket workflows.

**When** a user creates a valid ticket, assigns it to Alex Chen, hands it to Sam Rivera, clears ownership, updates status, and combines owner, search, status, and priority filters; the user also submits invalid creation, ownership, and status inputs.

**Then** valid operations retain existing behavior and persistence, new tickets start unassigned, and filters intersect as before. Invalid inputs retain existing server-side validation and error behavior without creating invalid records or unintended changes. An unchanged-owner submission retains its existing no-op timestamp behavior. Only intentional valid operations change the relevant records or timestamps; readiness polling does not. Real write operations are proposed recovery evidence under Q-5, not proof that each successful read probe establishes write availability. Acceptance of that limitation remains Q-6.

### AC-9: Keep acceptance evidence proportionate and private

**Given** a subsequently approved specification and later isolated observations of healthy, faulty, repaired, and restarted instances.

**When** evidence is assembled for Human acceptance.

**Then** it identifies the immutable exercised artifact and isolated configurations; records actual HTTP statuses, readiness bodies and cache headers, dashboard-marker presence, probe outcomes, recovery journeys, and preservation comparisons; and distinguishes observations from unexecuted cases and limitations. Sensitive database contents, raw error logs, paths, and credentials are not published. Tests, AI comments, checklists, discovery decisions, and successful observations do not themselves constitute version-specific Human specification approval or final acceptance.

## Revision summary

Revision 2 incorporates the sole supplied latest decision: Q-1, recorded in comment #6124026970. The per-request actual ticket-schema read is now required rather than merely recommended. AC-2, AC-4, and AC-6 explicitly enforce current reads through the configured application database, including the initialized shared store, accept successful empty-table reads, and exclude connection-only checks, `SELECT 1` alone, substitute databases, cached successes, and business-record writes.

All six discovery questions and their options are preserved exactly, including Q-1. One decision mapping connects its recorded outcome to the affected stable acceptance IDs.

Application inspection confirms the initialization, empty-table preservation, shared-store configuration, liveness, and validation behavior described here. It does not establish delivered readiness behavior or recovery results.

The discussion’s remaining recommendations inform proposals, not recorded requirements. In particular, this revision proposes `unavailable` instead of the previous `unready` token, per-failure sanitized diagnostics, and deterministic warm-store recovery coverage. Q-3, Q-4, and Q-5 still require recorded disposition. Suggested latency deferral is not treated as a recorded deferment.

No specification approval, implementation completion, or acceptance is claimed. Operational branch-restoration discussion does not change the product requirements.

## Open questions

Q-1 has a recorded decision and is integrated into the proposed behavior. The following unanswered register items block approval until a configured Human records a decision or deferment:

- **Q-2 — Initialization:** May readiness trigger existing initialization, migration, and genuine new-table seeding, or must first access be strictly side-effect-free? This revision proposes compatibility with existing initialization while preserving existing records, timestamps, and empty tables.
- **Q-3 — Public contract:** Confirm path, statuses, bodies, caching, caller-input handling, and methods. The unchanged register recommends `unready`; discussion and this revision propose `unavailable`. The exact token remains undecided.
- **Q-4 — Diagnostics and responsiveness:** Confirm per-failure sanitized events or another logging policy, and decide whether numeric response and lock deadlines are required or deferred. No measured baseline or recorded deferment exists.
- **Q-5 — Recovery breadth:** Confirm immutable-image HTTP observations, populated-volume restart and repaired recreation, initialization coverage, real journeys, preservation checks, and deterministic warm-store failure/recovery. Decide whether broader fault cases or dynamic configuration recovery are required.
- **Q-6 — Meaning of readiness:** Confirm whether database-read capability alone is acceptable despite possible write or full-journey failures, or choose a compatible narrower vocabulary. Any write-gating requirement must be reconciled with the recorded read-only Q-1 contract.

**Deferred risks:** No deferments are recorded. Latency under synchronous SQLite access, lock behavior, broader failure recovery, and production suitability remain visible unknowns rather than resolved limitations.

The discussion’s batch selection does not record decisions for Q-2 through Q-6 in the supplied latest decisions. The Human must inspect the revised specification after further decisions are integrated and explicitly approve a specific version; decision mappings alone do not establish correctness or approval.

