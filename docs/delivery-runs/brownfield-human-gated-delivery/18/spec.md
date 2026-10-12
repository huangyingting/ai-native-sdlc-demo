# Specification

## Intent

Human Intent #18 proposes distinguishing process liveness from availability of the database required by the IT service desk.

Operators and demo presenters need an explicit signal when the Next.js process can answer HTTP requests but its SQLite dependency prevents the application from serving ticket traffic. The increment must also support observing recovery after configuration repair without changing accepted ticket behavior or losing existing data.

This is an initial specification proposal for Human review. No product decisions or approval were supplied. The proposed contract and recovery coverage below remain subject to the discovery questions; they are not agreed requirements.

## Scope

Add a small database-readiness capability to `demos/it-service-desk`, separate from the existing liveness endpoint.

The proposed behavior is:

- Expose `GET /api/ready`.
- Perform a read-only query against the configured application database on every readiness request, including when the application already has a database connection.
- Return an explicit healthy or unhealthy HTTP response without exposing database details.
- Prevent cached responses from concealing readiness changes.
- Preserve existing application initialization, ticket operations, and liveness behavior.
- Demonstrate healthy, faulty, and repaired states using actual HTTP requests and disposable isolated resources during later acceptance.

Application grounding:

- `src/app/api/health/route.ts` returns JSON `{"status":"ok"}` without accessing the database.
- The dashboard is dynamically rendered and uses `getTicketStore()` for ticket listing and summary queries. Its stable HTML marker is `data-testid="service-desk-dashboard"`.
- `getTicketStore()` lazily initializes and retains a shared `TicketStore`. It selects `SERVICE_DESK_DB_PATH`, falling back to `data/service-desk.db` beneath the working directory.
- The store uses Node.js `node:sqlite`. Its constructor can create directories, enable WAL, create the ticket table, seed a new database with four tickets, and add the owner column to an older database.
- Consequently, a read-only readiness query and side-effect-free initialization are different promises. Their relationship requires a Human decision under Q-2.
- The container uses Node.js 24 and defaults to `/app/data/service-desk.db`.

The proposed endpoint checks database readability, not comprehensive ability to perform every ticket operation. Q-1 determines whether that limitation is acceptable.

## Non-goals

This increment does not introduce authentication, external monitoring, production traffic switching, automatic recovery, cross-version database rollback, or production certification.

It does not replace liveness with readiness, redefine accepted ownership behavior, reset databases, or rewrite frozen specifications, plans, tests, or acceptance records from the earlier delivery.

It does not claim that the subsequent reliability exercise, release-admission tooling, dependency-risk remediation, or production operational improvements have been completed.

No implementation, tests, commands, or recovery experiments are executed as part of this document review. Existing bilingual guides and demo documentation remain unchanged.

## Actors

| Actor | Responsibility or interest |
| --- | --- |
| Human Intent owner and configured reviewers | Decide the unresolved contract and limitations, inspect the revised specification, and explicitly approve a version. |
| Operators and demo presenters | Compare liveness with readiness and observe isolated configuration repair and recovery. |
| Service-desk users | Continue using the dashboard, ticket creation, ownership handoffs, filtering, and status updates without regression. |
| Next.js service and SQLite database | Supply process responsiveness and the database capability being assessed. |
| Future read-only admission consumers | May consume the approved readiness contract; their integration is not included here. |

## Constraints

The following constraints come from the Intent and are not optional endpoint-design proposals:

- Preserve the Alex Chen and Sam Rivera owner roster, optional assignment, reassignment and clearing, intersecting filters, ticket creation, and status updates.
- Preserve existing tickets and timestamps. Readiness checks must not modify business records.
- Keep `GET /api/health` compatible and independent of database availability.
- Do not disclose database paths, exception details, stack traces, ticket contents, or credentials through readiness responses or newly introduced readiness diagnostics.
- Inject faults only into disposable isolated resources. Do not change shared instances or existing data volumes.
- Support acceptance with actual HTTP behavior, database access, error handling, recovery observations, and data-preservation evidence. Passing unit tests or an AI summary alone is insufficient.
- Keep this specification and related review material in English while preserving protocol headings, JSON keys, commands, and code identifiers.
- Baseline dependency risks remain unresolved.

Additional proposed constraints, pending Q-1 through Q-6:

- Assess the same configured database used by ticket operations; do not substitute an in-memory database, temporary database, or successful fallback when access fails.
- Perform a minimal query that references the application’s ticket schema rather than only executing a database-independent expression such as `SELECT 1`.
- A query that returns no tickets may still succeed. An intentionally empty, initialized database is not unhealthy merely because it contains no rows.
- Return only a generic readiness state; log only a sanitized readiness-failure event, not the underlying exception.
- Never reuse a previous successful result as the current readiness result.
- Do not promise a response deadline until Q-4 establishes one. The synchronous SQLite implementation makes response latency and its effect on other requests consequential.

## Discovery

```json
{
  "problem": "Operators and demo presenters cannot distinguish a responsive IT service desk process from an instance whose database failure prevents the ticket dashboard from opening. Service-desk users can encounter application failure despite successful liveness checks.",
  "evidence": "The Intent reports isolated fault injection on 2026-10-12T11:44:51Z through 2026-10-12T11:44:52Z using accepted image sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76. Both configurations returned 200 from /api/health; the healthy dashboard returned 200, the invalid-path dashboard returned 500, and /api/ready returned 404 on both. Reports and screenshots are retained outside the repository and were not independently inspected in this review. Source inspection confirms database-independent liveness, database-dependent dashboard rendering, and lazy SQLite initialization with schema and seed side effects. Production incidence, customer impact, recovery-time baselines, and workload measurements are unknown.",
  "successMeasure": "Proposed success is observable HTTP differentiation between a healthy isolated instance and an invalid-database-path instance, followed by successful readiness and real ticket operations after repair with existing data preserved. No production improvement target or readiness response-time threshold is supplied; acceptance breadth and timing require Q-4 and Q-5 decisions.",
  "alternatives": "Do nothing: no change, but liveness continues to conceal database failure. Use dashboard HTTP checks only: no new endpoint, but rendering is a heavier and less explicit dependency signal. Open the database only: smaller probe, but opening does not establish ticket-schema readability. Query the ticket schema on each request: stronger read evidence without business writes, but does not prove write capability or every application operation. Add a write-and-rollback probe: stronger write evidence, but introduces locking and side-effect risks and requires explicit approval.",
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
  "decisionMapping": []
}
```

## Acceptance scenarios

These stable IDs describe the proposed contract. Behaviors tied to unanswered questions are candidates, not recorded Human decisions. Later acceptance must observe the approved version against the delivered application; no result is claimed here.

### AC-1: Preserve database-independent liveness

**Given** an isolated instance whose process is responsive, with either a healthy database configuration or the deliberately invalid database path.

**When** an operator sends `GET /api/health`.

**Then** it returns HTTP 200 with JSON `{"status":"ok"}` in both configurations, without making database success a condition of liveness.

### AC-2: Report current database-read readiness

**Given** an isolated instance with a configured, initialized database whose ticket schema is readable, including an intentionally empty database.

**When** an operator sends `GET /api/ready`, including repeated requests after the shared store has already been initialized.

**Then** each request performs the proposed read-only ticket-schema query and returns HTTP 200, JSON `{"status":"ready"}`, `Content-Type: application/json`, and `Cache-Control: no-store`; it exposes no ticket data and performs no business-record writes. This contract depends on Q-1 and Q-3.

### AC-3: Report invalid configuration without masking failure

**Given** a responsive isolated instance configured with a database path beneath `/dev/null`, without a mounted data volume.

**When** an operator sends `GET /api/ready`.

**Then** it returns HTTP 503, JSON `{"status":"unready"}`, and the proposed JSON and no-store headers rather than an unhandled failure page or healthy fallback. The response contains no database path, exception details, stack trace, ticket contents, or credentials. Liveness remains compatible under AC-1. This contract depends on Q-3 and Q-4.

### AC-4: Re-evaluate failure after an earlier success

**Given** an isolated instance that previously passed readiness and a disposable test condition under which the next ticket-schema query fails.

**When** another readiness request reaches the instance.

**Then** the request executes a new query and reports unready rather than reusing the earlier successful result; any newly introduced diagnostic is sanitized according to the selected Q-4 policy. This does not establish same-process recovery after repair or a response-time guarantee; those remain questions under Q-4 and Q-5.

### AC-5: Make initialization side effects explicit

**Given** either a fresh isolated database location or a disposable copy of a compatible older database lacking the owner column.

**When** readiness is requested before a dashboard request.

