# Implementation plan

## Acceptance mapping

| Acceptance scenario | Planned coverage |
| --- | --- |
| AC-1 | TASK-1 defines controlled-Red coverage for an old-schema database; TASK-2 adds the nullable ownership migration and verifies preservation of all four records, timestamps, fields, summary values, and Unassigned display; TASK-4 and TASK-5 expose the migrated state on detail and dashboard pages; TASK-7 performs Green verification. |
| AC-2 | TASK-1 adds failing assignment lifecycle and persistence tests; TASK-3 implements validated storage and server mutations; TASK-4 implements detail-page assignment, reassignment, and clearing; TASK-7 verifies reload and same-volume restart durability. |
| AC-3 | TASK-1 adds exact-set and filter-intersection tests; TASK-5 adds owner display and the All owners, Unassigned, Avery Stone, and Jordan Lee filters while preserving active search, status, and priority selections; TASK-7 verifies every required reference set and combination. |
| AC-4 | TASK-1 adds negative mutation and accessibility coverage; TASK-3 rejects forged owners and nonexistent tickets without mutation; TASK-4 and TASK-5 provide labeled keyboard-operable controls; TASK-7 verifies storage, server, and manual keyboard behavior. |
| AC-5 | TASK-1 adds fresh-dataset compatibility coverage; TASK-2 and TASK-3 ensure newly created tickets default to Unassigned; TASK-4 through TASK-6 preserve creation, detail, status, search, filtering, priority ordering, and summary behavior; TASK-7 verifies the exact creation example separately from AC-3. |

## Tasks

### TASK-1: Establish controlled TDD Red evidence

Depends on: none  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: existing IT service desk test suites, SQLite test fixtures, dashboard and ticket-detail integration tests, server mutation tests  
Validation: run the current targeted suites before adding ownership assertions, then run the new ownership tests and retain assertion-level failures caused specifically by the missing schema, ownership mutation, display, and filter behavior

Add deterministic tests before production changes. Build an old-schema SQLite fixture containing INC-0001 through INC-0004 with the original fields and exact timestamps rather than creating records through the ownership-capable schema. Add coverage for migration preservation, the assignment lifecycle, exact owner-filter reference sets, filter intersection and clearing semantics, invalid mutations, accessibility contracts, fresh-ticket defaults, and existing workflow compatibility.

Keep controlled-Red evidence separate from ordinary environmental or dependency failures. The pre-change baseline must pass, while the new tests must fail for the intended missing ownership behavior. Do not weaken existing assertions or treat a fresh seed insertion as migration evidence.

### TASK-2: Add the compatible ownership schema migration

Depends on: TASK-1  
Acceptance: AC-1, AC-2, AC-5  
Surfaces: existing SQLite schema initialization and migration logic, ticket persistence model, seed/bootstrap handling, database test fixtures  
Validation: migrate the old-schema four-ticket fixture and compare every pre-existing persisted field and timestamp before and after migration; verify all owners are Unassigned and the summary remains 2 open, 1 in progress, 1 resolved, and 2 active high-or-critical

Extend the ticket schema with a nullable single-owner field. Treat the database null state as Unassigned and constrain persisted assigned values to `avery-stone` or `jordan-lee` using the repository's established migration approach.

Make the migration additive, transactional, and idempotent. It must alter the existing database in place without replacing records, rerunning seed insertion over persisted data, or changing IDs, references, requesters, categories, priorities, statuses, `createdAt`, or `updatedAt`. Ensure fresh databases and newly inserted tickets receive the same Unassigned default without adding ownership to ticket creation input.

### TASK-3: Implement validated ownership persistence and server mutation

Depends on: TASK-2  
Acceptance: AC-2, AC-4, AC-5  
Surfaces: existing ticket repository or data-access module, ticket update service, server route or action used by the ticket detail page, shared ticket and request types  
Validation: storage and server tests assign each roster owner and clear to Unassigned; forged `not-in-roster` and nonexistent ticket IDs return the established error response and leave every ticket unchanged

Define the fixed roster once in the existing application layer used by both server validation and UI option construction. Extend ticket reads with the nullable owner while preserving the existing ticket shape and workflows.

Add a focused ownership update operation that validates both the ticket identifier and requested ownership state before writing. A successful mutation may change only the owner and may advance `updatedAt` to a nondecreasing value. Invalid owner identifiers and missing tickets must produce explicit repository-standard errors and perform no update. Avoid routing ownership changes through broad ticket replacement logic that could overwrite concurrent or unrelated fields.

