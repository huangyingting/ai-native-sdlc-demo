# Specification

## Intent

Human Intent #18 seeks to distinguish process liveness from database-read readiness in the existing IT service desk.

Operators and demo presenters need to recognize a responsive Next.js process whose configured SQLite database cannot support ticket reads, and observe recovery after configuration repair. This increment must preserve the ticket ownership, handoff, filtering, creation, and status-update behavior accepted in #1.

This is specification revision 3 for Human review. It incorporates the supplied latest decisions for Q-1 through Q-6 from comment #6124226071. Those decisions establish requirements for this candidate; they do not approve this specification or establish implementation, deployment, or acceptance.

## Scope

Add a small, explicit database-read readiness capability in `demos/it-service-desk`, separate from process liveness.

The recorded requirements are:

- Every GET or HEAD readiness request performs a fresh, minimal read-only query against the actual ticket schema through the same configured application database used by ticket operations, including an already-initialized shared store.
- Normal existing lazy initialization may precede that query. Initialization and query failures both produce the unavailable result.
- Successful reads of an initialized but empty tickets table count as ready.
- `GET /api/ready` returns exactly HTTP 200 with `{"status":"ready"}` or HTTP 503 with `{"status":"unavailable"}`. Both states use `application/json` and `Cache-Control: no-store`.
- `HEAD /api/ready` performs the same current check and returns corresponding status and headers without a body.
- Other methods return HTTP 405 with `Allow: GET, HEAD`, without initializing or probing the database.
- Caller inputs cannot override the configured database or query.
- Each readiness initialization or query failure emits one fixed, generic server-side readiness-failure error event without sensitive or dynamic values.
- Acceptance requires actual HTTP observations using the delivered immutable image, isolated configuration repair by recreation, populated-volume preservation, real ticket journeys, and deterministic warm-store query failure and recovery coverage.

A ready result establishes only successful normal initialization and a current ticket-schema read. It is not a guarantee of writable storage, successful mutations, full application availability, bounded latency, or production admission suitability.

### Application grounding

Read-only inspection of the existing application establishes:

| Surface | Existing behavior relevant to this specification |
| --- | --- |
| `src/app/api/health/route.ts` | Returns `{"status":"ok"}` without database access. |
| `src/app/page.tsx` | Dynamically renders the dashboard using ticket listing and summary queries; includes `data-testid="service-desk-dashboard"`. |
| `src/lib/ticket-store.ts` | Uses synchronous `node:sqlite` and a lazily initialized shared `TicketStore`. |
| Database configuration | `getTicketStore()` selects `SERVICE_DESK_DB_PATH`, otherwise `data/service-desk.db` beneath the working directory. Once initialized, the shared store retains that configuration. |
| Initialization | May create directories, configure WAL and foreign keys, create the tickets table, add the owner column to an older table, and seed four tickets when the tickets table is newly created. An existing empty table is not reseeded. |
| Ticket operations | Reads, creation, status updates, and ownership updates use the shared store. Updating ownership to its current value does not change its timestamp. |
| Validation and filters | Server-side schemas validate business inputs. Owner, search, status, and priority filters intersect. Unsupported enumerated dashboard filter values are ignored. |
| Container | Uses Node.js 24 and defaults to `/app/data/service-desk.db`. |
| Existing reliability consumer | `tools/brownfield-demo/probes.mjs` expects `ready` or `unavailable`, JSON, and `Cache-Control: no-store`; it separately checks ticket read journeys. |

No readiness route exists in the inspected application. These observations ground the proposed change but do not demonstrate delivered readiness behavior.

## Non-goals

This increment does not introduce authentication, an external monitoring platform, production traffic switching, automatic recovery, preventive reliability work, cross-version database rollback, or production certification.

It does not:

- Replace or couple database access to the existing liveness check.
- Change accepted ownership, handoff, filtering, creation, or status behavior.
- Reset databases or rewrite the prior delivery's frozen specifications, plans, tests, or acceptance records.
- Add per-probe business writes, a write-and-rollback probe, a substitute database, or cached readiness results.
- Require dynamic database-path changes within a running process.
- Add transition tracking, a new logging dependency, numeric endpoint deadlines, SQLite-lock deadlines, or altered database busy-timeout semantics.
- Require additional lock-contention, corrupt-file, or read-only write-failure matrices in this increment.

Dependency risks and the subsequent reliability exercise remain outside completion claims. A future admission policy must combine this limited signal with relevant application journeys and its own admission criteria.

