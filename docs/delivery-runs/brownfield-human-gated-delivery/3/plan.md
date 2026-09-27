# Implementation plan

## Acceptance mapping

| Acceptance scenario | Planned coverage |
| --- | --- |
| AC-1 | TASK-1 defines the fixed roster and nullable ownership model; TASK-2 migrates an old-schema SQLite database without replacing or altering existing records; TASK-4 displays Unassigned on the dashboard and detail page; TASK-7 verifies preservation of all four records, timestamps, summaries, and ownership defaults. |
| AC-2 | TASK-3 implements validated persistence for assignment, reassignment, and clearing; TASK-5 adds the detail-page ownership control; TASK-7 verifies reload and same-volume restart durability while preserving all non-ownership fields. |
| AC-3 | TASK-4 exposes ownership in queue data; TASK-6 adds an owner filter that intersects with search, status, and priority; TASK-7 verifies the exact ticket-reference sets and combined-filter outcomes. |
| AC-4 | TASK-3 rejects forged owners and nonexistent ticket IDs without mutation; TASK-5 and TASK-6 provide labeled keyboard-operable controls; TASK-7 covers valid and invalid storage/server behavior plus accessibility checks. |
| AC-5 | TASK-1 keeps new tickets unassigned; TASK-4 displays that state; TASK-5 leaves the creation form unchanged; TASK-6 preserves existing filtering; TASK-7 verifies creation, status updates, search, filtering, ordering, and summary compatibility on a separate fresh dataset. |

## Tasks

### TASK-1: Define the ownership domain model

Depends on: none  
Acceptance: AC-1, AC-4, AC-5  
Surfaces: existing ticket model and types, SQLite row mapping, ticket creation defaults, shared application constants used by server and UI components  
Validation: add focused model and storage tests proving that only `avery-stone`, `jordan-lee`, and the explicit Unassigned representation are valid; prove newly created tickets default to Unassigned without accepting an owner from the creation workflow

Introduce one shared fixed-roster definition mapping the approved identifiers to their display names. Extend the ticket representation with a nullable owner identifier while preserving all existing fields and established serialization behavior. Use the existing application’s nullable-value conventions for Unassigned rather than introducing a third roster identifier or free-text value.

Keep ownership absent from the ticket creation form and creation input contract. Ensure the storage-to-domain mapping exposes old or null owner values as Unassigned and that presentation code resolves assigned identifiers through the fixed roster.

### TASK-2: Migrate old-schema SQLite databases safely

Depends on: TASK-1  
Acceptance: AC-1  
Surfaces: existing SQLite initialization and schema migration path, database schema version or column inspection logic, seed-data initialization, storage migration tests and fixtures  
Validation: run a controlled migration test against an old-schema database populated with INC-0001 through INC-0004; compare every original persisted field and timestamp before and after migration, verify the new owner column is null, and verify reopening the migrated database is idempotent

Extend the existing database initialization path to detect the old schema and add a nullable owner column without recreating the tickets table or rerunning seed insertion over persisted data. Preserve IDs, references, titles, descriptions, requester fields, categories, priorities, statuses, `createdAt`, and `updatedAt` exactly.

Build the migration fixture through the application’s pre-ownership schema, not by constructing a database that already contains the owner column. Keep fresh-dataset seed behavior separate from migration evidence so a successful seed insertion cannot be mistaken for old-data compatibility.

Verify that repeated startup against the migrated database does not modify records or timestamps. Confirm the four-ticket dashboard summary remains 2 open, 1 in progress, 1 resolved, and 2 active high-or-critical tickets.

### TASK-3: Persist and validate ownership mutations

Depends on: TASK-1, TASK-2  
Acceptance: AC-2, AC-4  
Surfaces: existing ticket storage or repository layer, detail-page mutation endpoint or server action, request parsing and validation, update error handling  
Validation: storage and server tests for assignment, reassignment, clearing, forged `not-in-roster`, nonexistent ticket IDs, unchanged records after rejection, and preservation of all fields other than owner and an optional nondecreasing `updatedAt`