### TASK-4: Add ownership to the ticket detail experience

Depends on: TASK-3  
Acceptance: AC-1, AC-2, AC-4, AC-5  
Surfaces: existing ticket detail page, ticket metadata display, status update form or action patterns, reusable form controls  
Validation: detail-page integration tests display Unassigned and both roster names; keyboard checks operate every option; reload tests verify assign Avery, reassign Jordan, and clear to Unassigned without altering other ticket fields

Display the resolved owner label in the existing detail metadata. Add a labeled control following the detail page's established mutation and error-handling patterns, with options for Unassigned, Avery Stone, and Jordan Lee.

After a successful mutation, ensure the detail page and subsequent dashboard read reflect persisted state rather than optimistic-only state. Preserve the existing status update and detail workflows, and surface mutation errors without presenting a failed assignment as successful.

### TASK-5: Add dashboard ownership display and intersecting filter

Depends on: TASK-3  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: existing dashboard ticket queue, ticket row or card component, search control, status and priority filters, dashboard query/filter state  
Validation: dashboard tests assert exact reference sets for All=INC-0001–INC-0004, Avery={INC-0001, INC-0003}, Jordan={INC-0002}, and Unassigned={INC-0004}; combined-filter tests assert Avery+Open+High+`inc-1`={INC-0001} and Avery+Critical={}

Show Avery Stone, Jordan Lee, or Unassigned on every existing ticket row or card. Add a labeled, keyboard-operable owner filter with All owners, Unassigned, Avery Stone, and Jordan Lee choices.

Integrate owner matching into the existing filter pipeline as an additional intersection, without replacing search, status, priority, priority ordering, or summary logic. Selecting All owners must change only owner-filter state: preserve the exact search text, status selection, and priority selection, and do not mutate any ticket owner. Keep this operation distinct in code and UI behavior from clearing a ticket owner on the detail page.

### TASK-6: Preserve creation and established workflows

Depends on: TASK-2, TASK-4, TASK-5  
Acceptance: AC-5  
Surfaces: existing ticket creation form and server action, ticket detail and status update flows, dashboard search and filters, priority ordering and summary calculations  
Validation: on a separate fresh dataset, create the exact `Ownership demo request` ticket and verify Open/Unassigned state, absence of an owner creation field, and unchanged detail, status, search, status-filter, priority-filter, ordering, and summary behavior

Keep ownership out of the creation form and its public input contract. Ensure the persistence default makes every newly created ticket Unassigned and that ownership display is added without changing existing status defaults or validation.

Run the compatibility scenario independently from AC-3 so the additional ticket cannot affect the required four-ticket reference sets. Add regression assertions around existing ordering and summaries rather than relying only on visual smoke checks.

### TASK-7: Complete Green verification and delivery evidence

Depends on: TASK-4, TASK-5, TASK-6  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: complete IT service desk test suite, lint and production build, old-schema migration fixture, browser acceptance flow, same-volume runtime or container configuration  
Validation: run all ownership tests Green, then run `npm test`, `npm run lint`, and `npm run build` from `demos/it-service-desk`; execute AC-1 through AC-5 with isolated datasets and verify persistence after restarting against the same existing database volume

Re-run the exact controlled-Red tests without weakening their assertions and retain the corresponding Green results. For AC-1, use the old-schema fixture and compare complete records before and after migration. For AC-2, reload both pages after each mutation and restart the same labeled runtime without cleanup. For AC-3, assert references rather than counts. For AC-4, combine automated server/storage checks with manual keyboard observations. For AC-5, use a separate fresh dataset.

Treat image smoke tests as supplementary only; they cannot replace migration or persisted-volume verification. Any later delivery evidence must record actual runs and preserve existing review and CI gates. Planned standard, revision, and failure-recovery variants must not be reported as completed unless each has genuine corresponding evidence.

## Risks and migrations