This document review does not initiate a Plan, implementation, tests, fault injection, or recovery execution. Existing bilingual guides and demo documentation remain unchanged.

## Actors

| Actor | Responsibility or interest |
| --- | --- |
| Human Intent owner and configured reviewers | Own the Intent, record consequential decisions or deferments, inspect this revised specification, and explicitly approve a specific version. |
| Operators and demo presenters | Distinguish live processes from unavailable ticket-read dependencies and observe isolated recovery. |
| Service-desk users | Retain established ticket journeys and data despite the operational-status increment. |
| Next.js service and configured SQLite database | Provide the process response and current ticket-schema read capability being assessed. |
| Future reliability and admission consumers | May consume the endpoint alongside application journeys; their integration and admission policies are not delivered here. |

## Constraints

**Compatibility and preservation.** Preserve the Alex Chen and Sam Rivera roster, optional ownership, assignment, reassignment, clearing, intersecting filters, ticket creation, and status updates. Preserve existing ticket values and timestamps except intentional valid user edits. Do not reset, reseed, or update existing business records through readiness. An intentionally empty existing tickets table remains empty.

**Initialization boundary.** Readiness may invoke existing normal lazy initialization, including directory creation, WAL setup, schema creation, owner-column migration, and normal new-database seeding. The probe is read-only after initialization; the first request is not guaranteed to be entirely side-effect-free. Initialization failure is unavailable, not a healthy fallback.

**Current dependency evidence.** Connection opening or `SELECT 1` alone is insufficient. Each accepted readiness request must query the actual ticket schema through the configured application database. Previous success cannot mask a later query failure, and previous failure cannot permanently mask a later successful query.

**HTTP and privacy.** Preserve `GET /api/health` as HTTP 200 with `{"status":"ok"}`, independent of database access. Readiness responses disclose only the generic state. Ignore readiness query parameters and GET bodies; accept no caller-provided database path, SQL, or configuration overrides. Do not disclose paths, exceptions, messages, stacks, ticket contents, credentials, request inputs, or other dynamic sensitive values in newly introduced readiness diagnostics.

**Diagnostics.** Each initialization or query failure produces one fixed generic readiness-failure error event. Repeated failures each produce their own event; no transition tracking or stateful result caching is introduced.

**Accepted responsiveness limitation.** There is no numeric endpoint-latency or SQLite-lock deadline requirement, and database busy-timeout semantics remain unchanged. Synchronous SQLite contention can delay readiness and other requests. This is an accepted limitation, not measured responsiveness. The recorded follow-up owner is huangyingting: before any bounded traffic-admission latency or production-readiness claim, measure representative contention on the supported runtime and separately specify any needed timeout or execution isolation.

**Isolation and evidence.** Faults are injected only into disposable isolated resources, never shared instances or existing shared data volumes. Later acceptance must use actual HTTP, database access, sanitized error handling, recovery observations, business journeys, and preservation comparisons. Unit tests or a model summary alone are insufficient.

**Review and language.** Use English for this specification and related Intent review material while preserving protocol headings, JSON keys, commands, and identifiers. Discovery decisions, checklists, AI comments, and successful validation are not specification approval. No version-specific approval is supplied.

## Discovery