Add a narrow ownership update operation to the existing ticket persistence layer. Accept only `avery-stone`, `jordan-lee`, or the application’s explicit Unassigned value. Validate the submitted owner before writing, then verify that the target ticket exists and report repository-standard errors for either invalid input or a missing ticket.

Update only ownership and, if consistent with existing mutation behavior, `updatedAt`. Do not route ownership changes through a broad ticket replacement that could overwrite concurrent or unrelated fields. Ensure rejected mutations execute no partial update and cannot alter any ticket.

Reuse the current detail-page mutation and response conventions so success and failure behavior remain consistent with status updates. Persistence must use the existing SQLite database and survive application or container restart with the same volume.

### TASK-4: Display ownership in existing ticket views

Depends on: TASK-1, TASK-2  
Acceptance: AC-1, AC-2, AC-3, AC-5  
Surfaces: existing dashboard ticket query and queue rows or cards, ticket detail query and page, owner display components, empty-state and responsive layouts  
Validation: component or page tests showing Avery Stone, Jordan Lee, and Unassigned correctly on dashboard rows and detail pages; regression checks for current ticket content, priority ordering, and dashboard summaries

Include ownership in the existing dashboard and detail data paths without changing their current ticket selection, ordering, or summary calculations. Show the fixed display name for assigned tickets and the literal label Unassigned for null ownership.

Integrate the owner label into existing queue and detail layouts using their current semantic and responsive patterns. Do not introduce a new dashboard, ownership history, team display, or additional identity lookup.

### TASK-5: Add the detail-page ownership control

Depends on: TASK-3, TASK-4  
Acceptance: AC-2, AC-4, AC-5  
Surfaces: existing ticket detail page, status-update interaction patterns, form controls, mutation feedback and error presentation, creation form regression coverage  
Validation: interaction tests assigning Avery, reassigning to Jordan, and clearing to Unassigned; reload checks after each operation; keyboard and accessible-name checks for every option; regression assertion that the creation form has no owner control

Add a labeled ownership selector to the existing ticket detail page with exactly three states: Unassigned, Avery Stone, and Jordan Lee. Follow the established status-control submission, pending-state, success, and error patterns while invoking the dedicated ownership mutation.

Ensure the control is natively keyboard-operable or implements equivalent accessible keyboard behavior, exposes an accessible label, and reflects persisted state after navigation or reload. A failed mutation must retain or restore the server-confirmed state and present the error through the application’s existing error surface.

Do not add assignment controls to dashboard rows or the creation form.

### TASK-6: Add intersecting dashboard owner filtering

Depends on: TASK-1, TASK-4  
Acceptance: AC-3, AC-4, AC-5  
Surfaces: existing dashboard filter state, search/status/priority filtering pipeline, queue derivation, owner filter control, filter reset or clear behavior  
Validation: deterministic filter tests for All, Unassigned, Avery, and Jordan; exact reference-set assertions; combined owner/search/status/priority cases; checks that clearing only owner preserves other filters; keyboard and accessible-label checks

Add a labeled owner filter with All owners, Unassigned, Avery Stone, and Jordan Lee. Extend the existing filtering pipeline with an ownership predicate rather than replacing or resetting search, status, or priority state.

Preserve the current meaning of clearing filters. Clearing only owner must return ownership selection to All owners while leaving search, status, and priority unchanged. Do not alter priority ordering, empty-queue behavior, or summary semantics.

Verify exact queue membership for the approved four-ticket ownership arrangement: All contains INC-0001 through INC-0004; Avery contains INC-0001 and INC-0003; Jordan contains INC-0002; Unassigned contains INC-0004. Verify Avery plus Open, High, and `inc-1` yields only INC-0001, while Avery plus Critical yields an empty queue.

### TASK-7: Establish controlled Red and Green acceptance evidence