**Then** under the recommended Q-2 option, normal existing initialization may occur before the read-only probe: a new database receives its usual four seeded tickets, and the compatible older database retains all existing records and timestamps while receiving the existing owner migration. Repeated probes neither duplicate seeds nor reset data. If the Human selects strictly side-effect-free readiness instead, this scenario must be revised before approval.

### AC-6: Prevent caller-controlled database access

**Given** a readiness request containing query parameters or a GET body suggesting another database path, SQL statement, or configuration value.

**When** the endpoint receives the request.

**Then** under the proposed Q-3 contract, it ignores those inputs, probes only the application-configured database, and returns the ordinary readiness result without reflecting supplied values. `HEAD` returns the corresponding status and headers without a body; methods other than GET and HEAD return 405 with `Allow: GET, HEAD` and do not probe or mutate the database.

### AC-7: Observe repair and persistent-data recovery

**Given** a populated disposable database with privately recorded ticket values and timestamps, a healthy reference instance, and a separate faulty instance showing the AC-3 invalid-path state.

**When** the operator repairs the faulty instance’s configuration and recreates it using the retained populated isolated database, then requests readiness, the dashboard, and known ticket details.

**Then** under the recommended Q-5 option, readiness returns the AC-2 healthy response, the dashboard returns HTTP 200 with `data-testid="service-desk-dashboard"`, known details remain readable, and pre-existing records and timestamps match their recorded values. A subsequent recreation using that same isolated database preserves those results. The healthy reference remains available throughout the fault observation. No shared volume is repaired, reset, or replaced.

### AC-8: Preserve accepted ticket behavior and validation

**Given** the repaired isolated instance and the accepted owner roster and ticket workflows.

**When** a user creates a valid ticket, assigns it to Alex Chen, hands it to Sam Rivera, clears ownership, updates status, and combines owner, search, status, and priority filters; the user also submits invalid creation, ownership, and status inputs.

**Then** valid operations retain their existing behavior and persistence, new tickets start unassigned, and filters intersect as before. Invalid inputs retain existing server-side validation behavior and do not create invalid records or unintended changes. Only intentional valid user operations change relevant data or timestamps; readiness polling does not. These real operations demonstrate recovery coverage under Q-5, not a guarantee that every successful read probe establishes writability under Q-6.

### AC-9: Keep acceptance evidence proportionate and private

**Given** the approved contract and later observations of healthy, faulty, repaired, and restarted isolated instances.

**When** evidence is assembled for Human acceptance.

**Then** it identifies the exercised artifact and isolated configurations, records observed HTTP statuses, readiness bodies and cache headers, dashboard-marker presence, database-read outcomes, recovery operations, and preservation comparisons without publishing sensitive database contents or error logs. It separates actual observations from unexecuted scenarios and limitations. Tests, an AI comment, a checklist, or these proposed scenarios do not constitute Human approval or acceptance.

## Revision summary

This is the initial proposal; no previous specification was supplied.

It grounds the Intent in the existing database-independent health route, dynamic dashboard queries, lazy shared SQLite store, initialization side effects, and container configuration. It proposes a minimal per-request read-readiness contract and isolated recreation-based recovery coverage while preserving earlier accepted ticket behavior.

Six discovery questions expose the undecided probe capability, initialization policy, HTTP contract, diagnostics and latency, recovery breadth, and limits of read readiness. No supplied `latestDecisions` exist, so there are no decision mappings or recorded outcomes to integrate.

The discussion reports restoration of document-review and runtime branches and a retry request. It supplies no product decision, specification approval, or recovery evidence for this feature.

## Open questions

All six register items are unanswered and block approval until a configured Human records a decision or deferment:

- **Q-1:** Choose open-only, per-request ticket-schema read, or a carefully defined write probe.
- **Q-2:** Decide whether readiness may trigger existing initialization or must be strictly side-effect-free.
- **Q-3:** Confirm the endpoint, HTTP responses, cache policy, and input/method handling.
- **Q-4:** Select sanitized diagnostic behavior and decide whether a response-time target is required or deferred.
- **Q-5:** Confirm recreation-based recovery, preservation and operation coverage, and any additional failure or same-process recovery cases.
- **Q-6:** Accept or change the explicit limitation that database-read readiness does not guarantee writes or full traffic admission.

No deferments have been recorded. If latency or broader fault coverage is deferred, its remaining risk must stay visible in the next revision rather than being described as resolved. The Human must inspect the revised specification after decisions are incorporated before explicitly approving a version.