```json
{
  "problem": "Operators and demo presenters cannot distinguish a responsive IT service desk process from an instance whose database failure prevents the ticket dashboard from opening. Service-desk users can encounter application failure despite successful liveness checks.",
  "evidence": "The Intent reports isolated fault injection between 2026-10-12T11:44:51Z and 2026-10-12T11:44:52Z using image ghcr.io/huangyingting/ai-native-sdlc-demo-it-service-desk@sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76, sourced from commit 1a1e14d0031305ee5da35c523ffbac9fa6f7e58b; the maintenance starting point is f52cc87b435d781af0be40a811d33f0cfd84d66b. Both configurations returned 200 with status ok from /api/health. The healthy dashboard returned 200 with its marker, the invalid-path dashboard returned 500 without it, and /api/ready returned 404 on both. The healthy isolated volume had four verified seed tickets and its dashboard remained available afterward. Reports and screenshots are retained outside the repository and were not independently inspected in this review. Current application inspection confirms database-independent liveness, database-dependent dashboard rendering, synchronous shared SQLite storage, preservation of existing empty tables, and lazy initialization side effects. Existing reliability tooling expects the unavailable token and separately evaluates ticket read journeys. Production incidence, customer benefit, recovery-time baselines, representative contention measurements, and delivered readiness behavior are unknown.",
  "successMeasure": "Observe the delivered immutable image over actual HTTP: healthy database reads yield 200 with status ready; invalid-path initialization yields 503 with status unavailable; both responses are JSON and no-store while liveness remains 200 with status ok. Demonstrate a fresh actual ticket-schema query on each GET or HEAD request, warm-store failure followed by recovery, healthy restart and repaired recreation using one populated isolated volume, preservation except intentional edits, initialization compatibility, and real ticket read and write journeys. No production improvement target or numeric latency baseline is supplied. Contention measurement and any bounded-latency requirement remain a follow-up rather than evidence of performance.",
  "alternatives": "Do nothing: no change, but liveness continues to conceal database failure. Use dashboard HTTP checks only: no new endpoint, but rendering is a heavier and less explicit dependency signal. Open the database only or execute SELECT 1: smaller probe, but no actual ticket-schema read evidence. Query the actual ticket schema on each request: small current read signal without business writes, but no write or full-journey guarantee. Add a write-and-rollback probe: stronger write evidence with locking and side-effect risks, beyond this read-only increment. Separate initialization from readiness: stricter first-request side-effect isolation, but expands the initialization boundary and compatibility work.",
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
      "commentId": 6124226071,
      "acceptanceIds": ["AC-2", "AC-4", "AC-6"],
      "explanation": "Require a fresh minimal read-only actual ticket-schema query through the configured application database on every GET or HEAD request, including the warm shared store. Empty initialized tables are ready. Exclude connection-only checks, SELECT 1 alone, substitute databases, business writes, and cached success."
    },
    {
      "questionId": "Q-2",
      "commentId": 6124226071,
      "acceptanceIds": ["AC-3", "AC-5", "AC-6"],
      "explanation": "Permit existing lazy initialization before the probe, including normal schema and owner migration and genuine new-database seeding, while preserving existing records, timestamps, and intentionally empty tables. Initialization failures use the unavailable contract. Unsupported methods do not initialize. First-request side-effect freedom is explicitly not guaranteed."
    },
    {
      "questionId": "Q-3",
      "commentId": 6124226071,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-6", "AC-9"],
      "explanation": "Make /api/ready, exact 200/ready and 503/unavailable JSON responses, no-store caching, fresh HEAD checks without bodies, and 405 with Allow: GET, HEAD required rather than proposed. Ignore query parameters and GET bodies and prohibit configuration or SQL overrides. Preserve database-independent 200/ok liveness. The selected unavailable token supersedes the historical unready recommendation preserved in the question options."
    },
    {
      "questionId": "Q-4",
      "commentId": 6124226071,
      "acceptanceIds": ["AC-3", "AC-4", "AC-9"],
      "explanation": "Require one fixed sanitized server-side error event for each initialization or query failure, without raw exceptions or dynamic sensitive values, transition tracking, stateful caching, or a new logging dependency. Record the accepted absence of numeric endpoint or lock deadlines and unchanged busy-timeout semantics; contention measurement and any timeout or isolation requirement remain a follow-up, not a responsiveness guarantee."
    },
    {
      "questionId": "Q-5",
      "commentId": 6124226071,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-7", "AC-8", "AC-9"],
      "explanation": "Require immutable-image live HTTP evidence for healthy, invalid-path, and repaired states; retain a populated isolated volume across healthy restart and repaired recreation; verify preservation and real ticket journeys. Require deterministic warm-store query failure and subsequent recovery plus fresh, empty-existing-table, and pre-owner initialization coverage. Dynamic path changes and additional lock-contention, corrupt-file, and read-only write-failure matrices are outside this increment."
    },
    {
      "questionId": "Q-6",
      "commentId": 6124226071,
      "acceptanceIds": ["AC-2", "AC-8", "AC-9"],
      "explanation": "Define ready solely as successful normal initialization and a current ticket-schema read. Demonstrate real writes during isolated recovery acceptance, not per probe. Exclude guarantees of writable storage, mutations, full journeys, authentication, latency, production fitness, or production admission; subsequent reliability work must combine this signal with relevant journeys and its own policy."
    }
  ]
}
```

## Acceptance scenarios

AC-1 through AC-9 retain their existing IDs and behavioral subjects. The formerly pending requirements below now incorporate the supplied latest decisions. No scenario is claimed to have been executed.

### AC-1: Preserve database-independent liveness