Depends on: TASK-2, TASK-3, TASK-5, TASK-6  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: existing unit, storage, server, component, and application test suites; old-schema database fixture; fresh-dataset fixture; documented project validation commands  
Validation: capture an intentional controlled-Red run against the pre-implementation behavior, then run the same ownership tests Green after implementation; run the complete IT service desk test, lint, and build commands

Before production behavior is implemented, add or stage narrowly scoped acceptance tests whose failures demonstrate the missing ownership behavior rather than environment, fixture, or syntax failures. The controlled Red must include at least old-schema migration preservation, valid and invalid mutations, owner-filter intersections, and the new-ticket Unassigned default. Record the exact failing assertions and command output as delivery evidence; do not commit deliberately failing tests separately unless the repository’s delivery process explicitly requires that structure.

After implementation, run the same tests Green and retain traceability to AC-1 through AC-5. Use isolated datasets where required:

- For AC-1, start with an old-schema database containing the original four persisted tickets and exact timestamps.
- For AC-2, perform assign, reassign, and clear operations with page reloads, then restart against the same database volume without cleanup.
- For AC-3, use only the four specified tickets and assert exact references rather than counts.
- For AC-4, exercise keyboard operation and server/storage rejection paths, verifying no mutation after invalid requests.
- For AC-5, use a separate fresh dataset and create the exact approved ticket, ensuring it is not included in AC-3 results.

Complete Green verification with the project’s existing full test, lint, and production build checks. Delivery evidence, image publication, protected merge, Human review, and runtime acceptance remain downstream activities governed by existing workflow rules; this task does not change or pre-approve them.

## Risks and migrations

- **Old-schema data loss:** A table rebuild, unconditional seed, or incorrectly ordered initialization could replace or alter existing tickets. Mitigate by using the smallest supported additive SQLite migration, testing a persisted old-schema fixture, comparing every field and timestamp, and proving migration idempotence.
- **Fresh data mistaken for migration evidence:** Fresh seed success does not establish compatibility. Keep old-schema migration and fresh-dataset creation tests distinct, and identify the fixture provenance in validation evidence.
- **Invalid owner bypass:** UI-only validation could allow forged values or nonexistent ticket mutations. Centralize roster validation in the server mutation boundary and storage operation, and assert unchanged database state after every rejection.
- **Nullable-value inconsistency:** Forms, query parameters, and SQLite may encode Unassigned differently. Select one existing application-compatible wire representation, normalize it at the server boundary, and store it as SQL null; do not treat arbitrary empty or unknown values as valid.
- **Accidental broad updates:** Reusing a full-ticket update could overwrite unrelated fields. Use a targeted owner mutation and compare pre/post records, permitting only owner and a nondecreasing `updatedAt` to differ.
- **Filter regression:** Adding owner state could reset or bypass current filters. Add the owner predicate to the existing composition and test each approved combined state plus owner-only clearing.
- **Summary or ordering regression:** Ownership must not affect current queue priority ordering or dashboard summary calculations. Keep owner out of sorting and summary logic and preserve existing regression assertions.
- **Persistence evidence contamination:** Cleanup or reseeding between AC-2 operations would invalidate restart evidence. Use the same labeled database volume through assign, reassign, clear, reload, and restart observations.
- **Accessibility regression:** A custom selector could be visually correct but inaccessible. Prefer the application’s existing native labeled form-control pattern and include keyboard and accessible-name checks.
- **Test coupling:** AC-5’s extra ticket would invalidate AC-3’s exact reference sets if datasets are shared. Use separate database fixtures and independent setup for those scenarios.
- **Migration rollback:** The additive nullable column should remain readable by the ownership-capable application after partial delivery retries. Because older application versions may not formally support a newer schema, deployment rollback compatibility must be checked against the existing initialization/query behavior before delivery; no destructive down-migration is proposed.

## Validation

Validation is planned, not completed evidence.