- **Existing-data loss:** Schema bootstrap code could mistake an old database for a fresh dataset or reseed it. Mitigate with an in-place transaction and before/after comparisons of every field for all four old-schema records.
- **Timestamp drift:** Generic update or migration helpers might advance `updatedAt` during migration. Migration must preserve both timestamps exactly; ownership mutations may advance only `updatedAt`, and only nondecreasingly.
- **Invalid owner persistence:** UI option restrictions are insufficient because requests can be forged. Central server-side validation and storage-level constraints must enforce the fixed roster and nullable Unassigned state.
- **Partial-write behavior:** Validation after issuing an update could mutate data before returning an error. Resolve and validate the ticket and owner before writing, and verify no mutation for both invalid-owner and missing-ticket cases.
- **Filter regression:** Adding owner state could reset or bypass existing search, status, or priority state. Extend the existing intersection pipeline and test state preservation when All owners is selected.
- **Semantic confusion:** “Clear owner filter” and “clear ticket owner” are different operations. Keep separate controls, state transitions, handlers, and test language.
- **Fresh-data false confidence:** A newly initialized database does not prove compatibility. The migration suite must begin from the actual old schema with persisted records.
- **Rollback compatibility:** The additive nullable column should leave persisted ticket data readable, but rollback to an older application version may not understand later ownership changes. Do not remove or transform legacy fields; document any runtime rollback limitation discovered during implementation.
- **Delivery-evidence overclaim:** Scripted rehearsal activity, a successful build, merged code, or replay output is not Human acceptance. Preserve the existing approval, review, publish, and verification gates.

No destructive data rewrite or separate backfill is proposed. The migration proposal is a nullable owner column whose existing rows naturally become Unassigned, with explicit roster validation for all later writes.

## Validation

1. Confirm the current targeted test baseline passes before ownership tests are introduced.
2. Capture controlled-Red results from the new tests, accepting only failures that demonstrate absent ownership behavior. Infrastructure, fixture, syntax, or unrelated regression failures do not qualify.
3. Validate migration against an old-schema database containing the four persisted records and exact timestamps. Compare complete records before and after migration, including unchanged summaries and Unassigned ownership.
4. Validate storage and server behavior for Avery Stone, Jordan Lee, explicit Unassigned, forged `not-in-roster`, and a nonexistent ticket ID. Negative cases must prove that no ticket changed.
5. Validate detail-page assignment, reassignment, and clearing after each page reload, followed by a restart using the same database volume.
6. Validate dashboard owner display and every AC-3 result as exact ticket-reference sets. Confirm selecting All owners preserves the exact active search, status, and priority state.
7. Keyboard-test the labeled detail ownership control and dashboard owner filter, including every allowed option.
8. On a separate fresh dataset, create the exact AC-5 ticket and exercise existing detail, status update, search, status filter, priority filter, ordering, and summary behavior.
9. Run the complete project checks from `demos/it-service-desk`: `npm test`, `npm run lint`, and `npm run build`.
10. Accept Green evidence only when the original Red assertions pass unchanged and all existing regression checks remain successful. Record planned delivery variants as not demonstrated until actual isolated runs and required Human decisions exist.

## Revision summary

This is the initial implementation-plan draft for approved Specification v2; no previous Plan document was supplied, so TASK-1 through TASK-7 receive new stable IDs. Future revisions should retain these IDs wherever task behavior remains unchanged.

**Human decisions carried into this Plan:** AC-1 through AC-5 remain fixed; the roster is Avery Stone and Jordan Lee; ownership is nullable and single-owner; existing and new tickets default to Unassigned; old-schema data must survive in-place migration; invalid ownership mutations must be rejected server-side; and existing workflows and non-goals remain unchanged. The Human clarification that selecting All owners clears only the owner restriction—while preserving exact search, status, and priority selections—is mapped explicitly to TASK-5 and is distinct from clearing a ticket owner in TASK-4.

**Plan proposals requiring review:** use a nullable constrained SQLite owner field, centralize the fixed roster for server and UI use, extend the existing filter intersection rather than introduce a parallel query system, and sequence implementation behind controlled TDD Red evidence. These are implementation proposals, not additional approved requirements.

The earlier v1 approval and draft Plan are superseded by the revision history. Approval of Specification v2 does not approve this Plan; only explicit Human approval of this exact Plan version permits engineering handoff.

## Open questions

No conflict with the approved Specification has been identified. The following implementation trade-offs remain for Human review; changing any specified behavior would require an explicit Specification revision:

- Should a valid request that sets a ticket to its already-current owner be treated as a successful no-op that preserves `updatedAt`, or as a successful mutation allowed to advance `updatedAt`? The proposed implementation preserves `updatedAt` for a no-op to avoid claiming a change that did not occur.
- What explicit transport representation should the existing server-action pattern use for Unassigned—such as an empty form value or a named sentinel—before normalizing it to database null? The proposal is to use a documented non-roster form value and normalize it server-side, never persist it as an owner identifier.
- Which existing application error status and response shape should distinguish an invalid owner from a nonexistent ticket? The proposal is to follow current server conventions while keeping both failures explicit and guaranteeing no mutation.