**Given** a responsive isolated instance with either a healthy database configuration or a deliberately invalid database path.

**When** an operator sends `GET /api/health`, before or after readiness requests.

**Then** the response is HTTP 200 with JSON `{"status":"ok"}` in both configurations, without initializing or accessing the database. Readiness failures do not change this contract.

### AC-2: Report current database-read readiness

**Given** an isolated instance whose configured application database has a readable initialized ticket schema, including an intentionally empty tickets table or an already-initialized shared store.

**When** an operator sends `GET /api/ready`, including repeated requests.

**Then** each request performs a fresh minimal read-only query against the actual ticket schema through the same configured database used by ticket operations and returns HTTP 200 with exactly `{"status":"ready"}`, `application/json`, and `Cache-Control: no-store`. An empty initialized table counts as ready. No ticket contents are returned. Connection opening, `SELECT 1` alone, substitute databases, business-record writes, and reused success do not satisfy the scenario. The response establishes current database-read capability only, not write or full-journey availability.

### AC-3: Report invalid configuration without masking failure

**Given** a responsive isolated instance configured with a database path beneath `/dev/null`, without a mounted data volume, or another deterministic isolated initialization failure.

**When** an operator sends `GET /api/ready`, including repeated failing requests.

**Then** each failed initialization returns HTTP 503 with exactly `{"status":"unavailable"}`, `application/json`, and `Cache-Control: no-store`, rather than an unhandled failure page or healthy fallback. Each failure emits one fixed generic server-side readiness-failure error event. Neither response nor event includes raw exceptions, messages, stacks, paths, ticket contents, credentials, request inputs, or other dynamic sensitive values. Liveness remains compatible under AC-1. No numeric response deadline is asserted.

### AC-4: Re-evaluate failure and recovery after an earlier success

**Given** a warm shared store that previously passed readiness, and a deterministic disposable condition that makes its next actual ticket-schema query fail.

**When** readiness is requested during that failure and again after the query can succeed, without changing database configuration.

**Then** each request executes a fresh query through the same configured application database. Failed queries return the AC-3 unavailable response and produce one fixed sanitized event per failure; a subsequent successful query returns the AC-2 ready response. Neither cached success nor permanent cached failure is permitted. Coverage demonstrates this warm-store transition without claiming dynamic database-path recovery, recovery from every fault, or bounded latency.

### AC-5: Make initialization side effects explicit

**Given** a fresh isolated database location, a disposable compatible older database lacking the owner column, or an existing initialized database whose tickets table is intentionally empty.

**When** readiness is requested before the dashboard and then requested repeatedly.

**Then** normal existing initialization may precede the read-only query. A genuinely new database receives the usual four seed tickets; the older table receives the existing owner-column migration without rewriting existing ticket values or timestamps; and the intentionally empty existing table remains empty and can return ready. Repeated requests do not duplicate seeds, reset data, or update business records. Initialization failure follows AC-3. Read-only describes the probe after initialization, not a guarantee of entirely side-effect-free first access.

### AC-6: Prevent caller-controlled database access

**Given** requests to `/api/ready` with query parameters or a GET body suggesting another database path, SQL, or configuration value, and requests using HEAD, POST, PUT, PATCH, DELETE, or OPTIONS.

**When** the endpoint receives those requests.

**Then** GET ignores query parameters and its body, does not reflect their values, and performs the ordinary configured ticket-schema query. HEAD performs the same fresh dependency check and returns the corresponding 200 or 503 status, JSON content type, and `Cache-Control: no-store`, without a response body; its failures follow the same diagnostic rule. Other methods return HTTP 405 with `Allow: GET, HEAD` and do not initialize, query, or mutate the database, including before first access. No caller input can select a substitute database or replace probe SQL.

### AC-7: Observe repair and persistent-data recovery

**Given** the delivered immutable image, one populated disposable application volume with privately recorded ticket values and timestamps, a healthy isolated reference, and a faulty isolated configuration exhibiting AC-3 without access to shared data.

**When** an operator observes a healthy restart using the populated volume, repairs the faulty configuration, recreates the instance using that retained volume, and sends actual HTTP requests for readiness, the dashboard, and known ticket details.

**Then** restarted and repaired instances return the AC-2 ready response, the dashboard returns HTTP 200 with `data-testid="service-desk-dashboard"`, and known details remain readable. Repeated probes preserve those results. Existing records and timestamps match their recorded values except intentional valid user edits. The healthy reference remains available through the fault observation. No shared instance or existing shared data volume is modified, reset, or replaced. Configuration repair by recreation is sufficient; dynamic path changes in a running process are not required.