1. Establish controlled Red failures for the approved ownership scenarios on the unchanged application. Confirm failures are caused by absent ownership behavior, including the lack of old-schema migration, mutation support, ownership display, and filtering.
2. Run focused model, migration, storage, server, and UI tests during Green implementation. The migration test must open an old-schema SQLite database and compare all original ticket values and exact timestamps before and after migration.
3. Verify AC-1 with all four original tickets, Unassigned display on dashboard and detail, unchanged summaries, no replacement by seed data, and idempotent reopening.
4. Verify AC-2 by assigning INC-0001 to Avery, reassigning it to Jordan, and clearing it. Reload dashboard and detail after each change, then restart against the same existing volume and verify persistence and non-ownership field preservation.
5. Verify AC-3 using exact reference sets and all approved combined-filter outcomes. Confirm clearing owner leaves search, status, and priority selections and behavior intact.
6. Verify AC-4 through keyboard interaction and accessible-label checks, plus direct server/storage tests for valid values, `not-in-roster`, and a nonexistent ticket. Compare database state to prove rejected requests mutate nothing.
7. Verify AC-5 on a separate fresh dataset by creating the exact specified ticket, confirming Open and Unassigned defaults, confirming no creation owner field, and exercising existing detail, status, search, status-filter, priority-filter, ordering, and summary behavior.
8. Run the complete documented IT service desk validation from `demos/it-service-desk`: `npm test`, `npm run lint`, and `npm run build`.
9. Preserve actual Red and Green outputs through the established delivery evidence mechanism. Do not treat this plan, a fresh image smoke test, merged code, a closed Issue, scripted rehearsal approval, or replay output as Human delivery acceptance.

## Revision summary

This is the initial implementation-plan draft for Human Intent #3; no previous Plan document was supplied, so there are no existing TASK IDs to retain or changed tasks to enumerate.

**Human decisions carried forward:** the approved specification fixes nullable single-owner behavior, the roster identifiers and labels, Unassigned defaults, old-schema preservation, server-side rejection behavior, ownership visibility, detail-only mutation, intersecting dashboard filtering, accessibility requirements, existing-workflow compatibility, and the AC-1 through AC-5 boundaries. The discussion records `/sdlc approve spec v1`, which establishes the supplied specification as the planning baseline; `/sdlc retry` adds no application behavior.

**Plan proposals requiring review:** TASK-1 through TASK-7 propose implementation sequencing, a shared roster definition, an additive nullable SQLite migration, a targeted ownership mutation, reuse of existing control and error patterns, and the controlled Red/Green validation structure. These are implementation choices, not revisions to the approved specification or Human decisions.

Only explicit Human approval of this Plan version permits engineering handoff. The rehearsal language and scripted approvals in the Intent do not constitute genuine Human acceptance and must not weaken review, CI, publication, or delivery gates.

## Open questions

- **Unassigned request encoding:** The specification requires an explicit Unassigned mutation value but does not prescribe its transport encoding. The proposed implementation should use the existing form/server conventions and normalize one explicit value to SQL null. If the Human requires a particular wire value, that requires clarification before TASK-3 is finalized but does not change nullable ownership behavior.
- **SQLite migration mechanism:** The plan proposes the application’s existing schema-initialization or migration mechanism, but the exact mechanism must follow the current implementation. If the application has no versioned migration facility, the engineering design must choose between schema inspection and introducing a migration version record without changing the preservation requirements.
- **`updatedAt` behavior:** The approved specification permits, but does not require, ownership changes to advance `updatedAt`. The proposal is to follow existing mutation semantics consistently. A Human decision is needed only if ownership updates must specifically advance or preserve that timestamp regardless of current application behavior.
- **Rollback compatibility:** The approved behavior defines forward migration but not operation of an older application binary against the migrated schema. Engineering should determine whether the existing SQLite queries tolerate an added nullable column. If guaranteed application-version rollback is required beyond that compatibility, the Human must request an explicit specification revision.