### AC-8: Preserve accepted ticket behavior and validation

**Given** the repaired isolated instance, the accepted owner roster, and existing ticket workflows.

**When** a user creates a valid ticket, assigns it to Alex Chen, reassigns it to Sam Rivera, clears ownership, updates status, and combines owner, search, status, and priority filters; the user also submits invalid creation, ownership, and status inputs and repeats an unchanged-owner submission.

**Then** valid operations retain existing persistence and user-facing behavior, new tickets start unassigned, and filters intersect. Unsupported enumerated dashboard filters retain their existing ignored-value behavior. Invalid business inputs retain existing server-side validation and error behavior without invalid records or unintended changes. An unchanged-owner submission does not alter its timestamp. Only intentional valid operations change relevant records or timestamps; readiness polling does not. Actual successful writes are recovery acceptance evidence, not a guarantee that each ready response establishes write capability.

### AC-9: Keep acceptance evidence proportionate and private

**Given** a subsequently approved specification and later isolated observations covering healthy, invalid-path, restarted, and repaired instances, plus deterministic initialization and warm-store failure/recovery coverage.

**When** evidence is assembled for Human acceptance.

**Then** it identifies the delivered immutable artifact and isolated resource relationships; records actual HTTP statuses, exact readiness bodies, content type, cache headers, HEAD and method behavior, dashboard-marker presence, ticket journeys, and preservation comparisons; and establishes fresh-query behavior and sanitized failure diagnostics. Evidence distinguishes live observations from deterministic coverage and unexecuted cases. Sensitive database contents, raw error logs, paths, and credentials are not published.

**Then** the evidence explicitly limits readiness to current database-read capability. It does not claim write guarantees, full application readiness, numeric latency guarantees, production certification, or completion of broader reliability exercises. Additional lock-contention, corrupt-file, and read-only write-failure matrices remain outside this increment. Tests, AI comments, checklists, discovery decisions, and successful observations do not themselves constitute version-specific Human specification approval or final acceptance.

## Revision summary

Revision 3 integrates all six supplied latest decisions from comment #6124226071 into the behavioral contract and acceptance scenarios.

Q-1 retains the fresh actual ticket-schema query requirement. Q-2 now permits normal lazy initialization while preserving existing records, timestamps, and empty tables. Q-3 makes the exact `/api/ready` contract mandatory, including the selected `unavailable` token, HEAD behavior, unsupported-method handling, and input isolation. Q-4 requires fixed per-failure diagnostics and explicitly accepts the absence of latency and lock deadlines. Q-5 requires immutable-image HTTP recovery evidence, retained-volume preservation, real journeys, initialization compatibility, and deterministic warm-store failure/recovery. Q-6 accepts database-read readiness with explicit write, full-journey, latency, and production-admission limitations.

All discovery questions and options remain unchanged, including Q-3's historical `unready` recommendation. Its recorded outcome selects `unavailable`; the historical option is not the operative requirement. Exactly one mapping per latest decision links the selected outcome to existing acceptance IDs.

Previously pending proposals are now requirements in this candidate. Unselected alternatives remain discussion history, not agreed behavior. Operational branch-restoration and document-generation discussion does not alter product requirements.

This revision claims neither specification approval nor implemented or verified readiness. The Human must inspect and explicitly approve this version separately.

## Open questions

There are no unanswered discovery-register items: the supplied latest decisions address Q-1 through Q-6. Their questions and options remain visible in Discovery for continuity, and their outcomes are integrated into the acceptance scenarios.

**Deferred performance risk — Q-4:** Synchronous SQLite contention may delay readiness and other requests. No endpoint or lock deadline is required in this increment, and no responsiveness baseline has been established. Follow-up owner: huangyingting. Representative runtime measurements and a separately specified timeout or execution-isolation requirement are needed before claiming bounded admission latency or production readiness. This risk has not been measured or solved by specification review.

**Accepted scope limitations — Q-5 and Q-6:** Additional contention, corrupt-file, and read-only write-failure matrices are not required here. A ready response does not establish writable storage, successful mutations, all journeys, or production admission suitability. Broader reliability work and baseline dependency risks remain outstanding; they are not evidence of completed recovery or certification.

No version-specific specification approval is supplied. Recorded decisions and their mappings do not replace Human inspection of the revised behavior.

